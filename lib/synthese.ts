import "server-only";
import { baseConfiguree, depotsDuModule, typesFichiers } from "./db";
import type { Module, SyntheseDocument } from "@/content/types";

/**
 * Documents de synthèse d'un module (nature « synthese ») : ressources du
 * code puis documents déposés. Un PDF ou une image s'affichent en ligne en
 * fin de test ; le type d'un fichier conservé en base est lu dans la table
 * `fichiers`, celui d'une adresse externe est deviné à l'extension.
 *
 * Depuis le 23/09/2026 (question 59, choix a), seules les fiches validées en
 * sortent — `depotsDuModule` ne rend que celles-là —, avec leur validation :
 * le résultat d'une évaluation les scelle, et le rapport les cite.
 */

/** Date lue en base (texte PostgreSQL) → ISO 8601 ; `null` si absente ou illisible. */
function iso(texte: string | null): string | null {
  if (!texte) return null;
  const d = new Date(texte);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

const FICHIER_BASE = /^\/api\/fichiers\/([^/?#]+)/;

function affichageParExtension(url: string): SyntheseDocument["affichage"] {
  const u = url.toLowerCase().split(/[?#]/)[0];
  if (u.endsWith(".pdf")) return "pdf";
  if (/\.(png|jpe?g|gif|webp|svg)$/.test(u)) return "image";
  return "lien";
}

function affichageParType(type: string): SyntheseDocument["affichage"] {
  if (type === "application/pdf") return "pdf";
  if (type.startsWith("image/")) return "image";
  return "lien";
}

export async function syntheseDuModule(mod: Module): Promise<SyntheseDocument[]> {
  const docs: SyntheseDocument[] = mod.ressources
    .filter((r) => r.nature === "synthese" && r.url)
    .map((r) => ({ id: r.id, titre: r.titre, url: r.url as string, affichage: affichageParExtension(r.url as string) }));
  if (!baseConfiguree()) return docs;
  const depots = (await depotsDuModule(mod.id).catch(() => [])).filter((d) => d.nature === "synthese");
  const ids = depots.map((d) => FICHIER_BASE.exec(d.url)?.[1]).filter((x): x is string => Boolean(x));
  const types = await typesFichiers(ids).catch(() => ({}) as Record<string, string>);
  for (const d of depots) {
    const id = FICHIER_BASE.exec(d.url)?.[1];
    const type = id ? types[id] : undefined;
    docs.push({
      id: `depot-${d.id}`,
      titre: d.titre,
      url: d.url,
      affichage: type ? affichageParType(type) : affichageParExtension(d.url),
      deposeeLe: iso(d.depose_le),
      valideeLe: iso(d.valide_le),
      valideePar: d.valide_par,
      valideeParAuteur: d.valide_par_auteur,
    });
  }
  return docs;
}
