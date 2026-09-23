/** Motifs fermés d'un signalement de question — repris du Lecteur QIM · QCM. Fichier pur. */
export const MOTIFS_SIGNALEMENT = [
  "Ambigu",
  "Erreur de corrigé",
  // Question 54 (a + b, 23/09/2026) : une question juste en son temps, que
  // la référence ou la pratique a dépassée — la révision, à côté de l'erreur.
  "À mettre à jour (référence ou pratique périmée)",
  "Hors programme",
  "Faute de frappe",
  "Doublon",
  "Autre",
] as const;

export type MotifSignalement = (typeof MOTIFS_SIGNALEMENT)[number];

/** Statuts tels que la base les écrit, sans accent (contrainte CHECK), et tels qu'on les lit. */
export const LIBELLES_STATUT_SIGNALEMENT: Record<"ouvert" | "traite" | "rejete", string> = {
  ouvert: "Ouvert",
  traite: "Traité",
  rejete: "Rejeté",
};
