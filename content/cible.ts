import { ORDRE_NIVEAUX } from "./tirage";
import type { NiveauQuestion } from "./types";
import { LIBELLES_NIVEAU_QUESTION, compteDeNiveau, plafondEnPhrase, type LibellesNiveaux } from "./niveaux-questions";

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
  /**
   * Question 74 (choix c, 24/09/2026) : questions de la banque, sous le
   * plafond, que leurs étiquettes réservent à d'autres profils et que le
   * tirage n'a donc pas pu poser ; absent à zéro et dans les résultats
   * antérieurs. `filiere` : libellé de la filière du profil de tirage,
   * `null` si elle n'était pas précisée.
   */
  horsProfil?: number;
  filiere?: string | null;
  /**
   * Question 81 (choix a, 26/09/2026) : les noms des niveaux de question au
   * moment de l'évaluation, s'ils n'étaient plus ceux d'origine ; absent,
   * ce sont ceux d'origine. Le rapport se relit avec eux, même renommés
   * depuis.
   */
  noms?: LibellesNiveaux;
}

/** « Niveau cible N2 : questions initiales et intermédiaires. Posées : 4 initiales, 6 intermédiaires ; 2 obligatoires. » */
export function libelleCible(c: CibleScellee): string {
  const l = c.noms ?? LIBELLES_NIVEAU_QUESTION;
  const tete = `Niveau cible ${c.niveau ?? "non précisé"} : ${plafondEnPhrase(c.plafond, l)}`;
  const posees = [...ORDRE_NIVEAUX, "a_preciser" as const]
    .filter((n) => (c.parNiveau[n] ?? 0) > 0)
    .map((n) => compteDeNiveau(n, c.parNiveau[n], l))
    .join(", ");
  const obligatoires = c.obligatoires > 0 ? ` ; ${c.obligatoires} obligatoire${c.obligatoires > 1 ? "s" : ""}` : "";
  const n = c.horsProfil ?? 0;
  const horsProfil =
    n > 0
      ? ` ${n} question${n > 1 ? "s" : ""} étiquetée${n > 1 ? "s" : ""} pour d'autres profils non tirée${n > 1 ? "s" : ""} (profil : ${c.filiere ?? "filière non précisée"}, ${c.niveau ?? "niveau non précisé"}).`
      : "";
  return `${tete}. Posées : ${posees || "aucune"}${obligatoires}.${horsProfil}`;
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
