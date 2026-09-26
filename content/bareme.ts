/**
 * Barème réglable — un seul modèle pour les trois formats (décision du
 * 19/09/2026, question 34 ; refonte du barème posé le 18/09/2026, question 10).
 *
 * Chaque question se note de la même façon, quel que soit son format : ses
 * **éléments** (propositions d'un QCM ou d'une QIM, légendes d'un schéma,
 * étapes d'une séquence à ordonner, trous d'un texte à compléter)
 * valent chacun une part de 1/n, et cette part compte pour `juste`, `faux` ou
 * `sansReponse` selon ce qu'en a fait l'apprenant. La note de la question est
 * la somme, ramenée entre un **plancher** (`min`) et un **plafond** (`max`).
 * Trois réglages, les mêmes partout : ce que rapporte un élément juste, ce
 * que coûte une erreur, ce que vaut une absence de réponse.
 *
 * Valeurs par défaut :
 *   - QCM : tout ou rien — 1 point si aucune discordance, sinon le plancher ;
 *   - QIM : le barème des quiz de Flore — chaque proposition juste rapporte
 *     sa part, chaque proposition fausse la retire, « je ne sais pas » ne
 *     rapporte ni ne retire rien ; jamais moins de 0 ;
 *   - schéma : la même règle, légende par légende, une légende vide valant
 *     « je ne sais pas » ;
 *   - séquence à ordonner : la même règle, étape par étape — une étape à sa
 *     place rapporte sa part, une étape mal placée la retire, une étape sans
 *     rang ne compte pas ;
 *   - texte à trous : la même règle, trou par trou.
 *
 * Le barème en vigueur au moment d'une évaluation est copié dans le résultat
 * scellé (`ResultatEvaluation.bareme`) : un rapport se relit toujours avec le
 * barème qui l'a produit, y compris un barème de l'ancien modèle — voir
 * `libelleBaremeCourt`, qui sait lire les deux.
 *
 * Module pur, partagé par le serveur (correction, rapports, registre) et le
 * navigateur (affichage des règles avant l'épreuve).
 */

import { ORDRE_NIVEAUX, repartir, type Repartition } from "./tirage";
import type { NiveauQuestion } from "./types";
import { LIBELLES_NIVEAU_QUESTION, nomDansPhrase, plafondEnPhrase, type LibellesNiveaux } from "./niveaux-questions";

export { LIBELLES_PLAFOND } from "./niveaux-questions";

export type ModeNotation = "partiel" | "tout_ou_rien";

export interface BaremeFormat {
  /** `partiel` : chaque élément vaut sa part. `tout_ou_rien` : le plafond si tout est juste, sinon le plancher. */
  mode: ModeNotation;
  /** Ce que rapporte un élément juste, en parts de 1/n. */
  juste: number;
  /** Ce que rapporte un élément faux — négatif, il retire. */
  faux: number;
  /** Ce que rapporte un élément sans réponse : « je ne sais pas », légende vide. */
  sansReponse: number;
  /** Plancher de la note d'une question. */
  min: number;
  /** Plafond de la note d'une question, et poids de la question dans le total. */
  max: number;
}

export interface BandeGarde {
  /** Largeur : le poids d'une question (100/n), d'une demi-question (50/n), ou un nombre de points fixe. */
  mode: "question" | "demi_question" | "fixe";
  /** Points de pourcentage, en mode `fixe`. */
  points: number;
}

export interface Bareme {
  version: 2;
  qcm: BaremeFormat;
  qim: BaremeFormat;
  schema: BaremeFormat;
  /** Séquence à ordonner : une étape à sa place vaut sa part. */
  ordre: BaremeFormat;
  /** Texte à trous : un trou bien rempli vaut sa part. */
  trous: BaremeFormat;
  /** Seuil de réussite (%) des modules sans seuil propre. */
  seuilDefaut: number;
  /** Taille minimale d'un tirage concluant. */
  minQuestions: number;
  tirages: { decouverte: number; habilitation: number };
  bande: BandeGarde;
  /**
   * Plafond de niveau de question par niveau d'habilitation visé (question
   * 62, choix a) : le niveau de question le plus élevé tiré. Un niveau
   * d'habilitation absent de la liste, ou un niveau cible inconnu : tous les
   * niveaux.
   */
  plafonds: Record<string, NiveauQuestion>;
  /**
   * Part de chaque niveau de question dans un tirage, pour chaque plafond
   * (question 63, choix a) : deux passations au même niveau cible ont la même
   * composition. Parts relatives, en pourcentage.
   */
  repartitions: Record<NiveauQuestion, Repartition>;
}

