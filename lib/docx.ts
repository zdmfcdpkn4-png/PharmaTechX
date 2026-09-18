import { inflateRawSync } from "node:zlib";

/**
 * Lecture native d'un .docx côté serveur — reprise du Lecteur QIM · QCM :
 * archive zip → `word/document.xml` → un paragraphe Word par ligne. Aucune
 * dépendance : le répertoire central du zip est lu à la main, l'entrée est
 * décompressée par `node:zlib`.
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

/** Extrait un fichier de l'archive (par défaut `word/document.xml`). */
export function lireEntree(b: Buffer, nom = "word/document.xml"): string {
  const e = lireCentral(b).find((x) => x.nom === nom);
  if (!e) throw new Error(`Fichier ${nom} absent de l'archive`);
  const lNom = b.readUInt16LE(e.offsetLocal + 26);
  const lExtra = b.readUInt16LE(e.offsetLocal + 28);
  const debut = e.offsetLocal + 30 + lNom + lExtra;
  const brut = b.subarray(debut, debut + e.tailleCompressee);
  const donnees = e.methode === 0 ? brut : inflateRawSync(brut);
  return donnees.toString("utf8");
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

/** document.xml → texte, un paragraphe Word par ligne. */
export function xmlEnTexte(xml: string): string {
  const paras = xml.match(/<w:p[ >][\s\S]*?<\/w:p>/g) ?? [];
  return paras
    .map((p) => {
      const morceaux =
        p
          .replace(/<w:tab\b[^>]*\/>/g, "<w:t>\t</w:t>")
          .replace(/<w:br\b[^>]*\/>/g, "<w:t> </w:t>")
          .match(/<w:t(?:\s[^>]*)?>[\s\S]*?<\/w:t>/g) ?? [];
      return deXml(
        morceaux.map((m) => m.replace(/^<w:t(?:\s[^>]*)?>/, "").replace(/<\/w:t>$/, "")).join(""),
      ).trim();
    })
    .join("\n");
}

/** Texte d'un .docx, prêt pour l'analyseur de questions. */
export function texteDocx(octets: Buffer): string {
  return xmlEnTexte(lireEntree(octets));
}
