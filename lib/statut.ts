/**
 * Statut du dispositif — décision du 18/09/2026 (question 7, choix b) : le
 * rapport d'évaluation est une preuve opposable de l'étape 2 (évaluation des
 * connaissances) au dossier d'habilitation, en audit BPP 2023 et ISO 9001. Il
 * ne vaut jamais habilitation : les étapes 3 à 6 se déroulent hors du site.
 *
 * Ce que le code garantit : la mention sur chaque écran et chaque rapport, la
 * référence de la procédure interne (`PROCEDURE_HABILITATION`), des dates à
 * l'horloge du serveur (ISO 8601 en UTC dans les archives, heure de Paris à
 * l'affichage), l'empreinte, le registre et le journal. Ce qu'il ne garantit
 * pas et qui reste à établir hors du site : la source de temps de
 * l'hébergeur, la durée de référence de conservation, les sauvegardes, la
 * procédure elle-même — voir `docs/QUESTIONS-OUVERTES.md`, point A.3.
 *
 * Module sans dépendance serveur : lu par le constructeur de rapport, côté
 * navigateur comme côté serveur.
 */
export const STATUT_DISPOSITIF = {
  court: "Document qualité — preuve de l'étape 2",
  long: "preuve opposable de l'étape 2 de l'habilitation (évaluation des connaissances) en audit BPP 2023 et ISO 9001",
  decideLe: "18/09/2026",
} as const;

export const PROCEDURE_A_COMPLETER = "[à compléter]";

/** Référence affichée de la procédure interne ; le marqueur reste visible tant qu'elle n'est pas renseignée. */
export function libelleProcedure(reference: string | null | undefined): string {
  const r = (reference ?? "").trim();
  return r || PROCEDURE_A_COMPLETER;
}
