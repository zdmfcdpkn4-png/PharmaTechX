/**
 * Barème réglable (décision du 18/09/2026, question 10) : les règles de
 * notation et de décision que l'administrateur règle depuis `/admin/bareme`,
 * avec leurs valeurs par défaut — celles qui s'appliquaient avant qu'elles
 * soient réglables. Module pur, partagé par le serveur (correction, rapports,
 * registre) et le navigateur (affichage des règles avant l'épreuve).
 *
 * Le barème en vigueur au moment d'une évaluation est copié dans le résultat
 * scellé (`ResultatEvaluation.bareme`) : un rapport se relit toujours avec le
 * barème qui l'a produit, même si le réglage change ensuite.
 */

export interface BaremeQim {
  /** Points sur 1 pour une discordance. */
  unDiscordance: number;
  /** Points sur 1 pour deux discordances. */
  deuxDiscordances: number;
  /** Points sur 1 au-delà de deux discordances. */
  auDela: number;
}

export interface BaremeSchema {
  /** `partiel` : chaque légende vaut 1/n (juste +, fausse −) ; `tout_ou_rien` : 1 point si tout est juste. */
  mode: "partiel" | "tout_ou_rien";
  /** En mode partiel : une légende vide retire sa part (comme une fausse) ou ne compte pas. */
  videRetire: boolean;
}

export interface BandeGarde {
  /** Largeur : le poids d'une question (100/n), d'une demi-question (50/n), ou un nombre de points fixe. */
  mode: "question" | "demi_question" | "fixe";
  /** Points de pourcentage, en mode `fixe`. */
  points: number;
}

export interface Bareme {
  version: 1;
  qim: BaremeQim;
  schema: BaremeSchema;
  /** Seuil de réussite (%) des modules sans seuil propre. */
  seuilDefaut: number;
  /** Taille minimale d'un tirage concluant. */
  minQuestions: number;
  tirages: { decouverte: number; habilitation: number };
  bande: BandeGarde;
}

export const BAREME_DEFAUT: Bareme = {
  version: 1,
  qim: { unDiscordance: 0.5, deuxDiscordances: 0, auDela: 0 },
  schema: { mode: "partiel", videRetire: false },
  seuilDefaut: 80,
  minQuestions: 10,
  tirages: { decouverte: 5, habilitation: 10 },
  bande: { mode: "question", points: 5 },
};

export const LIMITES_BAREME = {
  seuil: { min: 50, max: 100 },
  minQuestions: { min: 1, max: 50 },
  tirage: { min: 1, max: 100 },
  bandePoints: { min: 0, max: 50 },
} as const;

function nombreBorne(v: unknown, defaut: number, min: number, max: number, decimales = 0): number {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v.replace(",", ".")) : NaN;
  if (!Number.isFinite(n)) return defaut;
  const f = 10 ** decimales;
  return Math.min(max, Math.max(min, Math.round(n * f) / f));
}

function objet(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}

/**
 * Barème complet à partir d'une valeur quelconque (base, formulaire) : chaque
 * champ absent ou invalide prend sa valeur par défaut, chaque nombre est
 * ramené dans ses bornes. Le tirage d'habilitation ne descend pas sous le
 * minimum de questions, sinon il serait toujours non concluant.
 */
export function normaliserBareme(brut: unknown): Bareme {
  const b = objet(brut);
  const qim = objet(b.qim);
  const schema = objet(b.schema);
  const tirages = objet(b.tirages);
  const bande = objet(b.bande);
  const d = BAREME_DEFAUT;
  const minQuestions = nombreBorne(b.minQuestions, d.minQuestions, LIMITES_BAREME.minQuestions.min, LIMITES_BAREME.minQuestions.max);
  const habilitation = nombreBorne(tirages.habilitation, d.tirages.habilitation, LIMITES_BAREME.tirage.min, LIMITES_BAREME.tirage.max);
  return {
    version: 1,
    qim: {
      unDiscordance: nombreBorne(qim.unDiscordance, d.qim.unDiscordance, 0, 1, 2),
      deuxDiscordances: nombreBorne(qim.deuxDiscordances, d.qim.deuxDiscordances, 0, 1, 2),
      auDela: nombreBorne(qim.auDela, d.qim.auDela, 0, 1, 2),
    },
    schema: {
      mode: schema.mode === "tout_ou_rien" ? "tout_ou_rien" : "partiel",
      videRetire: schema.videRetire === true || schema.videRetire === "true" || schema.videRetire === "on",
    },
    seuilDefaut: nombreBorne(b.seuilDefaut, d.seuilDefaut, LIMITES_BAREME.seuil.min, LIMITES_BAREME.seuil.max),
    minQuestions,
    tirages: {
      decouverte: nombreBorne(tirages.decouverte, d.tirages.decouverte, LIMITES_BAREME.tirage.min, LIMITES_BAREME.tirage.max),
      habilitation: Math.max(habilitation, minQuestions),
    },
    bande: {
      mode: bande.mode === "demi_question" || bande.mode === "fixe" ? bande.mode : "question",
      points: nombreBorne(bande.points, d.bande.points, LIMITES_BAREME.bandePoints.min, LIMITES_BAREME.bandePoints.max, 1),
    },
  };
}

