/**
 * Programmes à la carte : le parcours dégradé.
 *
 * Tranché en deux temps. Le 18/09/2026 (question 36, choix b), un parcours
 * nommé, composé à la main, pour les cas qui ne suivent pas la fiche —
 * intérimaire, remplaçant —, marqué « dégradé » partout où il apparaît. Le
 * 22/09/2026 (question 50, réponse libre) : « pour un profil dégradé, pouvoir
 * faire un programme de modules à la carte validé par le tuteur ou l'admin ».
 *
 * Un programme se compose en choisissant les modules un à un, dans l'ordre
 * voulu, indépendamment de leurs filières et de leurs niveaux. Il ne remplace
 * pas la fiche d'habilitation : c'est un écart assumé, nommé, motivé et
 * validé — et il le dit à chaque endroit où il paraît.
 *
 * Règles :
 *  - un programme naît **brouillon** : les postes ne le voient pas ;
 *  - il est **validé** par un code de tutorat ou d'administration, nommé à
 *    côté du programme ; il faut pour cela un nom, un motif et un module ;
 *  - toute modification le **renvoie en brouillon** : un programme validé ne
 *    change pas en silence, il se revalide ;
 *  - **retiré**, il disparaît des postes ; il ne se supprime pas, pour que ce
 *    qui a été proposé reste lisible.
 *
 * Module pur : testable sans base.
 */

export type StatutProgramme = "brouillon" | "valide" | "retire";

export const LIBELLES_STATUT_PROGRAMME: Record<StatutProgramme, string> = {
  brouillon: "Brouillon — invisible des postes",
  valide: "Validé — proposé aux postes",
  retire: "Retiré",
};

/** La mention qui accompagne un programme à la carte partout où il paraît. */
export const MENTION_DEGRADE = "parcours dégradé";

/** Au-delà, ce n'est plus un programme à la carte mais une seconde fiche. */
export const MAX_MODULES_PROGRAMME = 120;

export interface Programme {
  id: number;
  nom: string;
  /** Pour qui : « préparateur intérimaire, trois mois ». */
  destinataire: string;
  /** Pourquoi ce programme s'écarte de la fiche. Exigé pour valider. */
  motif: string;
  /** Identifiants des modules, dans l'ordre du programme. */
  modules: string[];
  statut: StatutProgramme;
  creePar: string;
  creeLe: string;
  modifiePar: string | null;
  modifieLe: string | null;
  /** « Tutorat · libellé du code » ; `null` tant qu'il n'est pas validé. */
  validePar: string | null;
  valideLe: string | null;
}

export function lireIdProgramme(brut: unknown): number | null {
  const n = typeof brut === "number" ? brut : typeof brut === "string" && /^\d{1,9}$/.test(brut.trim()) ? Number(brut) : NaN;
  return Number.isInteger(n) && n > 0 ? n : null;
}

export function estStatutProgramme(v: unknown): v is StatutProgramme {
  return v === "brouillon" || v === "valide" || v === "retire";
}

/**
 * Ordre d'un programme saisi au formulaire : les modules cochés, connus
 * seulement, sans doublon, rangés par le rang saisi ; à rang égal ou sans
 * rang, dans l'ordre de la liste (celui de la fiche). Un module sans rang
 * passe après ceux qui en ont un.
 */
export function ordonnerProgramme(
  coches: readonly unknown[],
  rangs: Record<string, unknown>,
  ordreListe: readonly string[],
): string[] {
  const place = new Map(ordreListe.map((id, i) => [id, i]));
  const vus = new Set<string>();
  const retenus: { id: string; rang: number; place: number }[] = [];
  for (const brut of coches) {
    if (typeof brut !== "string" || !place.has(brut) || vus.has(brut)) continue;
    vus.add(brut);
    const r = Number(rangs[brut]);
    retenus.push({ id: brut, rang: Number.isInteger(r) && r > 0 ? r : Number.MAX_SAFE_INTEGER, place: place.get(brut)! });
  }
  return retenus
    .sort((a, b) => a.rang - b.rang || a.place - b.place)
    .slice(0, MAX_MODULES_PROGRAMME)
    .map((x) => x.id);
}

/** Ce qui manque pour valider ; vide si le programme peut l'être. */
export function manquesPourValider(p: Pick<Programme, "nom" | "motif" | "modules">): string[] {
  const manques: string[] = [];
  if (!p.nom.trim()) manques.push("un nom");
  if (!p.motif.trim()) manques.push("le motif de l'écart à la fiche");
  if (p.modules.length === 0) manques.push("au moins un module");
  return manques;
}

/** Validation possible depuis ce statut : un brouillon complet seulement. */
export function peutValiderProgramme(p: Pick<Programme, "statut" | "nom" | "motif" | "modules">): boolean {
  return p.statut === "brouillon" && manquesPourValider(p).length === 0;
}

/**
 * Libellé d'un programme, tel qu'il paraît à l'accueil et sur le rapport
 * téléchargé : toujours avec la mention du parcours dégradé.
 */
export function libelleProgramme(p: Pick<Programme, "nom">): string {
  return `Programme à la carte « ${p.nom} » — ${MENTION_DEGRADE}`;
}

/**
 * Modules d'un programme retrouvés dans le catalogue du moment : un module
 * déposé puis retiré, ou dépublié, n'y est plus. Il est compté, pas deviné.
 */
export function modulesDuProgramme<T extends { id: string }>(
  p: Pick<Programme, "modules">,
  catalogue: readonly T[],
): { presents: T[]; absents: string[] } {
  const index = new Map(catalogue.map((m) => [m.id, m]));
  const presents: T[] = [];
  const absents: string[] = [];
  for (const id of p.modules) {
    const m = index.get(id);
    if (m) presents.push(m);
    else absents.push(id);
  }
  return { presents, absents };
}
