import type { AuteurQuestion } from "./quatre-yeux";

/**
 * Fiche de synthèse d'un module (questions 59 et 60, choix a, 23/09/2026).
 *
 * Une fiche se dépose depuis la banque du module, entre « à vérifier » comme
 * une question, et n'est montrée à l'apprenant qu'une fois validée par un
 * autre code que son auteur — ou par lui, s'il est d'administration,
 * validation alors tracée. Le rapport d'évaluation cite la fiche montrée.
 * Une fiche déposée avant la règle reste montrée : elle est « validée
 * d'office », sans validateur.
 *
 * Fichier pur : ce qui se dit d'une fiche, le même partout — banque,
 * rapport, écran des signalements.
 */

export type StatutFiche = "a_verifier" | "valide" | "retire";

export const LIBELLES_STATUT_FICHE: Record<StatutFiche, string> = {
  a_verifier: "À vérifier",
  valide: "Validée",
  retire: "Retirée",
};

/** Jour de la règle : une fiche validée sans validateur a été déposée avant lui. */
export const DATE_REGLE_FICHES = "23/09/2026";

/** Auteur courant d'une fiche, pour la règle des quatre yeux : son déposant, ou le dernier code qui l'a corrigée. */
export function auteurDeFiche(f: {
  depose_par: string;
  depose_par_acces: number | null;
  edite_par: string | null;
  edite_par_acces: number | null;
}): AuteurQuestion {
  return { cree_par: f.depose_par, cree_par_acces: f.depose_par_acces, edite_par: f.edite_par, edite_par_acces: f.edite_par_acces };
}

function dateCourte(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" });
}

/**
 * Validation d'une fiche, en clair : « validée le 23/09/2026 par admin · X »,
 * suivi de « (son auteur) » quand l'administration a validé sa propre fiche ;
 * sans validateur, « validée d'office », la fiche datant d'avant la règle.
 */
export function mentionValidation(f: {
  valideeLe?: string | null;
  valideePar?: string | null;
  valideeParAuteur?: boolean;
  deposeeLe?: string | null;
}): string {
  if (!f.valideePar) {
    return `validée d'office : déposée${f.deposeeLe ? ` le ${dateCourte(f.deposeeLe)}` : ""}, avant la règle du ${DATE_REGLE_FICHES}`;
  }
  return `validée${f.valideeLe ? ` le ${dateCourte(f.valideeLe)}` : ""} par ${f.valideePar}${f.valideeParAuteur ? " (son auteur)" : ""}`;
}

/** Identifiant d'une fiche déposée tel que l'écran l'emploie (« depot-12 ») → numéro en base. */
export function numeroDeFiche(id: string): number | null {
  const m = /^depot-(\d{1,9})$/.exec(id);
  return m ? Number(m[1]) : null;
}