export function estBaremeDefaut(b: Bareme): boolean {
  return JSON.stringify(normaliserBareme(b)) === JSON.stringify(BAREME_DEFAUT);
}

/** Points d'une QIM selon son nombre de discordances. */
export function pointsQim(discordances: number, b: Bareme = BAREME_DEFAUT): number {
  if (discordances <= 0) return 1;
  if (discordances === 1) return b.qim.unDiscordance;
  if (discordances === 2) return b.qim.deuxDiscordances;
  return b.qim.auDela;
}

/** Largeur de la bande de garde, en points de pourcentage, pour un tirage de n questions. */
export function largeurBande(n: number, bande: BandeGarde = BAREME_DEFAUT.bande): number {
  if (n <= 0) return 0;
  if (bande.mode === "fixe") return bande.points;
  if (bande.mode === "demi_question") return 50 / n;
  return 100 / n;
}

export function nombreLisible(n: number): string {
  return String(Math.round(n * 100) / 100).replace(".", ",");
}

export function libelleQim(b: Bareme = BAREME_DEFAUT): string {
  return `0 discordance → 1 point ; 1 discordance → ${nombreLisible(b.qim.unDiscordance)} ; 2 discordances → ${nombreLisible(b.qim.deuxDiscordances)} ; au-delà → ${nombreLisible(b.qim.auDela)}. Une proposition laissée sans réponse compte comme une discordance.`;
}

export function libelleSchema(b: Bareme = BAREME_DEFAUT): string {
  if (b.schema.mode === "tout_ou_rien") return "Tout ou rien : 1 point si toutes les légendes sont justes, 0 sinon.";
  return `1 point au plus : chaque légende vaut sa part, une légende fausse la retire, une légende vide ${b.schema.videRetire ? "la retire aussi" : "ne compte pas"} ; jamais moins de 0.`;
}

export function libelleBande(b: Bareme = BAREME_DEFAUT): string {
  if (b.bande.mode === "fixe") return `${nombreLisible(b.bande.points)} point${b.bande.points > 1 ? "s" : ""} de pourcentage de part et d'autre du seuil`;
  if (b.bande.mode === "demi_question") return "le poids d'une demi-question de part et d'autre du seuil";
  return "le poids d'une question de part et d'autre du seuil";
}

/** Le barème sur une ligne, porté sur chaque rapport avec la décision. */
export function libelleBaremeCourt(b: Bareme = BAREME_DEFAUT): string {
  const q = b.qim;
  const schema = b.schema.mode === "tout_ou_rien" ? "tout ou rien" : `partiel, légende vide ${b.schema.videRetire ? "retirée" : "non comptée"}`;
  return `QCM tout ou rien · QIM 1 / ${nombreLisible(q.unDiscordance)} / ${nombreLisible(q.deuxDiscordances)} / ${nombreLisible(q.auDela)} selon 0, 1, 2 discordances et au-delà · schéma ${schema} · bande de garde : ${libelleBande(b)} · ${b.minQuestions} question${b.minQuestions > 1 ? "s" : ""} au moins pour conclure`;
}

/** Le barème en quelques lignes, pour l'écran de réglage, l'accueil et le rapport. */
export function resumeBareme(b: Bareme = BAREME_DEFAUT): string[] {
  return [
    `QCM : tout ou rien.`,
    `QIM : ${libelleQim(b)}`,
    `Schéma à compléter : ${libelleSchema(b)}`,
    `Seuil de réussite par défaut : ${b.seuilDefaut} %.`,
    `Bande de garde (verdict indéterminé, arbitrage du tuteur) : ${libelleBande(b)}.`,
    `Tirages : découverte ${b.tirages.decouverte} question${b.tirages.decouverte > 1 ? "s" : ""}, habilitation ${b.tirages.habilitation} ; ${b.minQuestions} question${b.minQuestions > 1 ? "s" : ""} au moins pour conclure.`,
  ];
}