/** Barème des quiz de Flore : juste +, faux −, « je ne sais pas » rien, plancher 0. */
const FLORE: BaremeFormat = { mode: "partiel", juste: 1, faux: -1, sansReponse: 0, min: 0, max: 1 };

export const BAREME_DEFAUT: Bareme = {
  version: 2,
  qcm: { ...FLORE, mode: "tout_ou_rien" },
  qim: { ...FLORE },
  schema: { ...FLORE },
  ordre: { ...FLORE },
  trous: { ...FLORE },
  seuilDefaut: 80,
  minQuestions: 10,
  tirages: { decouverte: 5, habilitation: 10 },
  bande: { mode: "question", points: 5 },
  // Le chiffre du niveau d'habilitation donne le palier : niveau 1 (N1a, et
  // ses deux branches N1b et N1c), questions initiales ; N2, jusqu'aux
  // intermédiaires ; N3, tous les niveaux.
  plafonds: { N1a: "initial", N1b: "initial", N1c: "initial", N2: "intermediaire", N3: "avance" },
  // Tous niveaux : environ 3, 4 et 3 sur dix, la répartition que le prompt de
  // génération demande pour une banque ; sous un plafond, les mêmes rapports
  // entre les niveaux admis (3 pour 4, arrondi à 43 / 57).
  repartitions: {
    initial: { initial: 100, intermediaire: 0, avance: 0 },
    intermediaire: { initial: 43, intermediaire: 57, avance: 0 },
    avance: { initial: 30, intermediaire: 40, avance: 30 },
  },
};

/** Le plafond d'un niveau cible ; sans niveau cible, ou pour un niveau que le barème ne cite pas : tous les niveaux. */
export function plafondDuNiveau(b: Pick<Bareme, "plafonds">, niveauCible: string | null | undefined): NiveauQuestion {
  return (niveauCible ? b.plafonds[niveauCible] : undefined) ?? "avance";
}

/** Code de niveau d'habilitation recevable comme clé de plafond (mêmes règles que l'adresse d'un profil). */
const RE_CODE_NIVEAU = /^[A-Za-z0-9-]{1,12}$/;

export const LIMITES_BAREME = {
  seuil: { min: 50, max: 100 },
  minQuestions: { min: 1, max: 50 },
  tirage: { min: 1, max: 100 },
  bandePoints: { min: 0, max: 50 },
  /** Part d'un élément : d'une part retirée à une part gagnée. */
  part: { min: -1, max: 1 },
  /** Plancher d'une question : négatif, une question ratée retire des points au total. */
  plancher: { min: -1, max: 0 },
  /** Plafond d'une question : son poids dans le total. */
  plafond: { min: 0.1, max: 1 },
  /** Part d'un niveau de question dans un tirage, en pourcentage. */
  partNiveau: { min: 0, max: 100 },
} as const;

export const LIBELLES_FORMAT: Record<CleFormat, string> = {
  qcm: "QCM",
  qim: "QIM",
  schema: "Schéma à compléter",
  ordre: "Séquence à ordonner",
  trous: "Texte à trous",
};

/** Les formats réglables, dans l'ordre où ils sont présentés. */
export type CleFormat = "qcm" | "qim" | "schema" | "ordre" | "trous";
export const CLES_FORMAT: CleFormat[] = ["qcm", "qim", "schema", "ordre", "trous"];

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
 * Barème d'un format à partir d'une valeur quelconque. Un barème de l'ancien
 * modèle (version 1) n'a ni parts ni bornes : ses champs connus sont repris
 * quand ils ont un équivalent — le mode du schéma, sa légende vide — et le
 * reste prend les valeurs par défaut.
 */
