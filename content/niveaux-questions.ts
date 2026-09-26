import type { NiveauQuestion } from "./types";

/**
 * Noms des trois niveaux de question (question 81, choix a, 26/09/2026) :
 * libellé et définition se renomment depuis Squelette de la formation ›
 * Niveaux des questions. Leur nombre reste trois : le tirage (plafonds,
 * répartitions) et le barème sont bâtis sur trois, et les valeurs rangées en
 * base (`initial`, `intermediaire`, `avance`) ne changent pas.
 *
 * - Le dépôt de questions et le prompt gardent les mots-clés d'origine
 *   (initial, intermédiaire, avancé) : un fichier préparé avant un
 *   renommage s'importe toujours.
 * - Les libellés en vigueur sont copiés dans le résultat scellé d'une
 *   évaluation (`CibleScellee.noms`) quand ils diffèrent de ceux d'origine :
 *   un rapport se relit avec les noms de son époque.
 * - Tant que les trois libellés sont ceux d'origine, les phrases gardent leur
 *   tournure (« questions initiales et intermédiaires ») ; un seul renommé,
 *   elles citent chaque niveau par son nom, entre guillemets, pour qu'aucun
 *   accord ne dépende d'un mot choisi à l'écran.
 *
 * Module pur, sans import à l'exécution : `types.ts`, `tirage.ts` et
 * `bareme.ts` le lisent sans cycle.
 */

const ORDRE: readonly NiveauQuestion[] = ["initial", "intermediaire", "avance"];

export const LIBELLES_NIVEAU_QUESTION: Record<NiveauQuestion, string> = {
  initial: "Initial",
  intermediaire: "Intermédiaire",
  avance: "Avancé",
};

/** Ce que chaque palier évalue — repris du prompt de génération. */
export const DEFINITIONS_NIVEAU_QUESTION: Record<NiveauQuestion, string> = {
  initial: "restitution",
  intermediaire: "reformulation, comparaison",
  avance: "raisonnement, piège",
};

export interface NomNiveauQuestion {
  libelle: string;
  definition: string;
}
export type NomsNiveauxQuestions = Record<NiveauQuestion, NomNiveauQuestion>;
/** Les seuls libellés, tels qu'un résultat scellé les garde. */
export type LibellesNiveaux = Record<NiveauQuestion, string>;

export const NOMS_NIVEAUX_DEFAUT: NomsNiveauxQuestions = {
  initial: { libelle: LIBELLES_NIVEAU_QUESTION.initial, definition: DEFINITIONS_NIVEAU_QUESTION.initial },
  intermediaire: { libelle: LIBELLES_NIVEAU_QUESTION.intermediaire, definition: DEFINITIONS_NIVEAU_QUESTION.intermediaire },
  avance: { libelle: LIBELLES_NIVEAU_QUESTION.avance, definition: DEFINITIONS_NIVEAU_QUESTION.avance },
};

export const LIMITES_NOMS_NIVEAUX = { libelle: 40, definition: 120 } as const;

