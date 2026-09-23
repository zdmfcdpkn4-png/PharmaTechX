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

/**
 * Motifs fermés d'un signalement de fiche de synthèse (question 60, choix a,
 * 23/09/2026) : ce qui peut clocher dans un document, pas dans une question.
 */
export const MOTIFS_SIGNALEMENT_FICHE = [
  "Erreur de contenu",
  "À mettre à jour (référence ou pratique périmée)",
  "Fichier illisible ou qui ne s'ouvre pas",
  "Autre",
] as const;

/** Statuts tels que la base les écrit, sans accent (contrainte CHECK), et tels qu'on les lit. */
export const LIBELLES_STATUT_SIGNALEMENT: Record<"ouvert" | "traite" | "rejete", string> = {
  ouvert: "Ouvert",
  traite: "Traité",
  rejete: "Rejeté",
};
