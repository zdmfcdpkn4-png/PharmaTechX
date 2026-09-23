import { LIBELLES_PLAFOND } from "./bareme";
import { ORDRE_NIVEAUX } from "./tirage";
import type { NiveauQuestion } from "./types";

/**
 * Tirage selon le niveau cible, scellé dans le résultat d'une évaluation
 * (questions 62 et 63, choix a, 23/09/2026) et cité par le rapport : ce que
 * le tirage a visé, ce qu'il a posé, ce qu'un signalement lui a retiré.
 * Module pur, partagé par l'écran de résultat et le rapport.
 */
export interface CibleScellee {
  /** Niveau d'habilitation visé ; `null` : non précisé, aucun plafond. */
  niveau: string | null;
  /** Niveau de question le plus élevé tiré. */
  plafond: NiveauQuestion;
  /** Questions posées par niveau ; `a_preciser` : sans niveau. */
  parNiveau: Record<NiveauQuestion | "a_preciser", number>;
  /** Obligatoires posées, éliminatoires non comprises. */
  obligatoires: number;
  /**
   * Éliminatoires et obligatoires qu'un signalement ouvert a écartées ;
   * `remplacee` : une question du même niveau a pris leur place — faux quand
   * la banque admise n'en offrait plus.
   */
  ecartees: { questionId: string; enonce: string; eliminatoire: boolean; remplacee: boolean }[];
}

const NOMS: Record<NiveauQuestion | "a_preciser", [string, string]> = {
  initial: ["initiale", "initiales"],
  intermediaire: ["intermédiaire", "intermédiaires"],
  avance: ["avancée", "avancées"],
  a_preciser: ["sans niveau", "sans niveau"],
};

/** « Niveau cible N2 : questions initiales et intermédiaires. Posées : 4 initiales, 6 intermédiaires ; 2 obligatoires. » */
export function libelleCible(c: CibleScellee): string {
  const tete = `Niveau cible ${c.niveau ?? "non précisé"} : ${LIBELLES_PLAFOND[c.plafond]}`;
  const posees = [...ORDRE_NIVEAUX, "a_preciser" as const]
    .filter((n) => (c.parNiveau[n] ?? 0) > 0)
    .map((n) => `${c.parNiveau[n]} ${NOMS[n][c.parNiveau[n] > 1 ? 1 : 0]}`)
    .join(", ");
  const obligatoires = c.obligatoires > 0 ? ` ; ${c.obligatoires} obligatoire${c.obligatoires > 1 ? "s" : ""}` : "";
  return `${tete}. Posées : ${posees || "aucune"}${obligatoires}.`;
}

/** Les questions toujours posées qu'un signalement a écartées, en une phrase ; vide s'il n'y en a pas. */
export function libelleEcartees(c: CibleScellee): string {
  if (c.ecartees.length === 0) return "";
  const pluriel = c.ecartees.length > 1 ? "s" : "";
  const liste = c.ecartees
    .map(
      (e) =>
        `« ${e.enonce.length > 120 ? `${e.enonce.slice(0, 120)}…` : e.enonce} » (${e.eliminatoire ? "éliminatoire" : "obligatoire"}, ${
          e.remplacee ? "remplacée par une question du même niveau" : "non remplacée : plus aucune question de ce niveau"
        })`,
    )
    .join(" ; ");
  return `Écartée${pluriel} du tirage par un signalement ouvert : ${liste}.`;
}