function formatNormalise(brut: unknown, defaut: BaremeFormat): BaremeFormat {
  const f = objet(brut);
  const mode = f.mode === "tout_ou_rien" ? "tout_ou_rien" : f.mode === "partiel" ? "partiel" : defaut.mode;
  // ancien modèle : `videRetire` disait si une légende vide retirait sa part
  const videRetire = f.videRetire === true || f.videRetire === "true" || f.videRetire === "on";
  const sansReponseDefaut = "videRetire" in f ? (videRetire ? -1 : 0) : defaut.sansReponse;
  const min = nombreBorne(f.min, defaut.min, LIMITES_BAREME.plancher.min, LIMITES_BAREME.plancher.max, 2);
  const max = nombreBorne(f.max, defaut.max, LIMITES_BAREME.plafond.min, LIMITES_BAREME.plafond.max, 2);
  return {
    mode,
    juste: nombreBorne(f.juste, defaut.juste, LIMITES_BAREME.part.min, LIMITES_BAREME.part.max, 2),
    faux: nombreBorne(f.faux, defaut.faux, LIMITES_BAREME.part.min, LIMITES_BAREME.part.max, 2),
    sansReponse: nombreBorne(f.sansReponse, sansReponseDefaut, LIMITES_BAREME.part.min, LIMITES_BAREME.part.max, 2),
    min: Math.min(min, max),
    max,
  };
}

/**
 * Plafonds par niveau cible : ceux par défaut, corrigés par les réglages
 * reçus. Un code mal formé ou un plafond inconnu est ignoré.
 */
function plafondsNormalises(brut: unknown): Record<string, NiveauQuestion> {
  const out: Record<string, NiveauQuestion> = { ...BAREME_DEFAUT.plafonds };
  for (const [code, v] of Object.entries(objet(brut))) {
    if (RE_CODE_NIVEAU.test(code) && typeof v === "string" && (ORDRE_NIVEAUX as readonly string[]).includes(v)) {
      out[code] = v as NiveauQuestion;
    }
  }
  return out;
}

/**
 * Parts de chaque plafond : entiers de 0 à 100, rien au-dessus du plafond.
 * Des parts toutes nulles ne tireraient rien : celles par défaut les
 * remplacent.
 */
function repartitionsNormalisees(brut: unknown): Record<NiveauQuestion, Repartition> {
  const b = objet(brut);
  const out = {} as Record<NiveauQuestion, Repartition>;
  for (const plafond of ORDRE_NIVEAUX) {
    const defaut = BAREME_DEFAUT.repartitions[plafond];
    const r = objet(b[plafond]);
    const rang = ORDRE_NIVEAUX.indexOf(plafond);
    const parts = Object.fromEntries(
      ORDRE_NIVEAUX.map((n, i) => [
        n,
        i > rang ? 0 : nombreBorne(r[n], defaut[n], LIMITES_BAREME.partNiveau.min, LIMITES_BAREME.partNiveau.max),
      ]),
    ) as Repartition;
    out[plafond] = ORDRE_NIVEAUX.some((n) => parts[n] > 0) ? parts : { ...defaut };
  }
  return out;
}

/**
 * Barème complet à partir d'une valeur quelconque (base, formulaire, ancien
 * enregistrement) : chaque champ absent ou invalide prend sa valeur par
 * défaut, chaque nombre est ramené dans ses bornes. Le tirage d'habilitation
 * ne descend pas sous le minimum de questions, sinon il serait toujours non
 * concluant.
 */
export function normaliserBareme(brut: unknown): Bareme {
  const b = objet(brut);
  const tirages = objet(b.tirages);
  const bande = objet(b.bande);
  const d = BAREME_DEFAUT;
  const minQuestions = nombreBorne(b.minQuestions, d.minQuestions, LIMITES_BAREME.minQuestions.min, LIMITES_BAREME.minQuestions.max);
  const habilitation = nombreBorne(tirages.habilitation, d.tirages.habilitation, LIMITES_BAREME.tirage.min, LIMITES_BAREME.tirage.max);
  return {
    version: 2,
    qcm: formatNormalise(b.qcm, d.qcm),
    qim: formatNormalise(b.qim, d.qim),
    schema: formatNormalise(b.schema, d.schema),
    ordre: formatNormalise(b.ordre, d.ordre),
    trous: formatNormalise(b.trous, d.trous),
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
    plafonds: plafondsNormalises(b.plafonds),
    repartitions: repartitionsNormalisees(b.repartitions),
  };
}

