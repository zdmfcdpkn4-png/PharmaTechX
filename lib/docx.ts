import { inflateRawSync } from "node:zlib";

/**
 * Lecture native d'un .docx côté serveur — reprise du Lecteur QIM · QCM :
 * archive zip → `word/document.xml` → un paragraphe Word par ligne, et les
 * images collées dans le document (question 84). Aucune dépendance : le
 * répertoire central du zip est lu à la main, l'entrée est décompressée par
 * `node:zlib`.
 */

interface Entree {
  nom: string;
  methode: number;
  offsetLocal: number;
  tailleCompressee: number;
}

function lireCentral(b: Buffer): Entree[] {
  let eocd = -1;
  for (let i = b.length - 22; i >= 0 && i > b.length - 65558; i--) {
    if (b.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("Archive .docx illisible (fin de répertoire absente)");
  const nb = b.readUInt16LE(eocd + 10);
  let p = b.readUInt32LE(eocd + 16);
  const out: Entree[] = [];
  for (let i = 0; i < nb; i++) {
    if (p + 46 > b.length || b.readUInt32LE(p) !== 0x02014b50) break;
    const methode = b.readUInt16LE(p + 10);
    const tailleCompressee = b.readUInt32LE(p + 20);
    const lNom = b.readUInt16LE(p + 28);
    const lExtra = b.readUInt16LE(p + 30);
    const lComm = b.readUInt16LE(p + 32);
    const offsetLocal = b.readUInt32LE(p + 42);
    const nom = b.toString("utf8", p + 46, p + 46 + lNom);
    out.push({ nom, methode, offsetLocal, tailleCompressee });
    p += 46 + lNom + lExtra + lComm;
  }
  return out;
}

/** Octets d'un fichier de l'archive : une image de `word/media`, par exemple. */
export function lireOctets(b: Buffer, nom: string): Buffer {
  const e = lireCentral(b).find((x) => x.nom === nom);
  if (!e) throw new Error(`Fichier ${nom} absent de l'archive`);
  const lNom = b.readUInt16LE(e.offsetLocal + 26);
  const lExtra = b.readUInt16LE(e.offsetLocal + 28);
  const debut = e.offsetLocal + 30 + lNom + lExtra;
  const brut = b.subarray(debut, debut + e.tailleCompressee);
  return e.methode === 0 ? brut : inflateRawSync(brut);
}

/** Extrait un fichier texte de l'archive (par défaut `word/document.xml`). */
export function lireEntree(b: Buffer, nom = "word/document.xml"): string {
  return lireOctets(b, nom).toString("utf8");
}

const ENTITES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&apos;": "'",
};

function deXml(s: string): string {
  return s
    .replace(/&(amp|lt|gt|quot|apos);/g, (m) => ENTITES[m])
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}

/**
 * document.xml → texte, un paragraphe Word par ligne. Un saut de ligne dans
 * le paragraphe (Maj + Entrée, `<w:br/>`) commence aussi une ligne : lu comme
 * une espace jusqu'au 01/10/2026, il soudait une question entière — énoncé,
 * propositions, corrigé — en une ligne, que l'analyseur ignorait.
 */
export function xmlEnTexte(xml: string): string {
  const paras = xml.match(/<w:p[ >][\s\S]*?<\/w:p>/g) ?? [];
  return paras
    .map((p) => {
      const morceaux =
        p
          .replace(/<w:tab\b[^>]*\/>/g, "<w:t>\t</w:t>")
          .replace(/<w:(?:br|cr)\b[^>]*\/>/g, "<w:t>\n</w:t>")
          .match(/<w:t(?:\s[^>]*)?>[\s\S]*?<\/w:t>/g) ?? [];
      return deXml(
        morceaux.map((m) => m.replace(/^<w:t(?:\s[^>]*)?>/, "").replace(/<\/w:t>$/, "")).join(""),
      ).trim();
    })
    .join("\n");
}

/**
 * Relations d'images du document (`word/_rels/document.xml.rels`) :
 * identifiant (`rId8`) → fichier de l'archive (`word/media/image4.png`). Une
 * image liée hors du document (`TargetMode="External"`) n'y figure pas.
 */
export function relationsImages(xml: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const [r] of xml.matchAll(/<Relationship\b[^>]*>/g)) {
    if (!/\bType="[^"]*\/image"/.test(r) || /\bTargetMode="External"/.test(r)) continue;
    const id = /\bId="([^"]+)"/.exec(r)?.[1];
    const cible = /\bTarget="([^"]+)"/.exec(r)?.[1];
    if (id && cible) out.set(id, cible.startsWith("/") ? cible.slice(1) : `word/${cible.replace(/^\.\//, "")}`);
  }
  return out;
}

/** Image collée dans le document Word (question 84, choix a). */
export interface ImageCollee {
  /** Nom donné dans le texte, dans l'ordre du document : `image-collee-1.png`, `image-collee-2.jpeg`… */
  nom: string;
  /** Fichier de l'archive. Une même image collée deux fois garde le même. */
  chemin: string;
}

/**
 * Texte d'un .docx, prêt pour l'analyseur de questions, et ses images
 * collées (question 84, choix a, 01/10/2026). Chaque image devient, à sa
 * place, une ligne « Image : image-collee-N.png » : l'analyseur la rattache
 * à la question en cours, comme une ligne écrite à la main, et le dépôt
 * enregistre le fichier qu'elle nomme.
 *
 * Word double souvent une image d'une version de repli (`mc:Fallback`),
 * pour les lecteurs anciens : elle n'est pas comptée. Un dessin sans image
 * (forme, graphique, zone de texte) ne donne aucune ligne.
 */
export function lireDocx(octets: Buffer): { texte: string; images: ImageCollee[] } {
  const xml = lireEntree(octets);
  let relations = new Map<string, string>();
  try {
    relations = relationsImages(lireEntree(octets, "word/_rels/document.xml.rels"));
  } catch {
    // Sans fichier de relations, aucune image ne se retrouve : le texte seul est lu.
  }
  const images: ImageCollee[] = [];
  const ligne = (id: string | undefined): string => {
    const chemin = id ? relations.get(id) : undefined;
    if (!chemin) return "";
    const extension = (/\.[a-z0-9]+$/i.exec(chemin)?.[0] ?? "").toLowerCase();
    const nom = `image-collee-${images.length + 1}${extension}`;
    images.push({ nom, chemin });
    return `<w:t>\nImage : ${nom}\n</w:t>`;
  };
  const marque = xml
    .replace(/<mc:Fallback\b[\s\S]*?<\/mc:Fallback>/g, "")
    .replace(/<w:drawing\b[\s\S]*?<\/w:drawing>/g, (d) => ligne(/\br:embed="([^"]+)"/.exec(d)?.[1]))
    .replace(/<w:pict\b[\s\S]*?<\/w:pict>/g, (d) => ligne(/<v:imagedata\b[^>]*\br:id="([^"]+)"/.exec(d)?.[1]));
  return { texte: xmlEnTexte(marque), images };
}
