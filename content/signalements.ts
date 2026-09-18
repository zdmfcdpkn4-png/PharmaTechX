/** Motifs fermés d'un signalement de question — repris du Lecteur QIM · QCM. Fichier pur. */
export const MOTIFS_SIGNALEMENT = [
  "Ambigu",
  "Erreur de corrigé",
  "Hors programme",
  "Faute de frappe",
  "Doublon",
  "Autre",
] as const;

export type MotifSignalement = (typeof MOTIFS_SIGNALEMENT)[number];
