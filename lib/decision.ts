/**
 * Décision d'une évaluation — transposition de la règle de la console de
 * vérification métrologique (README de portage, § 8) :
 *
 *   |b| + U ≤ EMT  → conforme ;  |b| − U > EMT → non conforme ;  sinon
 *   indéterminé, tranché par une décision humaine explicite et motivée. Sous
 *   un taux d'appariement minimal, l'outil refuse de conclure (non concluant).
 *
 * Ici la mesure est le score, la limite est le seuil de réussite, et
 * l'« incertitude » est la bande de garde : par défaut le poids d'une question
 * du tirage (100 / n points), réglable (demi-question, ou largeur fixe) :
 *
 *   score − bande ≥ seuil → acquis
 *   score + bande < seuil → non acquis
 *   sinon                 → indéterminé, arbitrage du tuteur au visa
 *
 * Un échec sur une question éliminatoire vaut non acquis sans arbitrage
 * possible. Un tirage de moins de `MIN_QUESTIONS_HABILITATION` questions est
 * non concluant : il n'ouvre aucun rapport d'habilitation.
 *
 * Ce module ne dépend de rien : il sert au serveur (correction, rapports,
 * registre) comme au navigateur (affichage du résultat, rapport téléchargé).
 */

import { largeurBande, type BandeGarde } from "../content/bareme";

export type Verdict = "acquis" | "non_acquis" | "indetermine" | "non_concluant";

/** Taille minimale d'un tirage concluant — la taille du tirage d'habilitation. [à préciser] */
export const MIN_QUESTIONS_HABILITATION = 10;

export interface QuestionNotee {
  questionId: string;
  note: number;
  eliminatoire: boolean;
  correct: boolean;
  /** Poids de la question (plafond du barème) ; 1 si absent — résultats scellés avant la refonte. */
  max?: number;
}

export interface Decision {
  /** Questions comptées, après exclusions. */
  nbQuestions: number;
  nbExclues: number;
  pointsObtenus: number;
  pointsTotal: number;
  /** Score en pourcentage, arrondi à l'entier. */
  score: number;
  seuil: number;
  /** Largeur de la bande de garde en points de pourcentage : par défaut le poids d'une question. */
  bande: number;
  /** Bornes affichables de la bande (scores entiers donnant un verdict indéterminé). */
  bandeBasse: number;
  bandeHaute: number;
  echecEliminatoire: boolean;
  concluant: boolean;
  minQuestions: number;
  verdictBrut: Verdict;
}

export interface OptionsDecision {
  /** Identifiants des questions exclues du calcul (retirées de la banque après signalement). */
  exclues?: string[];
  minQuestions?: number;
  /** Largeur de la bande de garde (barème en vigueur à l'évaluation) ; défaut : le poids d'une question. */
  bande?: BandeGarde;
}

export function decider(detail: QuestionNotee[], seuil: number, options: OptionsDecision = {}): Decision {
  const exclues = new Set(options.exclues ?? []);
  const minQuestions = options.minQuestions ?? MIN_QUESTIONS_HABILITATION;
  const retenues = detail.filter((d) => !exclues.has(d.questionId));
  const nbQuestions = retenues.length;
  // Le total suit le plafond de chaque question : un format peut peser moins
  // qu'un autre (barème harmonisé, question 34). 1 par défaut.
  const pointsTotal = Math.round(retenues.reduce((s, d) => s + (d.max ?? 1), 0) * 100) / 100;
  const pointsObtenus = Math.round(retenues.reduce((s, d) => s + d.note, 0) * 100) / 100;
  const score = pointsTotal === 0 ? 0 : Math.round((pointsObtenus / pointsTotal) * 100);
  const bande = largeurBande(nbQuestions, options.bande);
  const echecEliminatoire = retenues.some((d) => d.eliminatoire && !d.correct);
  const concluant = nbQuestions >= minQuestions;

  let verdictBrut: Verdict;
  if (!concluant) verdictBrut = "non_concluant";
  else if (echecEliminatoire) verdictBrut = "non_acquis";
  else if (score - bande >= seuil) verdictBrut = "acquis";
  else if (score + bande < seuil) verdictBrut = "non_acquis";
  else verdictBrut = "indetermine";

  // Bornes entières de la zone indéterminée : le plus petit score qui n'est
  // pas « non acquis » et le plus grand qui n'est pas « acquis ».
  const bandeBasse = Math.max(0, Math.ceil(seuil - bande));
  const bandeHaute = Math.min(100, Math.ceil(seuil + bande) - 1);

  return {
    nbQuestions,
    nbExclues: detail.length - nbQuestions,
    pointsObtenus,
    pointsTotal,
    score,
    seuil,
    bande: Math.round(bande * 10) / 10,
    bandeBasse,
    bandeHaute,
    echecEliminatoire,
    concluant,
    minQuestions,
    verdictBrut,
  };
}

export interface ArbitrageVerdict {
  verdict: "acquis" | "non_acquis";
}

/** Verdict retenu : l'arbitrage ne s'applique qu'à un verdict brut indéterminé. */
export function verdictFinal(d: Pick<Decision, "verdictBrut">, arbitrage?: ArbitrageVerdict | null): Verdict {
  if (d.verdictBrut === "indetermine" && arbitrage) return arbitrage.verdict;
  return d.verdictBrut;
}

export const LIBELLES_VERDICT: Record<Verdict, string> = {
  acquis: "Critère acquis pour cette évaluation",
  non_acquis: "Critère non acquis",
  indetermine: "Verdict indéterminé — arbitrage du tuteur requis",
  non_concluant: "Évaluation non concluante — tirage insuffisant",
};

export const LIBELLES_COURTS_VERDICT: Record<Verdict, string> = {
  acquis: "acquis",
  non_acquis: "non acquis",
  indetermine: "indéterminé",
  non_concluant: "non concluant",
};

/** Phrase d'explication du verdict brut, pour l'écran de résultat et le rapport. */
export function expliquerVerdict(d: Decision): string {
  switch (d.verdictBrut) {
    case "non_concluant":
      return `Tirage de ${d.nbQuestions} question${d.nbQuestions > 1 ? "s" : ""} : il en faut ${d.minQuestions} pour conclure. Ce résultat ne peut pas être porté à un rapport d'habilitation.`;
    case "non_acquis":
      return d.echecEliminatoire
        ? "Échec sur une question éliminatoire : le critère est non acquis quel que soit le score global. Reprise du module puis nouveau tirage."
        : `Le score est sous la bande de garde (${d.bandeBasse} à ${d.bandeHaute} %) : le seuil n'est pas atteint. Reprise du module puis nouveau tirage.`;
    case "indetermine":
      return `Score dans la bande de garde (${d.bandeBasse} à ${d.bandeHaute} %, soit le seuil de ${d.seuil} % à plus ou moins ${String(d.bande).replace(".", ",")} points) : le tuteur tranche par un arbitrage motivé au visa du rapport.`;
    case "acquis":
      return "Le seuil est atteint au-delà de la bande de garde et aucune question éliminatoire n'est en échec. La suite du parcours reste à réaliser au poste.";
  }
}
