/**
 * Réglages d'exploitation lus dans l'environnement. Regroupés ici pour que
 * chaque décision d'exploitation soit visible d'un coup d'œil et documentée
 * dans `.env.example`.
 */

/**
 * Conservation des rapports d'évaluation.
 *
 * - `aucune` (défaut) : rien n'est enregistré côté serveur. Le rapport est
 *   construit sur le poste de l'apprenant, imprimé et signé sur papier.
 *   C'est l'état livré par la conception initiale (« rien de nominatif »).
 * - `nominative` : chaque rapport émis est enregistré avec le nom saisi par
 *   l'apprenant, numéroté, scellé par une empreinte et soumis au circuit de
 *   visas (apprenant → tuteur → pharmacien). Ce mode traite des données à
 *   caractère personnel d'agents : il suppose une inscription au registre des
 *   traitements, une durée de conservation et une information des agents.
 *   Décision du pharmacien responsable : [à préciser].
 */
export type ModeConservation = "aucune" | "nominative";

export function modeConservation(): ModeConservation {
  return process.env.CONSERVATION_RAPPORTS === "nominative" ? "nominative" : "aucune";
}

export function conservationNominative(): boolean {
  return modeConservation() === "nominative";
}

/**
 * Durée de conservation annoncée sur les rapports, en mois — facultative.
 * Décision du 18/09/2026 : aucune purge automatique ; l'administrateur purge
 * manuellement depuis `/admin/rapports`. Cette valeur n'est qu'une annonce.
 */
export function dureeConservationMois(): number | null {
  const n = Number(process.env.RAPPORTS_CONSERVATION_MOIS);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Nom de l'établissement et de l'unité, tels qu'ils figurent sur les rapports. */
export const ETABLISSEMENT = "CHD Vendée — Pharmacie à usage intérieur, unité de pharmacotechnie";
