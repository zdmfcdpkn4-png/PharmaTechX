import { STATUT_ESSAI } from "./statut";

/**
 * Mention de preuve à recopier dans la colonne « Outils / Preuve de
 * compétence » de la fiche d'habilitation.
 *
 * Tranché le 22/09/2026 (question 48, choix b). La colonne est la **seule**
 * interface entre le site et la fiche depuis la décision 47 : le site reste
 * aux étapes 1 et 2, le portfolio reste papier. La cellule sera lue par
 * quelqu'un qui n'a pas le site ouvert — un auditeur, le cadre, le
 * pharmacien deux ans plus tard : un numéro seul ne dirait ni ce qui a été
 * évalué, ni quand, ni avec quel résultat.
 *
 * Deux règles, et ce sont elles qui font la valeur de la mention :
 *
 * 1. **Seul un rapport clos en donne une.** Avant la clôture, l'arbitrage du
 *    tuteur peut encore changer le verdict. Une cellule recopiée trop tôt
 *    dans un document Word deviendrait fausse en silence, puisque le Word ne
 *    se met pas à jour.
 * 2. **L'empreinte n'y figure pas.** Elle a sa place sur le rapport, pas sur
 *    le renvoi : douze caractères hexadécimaux recopiés à la main sont une
 *    source d'erreur de transcription, et une empreinte mal recopiée ferait
 *    passer un rapport correct pour falsifié. Le chemin de vérification
 *    reste : retrouver le rapport par son numéro, y lire l'empreinte.
 *
 * Module sans dépendance serveur : lu des deux côtés.
 */

export interface SourceMention {
  numero: string;
  moduleTitre: string;
  /** Émission, en ISO : c'est la date de passation, celle qu'attend la fiche. */
  emisLe: string;
  statut: string;
  score: number;
  /** Verdict final, déjà mis en toutes lettres (`acquis`, `non acquis`…). */
  verdict: string;
}

/** Pourquoi un rapport ne donne pas de mention. */
export type RefusMention = "annule" | "non-clos";

export const LIBELLES_REFUS_MENTION: Record<RefusMention, string> = {
  annule: "Rapport annulé : il ne vaut aucune preuve.",
  "non-clos":
    "Mention disponible une fois le rapport clos : avant la clôture, l'arbitrage peut encore changer le verdict.",
};

export type Mention = { texte: string } | { refus: RefusMention };

/** « 22/09/2026 » à l'heure de Paris ; la valeur telle quelle si elle n'est pas lisible. */
export function dateDeMention(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" });
}

export function mentionDePreuve(
  s: SourceMention,
  options: { miseEnService?: string | null } = {},
): Mention {
  if (s.statut === "annule") return { refus: "annule" };
  if (s.statut !== "clos") return { refus: "non-clos" };
  const texte = [
    "PharmaTechX",
    s.numero,
    dateDeMention(s.emisLe),
    s.moduleTitre,
    `${s.score} %`,
    s.verdict,
  ].join(" — ");
  // Sans mise en service prononcée, le rapport lui-même porte « ne vaut pas
  // preuve » : la mention ne peut pas dire le contraire dans un document
  // qualité.
  return { texte: options.miseEnService ? texte : `${STATUT_ESSAI.court} — ${texte}` };
}
