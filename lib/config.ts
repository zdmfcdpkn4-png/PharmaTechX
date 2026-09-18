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
 * - `pseudonyme` : chaque rapport émis est enregistré sous un **identifiant
 *   d'agent** (AG-001…) créé par un tuteur ou l'administrateur, numéroté,
 *   scellé par une empreinte et soumis au circuit de visas (apprenant → tuteur
 *   → pharmacien). Aucun nom n'entre en base : la correspondance identifiant ↔
 *   agent est tenue par le pharmacien hors du site, et le nom n'est porté
 *   qu'à l'édition du rapport (impression, paquet d'archivage), sans être
 *   conservé. Décision du 18/09/2026 (question 6, choix a).
 *
 *   Un identifiant reste une donnée à caractère personnel au sens du RGPD
 *   (pseudonymisation, art. 4 § 5 et considérant 26) : le traitement figure au
 *   registre des traitements et les agents en sont informés — voir
 *   `docs/RGPD.md` et la page `/donnees-personnelles`.
 */
export type ModeConservation = "aucune" | "pseudonyme";

export function modeConservation(): ModeConservation {
  return process.env.CONSERVATION_RAPPORTS === "pseudonyme" ? "pseudonyme" : "aucune";
}

/** Les rapports émis sont enregistrés (mode `pseudonyme`). */
export function conservationActive(): boolean {
  return modeConservation() === "pseudonyme";
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

/**
 * Référence de la procédure interne qui encadre le dispositif (code et titre
 * dans le système documentaire), portée sur chaque écran et chaque rapport.
 * Décision du 18/09/2026 (question 7, choix b) : le rapport est une preuve
 * opposable de l'étape 2 ; sans référence, le marqueur [à compléter] reste
 * affiché — voir `lib/statut.ts`.
 */
export function procedureReference(): string | null {
  const r = (process.env.PROCEDURE_HABILITATION ?? "").trim();
  return r || null;
}

/** Nom de l'établissement et de l'unité, tels qu'ils figurent sur les rapports. */
export const ETABLISSEMENT = "CHD Vendée — Pharmacie à usage intérieur, unité de pharmacotechnie";
