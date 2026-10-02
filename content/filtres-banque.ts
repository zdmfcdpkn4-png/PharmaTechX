/**
 * Recherche et tri de la banque de questions (02/10/2026, question 89, lot 2).
 * Calculs purs : la page les applique, la fenêtre « Poser aussi dans » cherche
 * ses modules de la même façon, les tests les vérifient.
 */

/** Texte comparé sans casse ni accents, espaces resserrés. */
export function normaliserRecherche(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Les mots cherchés : chacun doit se trouver dans le texte, dans n'importe quel ordre. */
export function motsRecherche(terme: string): string[] {
  return normaliserRecherche(terme).split(" ").filter(Boolean);
}

export function texteCorrespond(texte: string, mots: readonly string[]): boolean {
  if (mots.length === 0) return true;
  const t = normaliserRecherche(texte);
  return mots.every((m) => t.includes(m));
}

/** Au plus autant de caractères cherchés. */
export const RECHERCHE_MAX = 100;

/** Ce que la recherche lit d'une question. */
export interface QuestionCherchable {
  id: string;
  enonce: string;
  options: readonly { texte: string; justification?: string }[];
  justification: string;
  legendes: readonly { attendu: string }[];
}

/**
 * La recherche lit l'énoncé, les propositions et leur justification (question
 * 85), la justification de la question, les mots attendus d'un schéma — ses
 * propositions — et l'identifiant.
 */
export function questionCorrespond(q: QuestionCherchable, mots: readonly string[]): boolean {
  if (mots.length === 0) return true;
  return texteCorrespond(
    [
      q.id,
      q.enonce,
      q.justification,
      ...q.options.flatMap((o) => [o.texte, o.justification ?? ""]),
      ...q.legendes.map((l) => l.attendu),
    ].join(" "),
    mots,
  );
}

export type TriBanque = "" | "recentes" | "modifiees" | "enonce";

/** Tris proposés ; le premier, l'ordre de toujours, est celui par défaut. Chaque module garde ses questions ensemble. */
export const TRIS_BANQUE: readonly { code: TriBanque; libelle: string }[] = [
  { code: "", libelle: "Ordre de dépôt" },
  { code: "recentes", libelle: "Plus récentes d'abord" },
  { code: "modifiees", libelle: "Dernières modifiées d'abord" },
  { code: "enonce", libelle: "Énoncé, de A à Z" },
];

export function lireTri(brut: unknown): TriBanque {
  return TRIS_BANQUE.some((t) => t.code !== "" && t.code === brut) ? (brut as TriBanque) : "";
}

/**
 * Questions triées, sans toucher à la liste reçue. Les dates sont celles de la
 * base, en texte au même format : l'ordre des chaînes est celui des instants.
 * À égalité, l'ordre de dépôt.
 */
export function trierQuestions<T extends { cree_le: string; edite_le: string; enonce: string }>(
  liste: readonly T[],
  tri: TriBanque,
): T[] {
  const copie = [...liste];
  if (tri === "recentes") return copie.sort((a, b) => (a.cree_le < b.cree_le ? 1 : a.cree_le > b.cree_le ? -1 : 0));
  if (tri === "modifiees") return copie.sort((a, b) => (a.edite_le < b.edite_le ? 1 : a.edite_le > b.edite_le ? -1 : 0));
  if (tri === "enonce") {
    return copie.sort((a, b) => a.enonce.localeCompare(b.enonce, "fr", { sensitivity: "base", numeric: true }));
  }
  return copie;
}