export function estBaremeDefaut(b: Bareme): boolean {
  return JSON.stringify(normaliserBareme(b)) === JSON.stringify(BAREME_DEFAUT);
}

/**
 * Note d'une question à partir du décompte de ses éléments. Le seul endroit
 * où la règle s'applique : QCM, QIM et schéma passent tous par là.
 */
export function noterElements(
  justes: number,
  faux: number,
  sansReponse: number,
  f: BaremeFormat,
): number {
  const n = justes + faux + sansReponse;
  if (n <= 0) return 0;
  if (f.mode === "tout_ou_rien") return faux === 0 && sansReponse === 0 ? f.max : f.min;
  const brut = ((justes * f.juste + faux * f.faux + sansReponse * f.sansReponse) * f.max) / n;
  return Math.round(Math.min(f.max, Math.max(f.min, brut)) * 100) / 100;
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

function signe(n: number): string {
  return n > 0 ? `+${nombreLisible(n)}` : nombreLisible(n);
}

/** La règle d'un format, en une phrase, avec le mot qui désigne ses éléments. */
export function libelleFormatBareme(f: BaremeFormat, element: string, sansReponse: string): string {
  const bornes = `jamais moins de ${nombreLisible(f.min)}, jamais plus de ${nombreLisible(f.max)}`;
  if (f.mode === "tout_ou_rien") {
    return `tout ou rien — ${nombreLisible(f.max)} point si tout est juste, ${nombreLisible(f.min)} sinon.`;
  }
  return `chaque ${element} compte pour sa part : juste ${signe(f.juste)}, faux ${signe(f.faux)}, ${sansReponse} ${signe(f.sansReponse)} ; ${bornes}.`;
}

export function libelleQim(b: Bareme = BAREME_DEFAUT): string {
  return libelleFormatBareme(b.qim, "proposition", "« je ne sais pas »");
}

export function libelleSchema(b: Bareme = BAREME_DEFAUT): string {
  return libelleFormatBareme(b.schema, "légende", "légende vide");
}

/**
 * Schéma à découvrir (question 52) : le barème du schéma, dit avec ses mots —
 * un cache jugé juste ou faux, un cache non jugé à la place d'une légende vide.
 */
export function libelleCaches(b: Bareme = BAREME_DEFAUT): string {
  return libelleFormatBareme(b.schema, "cache", "cache non jugé");
}

export function libelleQcm(b: Bareme = BAREME_DEFAUT): string {
  return libelleFormatBareme(b.qcm, "proposition", "proposition non tranchée");
}

export function libelleOrdre(b: Bareme = BAREME_DEFAUT): string {
  return libelleFormatBareme(b.ordre, "étape à sa place", "étape sans rang");
}

export function libelleTrous(b: Bareme = BAREME_DEFAUT): string {
  return libelleFormatBareme(b.trous, "trou bien rempli", "trou laissé vide");
}

export function libelleBande(b: Bareme = BAREME_DEFAUT): string {
  if (b.bande.mode === "fixe") return `${nombreLisible(b.bande.points)} point${b.bande.points > 1 ? "s" : ""} de pourcentage de part et d'autre du seuil`;
  if (b.bande.mode === "demi_question") return "le poids d'une demi-question de part et d'autre du seuil";
  return "le poids d'une question de part et d'autre du seuil";
}

/** Un barème de l'ancien modèle, tel qu'il a pu être scellé dans un résultat. */
interface BaremeV1 {
  qim: { unDiscordance: number; deuxDiscordances: number; auDela: number };
  schema: { mode: string; videRetire: boolean };
}

function ancienModele(b: unknown): BaremeV1 | null {
  const o = objet(b);
  const qim = objet(o.qim);
  return o.version === 1 && "unDiscordance" in qim
    ? ({ qim: qim as BaremeV1["qim"], schema: objet(o.schema) as unknown as BaremeV1["schema"] })
    : null;
}

/**
 * Le barème sur une ligne, porté sur chaque rapport avec la décision. Accepte
 * un barème de l'ancien modèle (version 1) : un rapport scellé avant la
 * refonte se relit avec la règle qui l'a noté, et le dit.
 */
export function libelleBaremeCourt(b: unknown = BAREME_DEFAUT): string {
  const v1 = ancienModele(b);
  if (v1) {
    const q = v1.qim;
    const schema = v1.schema.mode === "tout_ou_rien" ? "tout ou rien" : `partiel, légende vide ${v1.schema.videRetire ? "retirée" : "non comptée"}`;
    return `Barème d'avant la refonte du 19/09/2026 — QCM tout ou rien · QIM 1 / ${nombreLisible(q.unDiscordance)} / ${nombreLisible(q.deuxDiscordances)} / ${nombreLisible(q.auDela)} selon 0, 1, 2 discordances et au-delà · schéma ${schema}`;
  }
  const n = normaliserBareme(b);
  const brut = objet(b);
  // Formats ajoutés le 19/09/2026 : passés sous silence pour un barème scellé
  // avant, qui ne les portait pas — le rapport se relit tel qu'il a été noté.
  const ordre = "ordre" in brut ? ` Séquence : ${libelleOrdre(n)}` : "";
  const trous = "trous" in brut ? ` Texte à trous : ${libelleTrous(n)}` : "";
  return `QCM : ${libelleQcm(n)} QIM : ${libelleQim(n)} Schéma : ${libelleSchema(n)}${ordre}${trous} Bande de garde : ${libelleBande(n)} · ${n.minQuestions} question${n.minQuestions > 1 ? "s" : ""} au moins pour conclure`;
}

/**
 * Les plafonds en une phrase : « N1a, N1b, N1c → questions initiales seulement ; … ».
 * `l` : les noms des niveaux de question en vigueur (question 81).
 */
export function libellePlafonds(b: Bareme = BAREME_DEFAUT, l: LibellesNiveaux = LIBELLES_NIVEAU_QUESTION): string {
  return ORDRE_NIVEAUX.map((p) => {
    const codes = Object.entries(b.plafonds)
      .filter(([, v]) => v === p)
      .map(([c]) => c);
    if (p === "avance") codes.push(codes.length > 0 ? "tout autre niveau cible" : "tout niveau cible");
    return codes.length > 0 ? `${codes.join(", ")} → ${plafondEnPhrase(p, l)}` : "";
  })
    .filter(Boolean)
    .join(" ; ");
}

/** Les répartitions en une phrase, avec ce qu'elles donnent pour le tirage Habilitation. */
export function libelleRepartitions(b: Bareme = BAREME_DEFAUT, l: LibellesNiveaux = LIBELLES_NIVEAU_QUESTION): string {
  return ORDRE_NIVEAUX.map((p) => {
    const admis = ORDRE_NIVEAUX.slice(0, ORDRE_NIVEAUX.indexOf(p) + 1);
    const parts = b.repartitions[p];
    const nombres = repartir(b.tirages.habilitation, parts, p);
    return `${plafondEnPhrase(p, l)} : ${admis.map((n) => `${nomDansPhrase(n, l)} ${parts[n]} %`).join(", ")} (Habilitation : ${admis.map((n) => nombres[n]).join(" + ")})`;
  }).join(" ; ");
}

/** Le barème en quelques lignes, pour l'écran de réglage, l'accueil et le rapport. */
export function resumeBareme(b: Bareme = BAREME_DEFAUT, l: LibellesNiveaux = LIBELLES_NIVEAU_QUESTION): string[] {
  return [
    `QCM : ${libelleQcm(b)}`,
    `QIM : ${libelleQim(b)}`,
    `Schéma à compléter : ${libelleSchema(b)}`,
    `Séquence à ordonner : ${libelleOrdre(b)}`,
    `Texte à trous : ${libelleTrous(b)}`,
    `Seuil de réussite par défaut : ${b.seuilDefaut} %.`,
    `Bande de garde (verdict indéterminé, arbitrage du tuteur) : ${libelleBande(b)}.`,
    `Tirages : découverte ${b.tirages.decouverte} question${b.tirages.decouverte > 1 ? "s" : ""}, habilitation ${b.tirages.habilitation} ; ${b.minQuestions} question${b.minQuestions > 1 ? "s" : ""} au moins pour conclure.`,
    `Niveau cible et niveau des questions tirées : ${libellePlafonds(b, l)}. Une question sans niveau est tirée pour tous.`,
    `Répartition de chaque tirage par niveau de question : ${libelleRepartitions(b, l)}.`,
  ];
}