function texte(v: unknown, max: number): string {
  return typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

/** Noms complets à partir d'une valeur quelconque : un champ vide ou absent reprend sa valeur d'origine. */
export function normaliserNomsNiveaux(brut: unknown): NomsNiveauxQuestions {
  const b = brut && typeof brut === "object" ? (brut as Record<string, unknown>) : {};
  const out = {} as NomsNiveauxQuestions;
  for (const n of ORDRE) {
    const x = b[n] && typeof b[n] === "object" ? (b[n] as Record<string, unknown>) : {};
    out[n] = {
      libelle: texte(x.libelle, LIMITES_NOMS_NIVEAUX.libelle) || NOMS_NIVEAUX_DEFAUT[n].libelle,
      definition: texte(x.definition, LIMITES_NOMS_NIVEAUX.definition) || NOMS_NIVEAUX_DEFAUT[n].definition,
    };
  }
  return out;
}

export function libellesDe(noms: NomsNiveauxQuestions): LibellesNiveaux {
  return { initial: noms.initial.libelle, intermediaire: noms.intermediaire.libelle, avance: noms.avance.libelle };
}

export function sontLesNomsDefaut(noms: NomsNiveauxQuestions): boolean {
  return ORDRE.every(
    (n) => noms[n].libelle === NOMS_NIVEAUX_DEFAUT[n].libelle && noms[n].definition === NOMS_NIVEAUX_DEFAUT[n].definition,
  );
}

/** Les trois libellés d'origine : les phrases gardent alors leur tournure. */
export function libellesClassiques(l: LibellesNiveaux): boolean {
  return ORDRE.every((n) => l[n] === LIBELLES_NIVEAU_QUESTION[n]);
}

const cle = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/** Deux niveaux au même nom, casse et accents mis à part : l'écran ne saurait plus les distinguer. */
export function nomsEnDouble(l: LibellesNiveaux): boolean {
  return new Set(ORDRE.map((n) => cle(l[n]))).size < ORDRE.length;
}

/** Ce que chaque plafond laisse tirer, dans une phrase, avec les noms d'origine. */
export const LIBELLES_PLAFOND: Record<NiveauQuestion, string> = {
  initial: "questions initiales seulement",
  intermediaire: "questions initiales et intermédiaires",
  avance: "questions de tous niveaux",
};

/** Libellés courts des plafonds pour les listes : les phrases entières y étaient tronquées sur trois colonnes. */
const PLAFONDS_COURTS: Record<NiveauQuestion, string> = {
  initial: "Initiales seulement",
  intermediaire: "Initiales et intermédiaires",
  avance: "Tous niveaux",
};

const entre = (s: string) => `« ${s} »`;

/** « questions initiales et intermédiaires », ou « questions de niveau « A » et « B » » une fois les noms changés. */
export function plafondEnPhrase(p: NiveauQuestion, l: LibellesNiveaux = LIBELLES_NIVEAU_QUESTION): string {
  if (libellesClassiques(l)) return LIBELLES_PLAFOND[p];
  if (p === "initial") return `questions de niveau ${entre(l.initial)} seulement`;
  if (p === "intermediaire") return `questions de niveau ${entre(l.initial)} et ${entre(l.intermediaire)}`;
  return LIBELLES_PLAFOND.avance;
}

/** Le plafond dans une liste de choix : « Initiales seulement », ou « « A » seulement ». */
export function plafondCourt(p: NiveauQuestion, l: LibellesNiveaux = LIBELLES_NIVEAU_QUESTION): string {
  if (libellesClassiques(l)) return PLAFONDS_COURTS[p];
  if (p === "initial") return `${entre(l.initial)} seulement`;
  if (p === "intermediaire") return `${entre(l.initial)} et ${entre(l.intermediaire)}`;
  return PLAFONDS_COURTS.avance;
}

/** Un niveau au fil d'une phrase : « initial », ou « « A » ». */
export function nomDansPhrase(n: NiveauQuestion, l: LibellesNiveaux = LIBELLES_NIVEAU_QUESTION): string {
  return libellesClassiques(l) ? LIBELLES_NIVEAU_QUESTION[n].toLowerCase() : entre(l[n]);
}

const ACCORDS: Record<NiveauQuestion, [string, string]> = {
  initial: ["initiale", "initiales"],
  intermediaire: ["intermédiaire", "intermédiaires"],
  avance: ["avancée", "avancées"],
};

/** « 4 initiales », ou « 4 de niveau « A » » ; `a_preciser` : « 2 sans niveau ». */
export function compteDeNiveau(
  n: NiveauQuestion | "a_preciser",
  k: number,
  l: LibellesNiveaux = LIBELLES_NIVEAU_QUESTION,
): string {
  if (n === "a_preciser") return `${k} sans niveau`;
  return libellesClassiques(l) ? `${k} ${ACCORDS[n][k > 1 ? 1 : 0]}` : `${k} de niveau ${entre(l[n])}`;
}
