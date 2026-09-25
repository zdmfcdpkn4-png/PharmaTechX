/**
 * Statistiques de réussite des modules (question 78, choix a, 25/09/2026).
 *
 * Elles répondent à « quels modules les agents réussissent, lesquels
 * accrochent, et où précisément » — pour ajuster la formation, jamais pour
 * juger quelqu'un. Elles lisent les évaluations conservées des agents
 * rattachés, premiers essais compris, et les rapports émis sans évaluation
 * conservée, sans double compte (`lib/statistiques-db.ts`). Le Pilotage, lui,
 * ne lit que les rapports émis : un agent émet d'ordinaire l'essai qui réussit,
 * et la réussite y paraît plus haute qu'elle n'est.
 *
 * Module pur (pas de `server-only`) : ce sont ces calculs qui décident ce
 * qu'on montre, donc eux qu'on teste (`test/statistiques.test.ts`).
 *
 * Garde-fous :
 *  - aucune donnée individuelle ne sort d'ici : l'agent sert à reconnaître
 *    les essais d'une même personne, jamais à l'afficher ;
 *  - aucun taux sous `SEUILS_STAT.effectif` agents distincts — module,
 *    question, réponse ou source (`tauxAgents`) : en dessous, un taux ne dit
 *    rien et désignerait presque quelqu'un ;
 *  - chaque taux porte son intervalle de confiance à 95 %, par la méthode du
 *    score de Wilson (Newcombe, Stat Med 1998;17:857-72) ;
 *  - les seuils de lecture sont des repères, pas des normes.
 *
 * « Réussir » un essai, ici, c'est atteindre le seuil du module sans échouer
 * à une question éliminatoire. Ce n'est pas le verdict d'habilitation : la
 * bande de garde et la règle du tirage concluant (`lib/decision.ts`) protègent
 * une décision individuelle ; pour juger une formation, le seuil suffit, et
 * il vaut pour tout essai, même un tirage trop court pour conclure.
 */

export const SEUILS_STAT = {
  /** Effectif minimal d'un taux, en agents distincts (et en essais, pour une question). */
  effectif: 5,
  /** Module « à revoir » : réussite au premier essai sous ce pourcentage. */
  aRevoir: 60,
  /** Question « très facile » : réussie au moins aussi souvent. */
  facile: 90,
  /** Question « très difficile » : réussie au plus aussi souvent. */
  difficile: 30,
  /** Question qui « discrimine peu » : indice de discrimination sous ce seuil. */
  discrimination: 0.2,
  /** Mauvaise réponse d'un QCM choisie par moins de ce pourcentage : elle ne piège plus personne. */
  distracteur: 5,
} as const;

// ───────────────────────────────────────────────────────────── données lues

export interface LegendeTentative {
  numero: number;
  attendu: string;
  verdict: "juste" | "fausse" | "vide";
}

/** Une question telle qu'un essai l'a vue : un élément du détail scellé. */
export interface ItemTentative {
  questionId: string;
  enonce: string;
  type: string;
  correct: boolean;
  note: number;
  /** Poids de la question dans le total (1 par défaut). */
  max: number;
  /** Éléments laissés sans réponse : « je ne sais pas », légende vide, étape sans rang, trou vide. */
  nonJugees: number;
  /** Ce que l'agent a donné, tel que le résultat le scelle (`choixApprenant`). */
  choix: string[];
  /** Ce qui était attendu (`reponsesAttendues`). */
  attendus: string[];
  /** QCM et QIM : toutes les propositions présentées (scellé depuis le 25/09/2026). */
  propositions?: string[];
  /** QIM : propositions laissées sans jugement (scellé depuis le 25/09/2026). */
  sansJugement?: string[];
  legendes?: LegendeTentative[];
  sources: string[];
}

/** Un essai d'un agent sur un module : une évaluation conservée ou un rapport émis. */
export interface Tentative {
  cle: string;
  /** Sert à reconnaître les essais d'un même agent ; jamais affiché. */
  agent: number;
  moduleId: string;
  moduleTitre: string;
  /** Date de l'essai, ISO. */
  le: string;
  score: number;
  seuil: number;
  echecEliminatoire: boolean;
  niveauCible: string | null;
  /** Chargé pour la fiche d'un module seulement. */
  items?: ItemTentative[];
}

export function seuilAtteint(t: Pick<Tentative, "score" | "seuil" | "echecEliminatoire">): boolean {
  return t.score >= t.seuil && !t.echecEliminatoire;
}

// ─────────────────────────────────────────────────────── taux et intervalles

/**
 * Intervalle de confiance à 95 % d'une proportion, par le score de Wilson,
 * en pourcentages entiers. Contrairement à l'intervalle « de Wald », il ne
 * sort jamais de [0, 100] et reste honnête sur de petits effectifs.
 */
export function wilson(k: number, n: number, z = 1.96): { bas: number; haut: number } {
  if (n <= 0) return { bas: 0, haut: 100 };
  const p = k / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const centre = (p + z2 / (2 * n)) / denom;
  const demi = (z / denom) * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n));
  return {
    bas: Math.max(0, Math.round((centre - demi) * 100)),
    haut: Math.min(100, Math.round((centre + demi) * 100)),
  };
}

export interface Taux {
  /** Effectif : agents, essais ou éléments selon le taux. */
  n: number;
  /** Réussites (ou erreurs, pour un taux d'erreur). */
  k: number;
  /** Pourcentage entier ; `null` sous l'effectif minimal. */
  taux: number | null;
  bas: number | null;
  haut: number | null;
}

/** Un taux, ou rien sous l'effectif minimal : un taux sur trois essais ne dit rien. */
export function taux(k: number, n: number, min: number = SEUILS_STAT.effectif): Taux {
  if (n <= 0 || n < min) return { n, k, taux: null, bas: null, haut: null };
  const ic = wilson(k, n);
  return { n, k, taux: Math.round((k / n) * 100), bas: ic.bas, haut: ic.haut };
}

/**
 * Un taux qui exige aussi `SEUILS_STAT.effectif` agents distincts : un agent
 * qui repasse cinq fois ne fait pas un taux — ce serait le sien.
 */
export function tauxAgents(k: number, n: number, agents: number): Taux {
  return agents >= SEUILS_STAT.effectif ? taux(k, n) : { n, k, taux: null, bas: null, haut: null };
}

export function mediane(xs: readonly number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

function dansPeriode(le: string, depuis: string | null): boolean {
  return depuis === null || le >= depuis;
}

const JOUR_PARIS = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" });

/**
 * Le jour civil d'un instant à Paris, `AAAA-MM-JJ` : celui qu'a vécu l'unité,
 * et celui que porte une action datée. L'instant ISO est en temps universel :
 * un essai passé à 0 h 30 le 1er octobre y est encore au 30 septembre.
 */
export function jourParis(le: string): string {
  const p = Object.fromEntries(JOUR_PARIS.formatToParts(new Date(le)).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}

function chronologique(a: Tentative, b: Tentative): number {
  return a.le.localeCompare(b.le) || a.cle.localeCompare(b.cle);
}

/** Essais d'un même agent sur un même module, du premier au dernier. */
function parAgent(tentatives: readonly Tentative[]): Map<string, Tentative[]> {
  const m = new Map<string, Tentative[]>();
  for (const t of tentatives) {
    const cle = `${t.agent}\u0000${t.moduleId}`;
    const l = m.get(cle);
    if (l) l.push(t);
    else m.set(cle, [t]);
  }
  for (const l of m.values()) l.sort(chronologique);
  return m;
}

/** Le premier essai de chaque agent sur chaque module. */
function premiersEssais(tentatives: readonly Tentative[], depuis: string | null): Tentative[] {
  return [...parAgent(tentatives).values()].map((l) => l[0]).filter((t) => dansPeriode(t.le, depuis));
}

/** Réussite d'essais, sous le seuil d'agents distincts : cinq premiers essais d'un même agent sur cinq modules ne font pas un taux. */
function reussiteDe(l: readonly Tentative[]): Taux {
  return tauxAgents(l.filter(seuilAtteint).length, l.length, new Set(l.map((t) => t.agent)).size);
}

/** Réussite au premier essai, tous modules du périmètre confondus. */
export function premierEssaiGlobal(tentatives: readonly Tentative[], depuis: string | null = null): Taux {
  return reussiteDe(premiersEssais(tentatives, depuis));
}

function grouper<K, T>(liste: readonly T[], cle: (x: T) => K): Map<K, T[]> {
  const m = new Map<K, T[]>();
  for (const x of liste) {
    const k = cle(x);
    const l = m.get(k);
    if (l) l.push(x);
    else m.set(k, [x]);
  }
  return m;
}

// ──────────────────────────────────────────────────────────────── par module

export interface BilanModule {
  moduleId: string;
  titre: string;
  /** Agents ayant au moins un essai dans la période. */
  agents: number;
  /** Essais dans la période. */
  essais: number;
  /** Premiers essais (de toujours) tombés dans la période, et leur réussite. */
  premierEssai: Taux;
  /** Agents de la période ayant atteint le seuil à au moins un de leurs essais de la période. */
  final: Taux;
  /** Essais moyens jusqu'à la première réussite, pour les agents qui l'ont atteinte dans la période. */
  essaisPourReussir: number | null;
  /** Score médian des premiers essais de la période ; `null` sous l'effectif minimal. */
  scoreMedianPremier: number | null;
  /** Réussite au premier essai sous le repère, sur un effectif suffisant. */
  aRevoir: boolean;
  dernierEssai: string | null;
}

/**
 * Bilan d'un module. `depuis` borne la période ; les essais antérieurs
 * servent seulement à savoir si un essai de la période est le premier de son
 * agent. Un taux par agent pour la réussite finale : un agent qui repasse dix
 * fois ne pèse pas dix fois.
 */
export function bilanModule(
  moduleId: string,
  titre: string,
  tentatives: readonly Tentative[],
  depuis: string | null = null,
): BilanModule {
  const agents = parAgent(tentatives.filter((t) => t.moduleId === moduleId));
  let essais = 0;
  let premiers = 0;
  let premiersReussis = 0;
  let presents = 0;
  let reussiFinal = 0;
  const essaisJusquA: number[] = [];
  const scoresPremiers: number[] = [];
  let dernier: string | null = null;

  for (const liste of agents.values()) {
    const periode = liste.filter((t) => dansPeriode(t.le, depuis));
    if (periode.length === 0) continue;
    presents += 1;
    essais += periode.length;
    const fin = periode[periode.length - 1].le;
    if (!dernier || fin > dernier) dernier = fin;
    const premier = liste[0];
    if (dansPeriode(premier.le, depuis)) {
      premiers += 1;
      scoresPremiers.push(premier.score);
      if (seuilAtteint(premier)) premiersReussis += 1;
    }
    if (periode.some(seuilAtteint)) reussiFinal += 1;
    const rang = liste.findIndex(seuilAtteint);
    if (rang >= 0 && dansPeriode(liste[rang].le, depuis)) essaisJusquA.push(rang + 1);
  }

  const premierEssai = taux(premiersReussis, premiers);
  const moyenne =
    essaisJusquA.length >= SEUILS_STAT.effectif
      ? Math.round((essaisJusquA.reduce((s, x) => s + x, 0) / essaisJusquA.length) * 10) / 10
      : null;
  return {
    moduleId,
    titre,
    agents: presents,
    essais,
    premierEssai,
    final: taux(reussiFinal, presents),
    essaisPourReussir: moyenne,
    scoreMedianPremier: scoresPremiers.length >= SEUILS_STAT.effectif ? mediane(scoresPremiers) : null,
    aRevoir: premierEssai.taux !== null && premierEssai.taux < SEUILS_STAT.aRevoir,
    dernierEssai: dernier,
  };
}

/** Un bilan par module ayant au moins un essai dans la période. */
export function bilansModules(tentatives: readonly Tentative[], depuis: string | null = null): BilanModule[] {
  // Le titre du dernier essai : un module renommé se lit sous son nom actuel.
  const titres = new Map<string, string>();
  for (const t of [...tentatives].sort(chronologique)) titres.set(t.moduleId, t.moduleTitre);
  return [...titres.keys()]
    .map((id) => bilanModule(id, titres.get(id) ?? id, tentatives, depuis))
    .filter((b) => b.agents > 0);
}

export type OrdreClassement = "faible" | "fort";

/**
 * Classement : la réussite au premier essai, du plus faible au plus fort (ou
 * l'inverse), puis l'effectif décroissant. Les modules sans taux — effectif
 * insuffisant — viennent après, du plus au moins évalué : ils ne se classent
 * pas, ils attendent.
 */
export function classerModules(bilans: readonly BilanModule[], ordre: OrdreClassement = "faible"): BilanModule[] {
  const signe = ordre === "faible" ? 1 : -1;
  const avecTaux = bilans
    .filter((b) => b.premierEssai.taux !== null)
    .sort(
      (a, b) =>
        signe * ((a.premierEssai.taux ?? 0) - (b.premierEssai.taux ?? 0)) ||
        b.premierEssai.n - a.premierEssai.n ||
        a.titre.localeCompare(b.titre),
    );
  const sansTaux = bilans
    .filter((b) => b.premierEssai.taux === null)
    .sort((a, b) => b.agents - a.agents || a.titre.localeCompare(b.titre));
  return [...avecTaux, ...sansTaux];
}

// ──────────────────────────────────────────────── évolution et sous-groupes

export interface PointPeriode {
  /** `2026-T3`. */
  cle: string;
  premierEssai: Taux;
}

/** `2026-09-25…` → `2026-T3`, au jour de Paris. */
export function trimestre(le: string): string {
  const [a, m] = jourParis(le).slice(0, 7).split("-").map(Number);
  return `${a}-T${Math.floor((m - 1) / 3) + 1}`;
}

/** `2026-T3` → `3e trim. 2026`. */
export function libelleTrimestre(cle: string): string {
  const [a, t] = cle.split("-T");
  return `${t === "1" ? "1er" : `${t}e`} trim. ${a}`;
}

/**
 * Réussite au premier essai par trimestre, sans trimestre manquant entre le
 * premier et le dernier : une série à trous lirait un creux là où il n'y a eu
 * personne. Le trimestre plutôt que le mois : à l'échelle d'une unité, un mois
 * compte rarement cinq premiers essais sur un module.
 */
export function evolutionTrimestrielle(tentatives: readonly Tentative[], depuis: string | null = null): PointPeriode[] {
  const premiers = premiersEssais(tentatives, depuis);
  if (premiers.length === 0) return [];
  const groupes = grouper(premiers, (t) => trimestre(t.le));
  const cles = [...groupes.keys()].sort();
  const [a0, t0] = cles[0].split("-T").map(Number);
  const [a1, t1] = cles[cles.length - 1].split("-T").map(Number);
  const out: PointPeriode[] = [];
  for (let a = a0, t = t0; a < a1 || (a === a1 && t <= t1); t === 4 ? ((a += 1), (t = 1)) : (t += 1)) {
    const cle = `${a}-T${t}`;
    const l = groupes.get(cle) ?? [];
    out.push({ cle, premierEssai: reussiteDe(l) });
  }
  return out;
}

export interface GroupeNiveau {
  /** Code du niveau cible ; `null` : non précisé. */
  niveau: string | null;
  premierEssai: Taux;
}

/** Réussite au premier essai selon le niveau cible choisi à l'évaluation. */
export function parNiveauCible(tentatives: readonly Tentative[], depuis: string | null = null): GroupeNiveau[] {
  const groupes = grouper(premiersEssais(tentatives, depuis), (t) => t.niveauCible);
  return [...groupes.entries()]
    .map(([niveau, l]) => ({ niveau, premierEssai: reussiteDe(l) }))
    // « Non précisé » en dernier : ce n'est pas un niveau.
    .sort((a, b) => (a.niveau === null ? 1 : 0) - (b.niveau === null ? 1 : 0) || (a.niveau ?? "").localeCompare(b.niveau ?? ""));
}

// ─────────────────────────────────────────────────────────────── questions

export type Repere = "tres-facile" | "tres-difficile" | "discrimine-peu" | "discrimine-a-rebours";

export const LIBELLES_REPERE: Record<Repere, string> = {
  "tres-facile": "Très facile",
  "tres-difficile": "Très difficile",
  "discrimine-peu": "Discrimine peu",
  "discrimine-a-rebours": "Discrimine à rebours",
};

/** Ce que suggère chaque repère, pour qui relit la question. */
export const CONSEILS_REPERE: Record<Repere, string> = {
  "tres-facile": "n'apprend plus rien à l'évaluation : la garder si elle vérifie un point essentiel",
  "tres-difficile": "vérifier que le module enseigne ce point, puis la formulation",
  "discrimine-peu": "réussie autant par ceux qui échouent l'évaluation que par ceux qui la réussissent : relire la formulation",
  "discrimine-a-rebours": "mieux réussie par ceux qui échouent l'évaluation : vérifier la réponse attendue",
};

/**
 * Repères de lecture d'une question, à partir de sa réussite et de son indice
 * de discrimination. Partagés par la fiche du module et par la banque, pour
 * qu'une même question y porte les mêmes.
 */
export function reperes(reussite: Taux, discrimination: number | null): Repere[] {
  const out: Repere[] = [];
  if (reussite.taux !== null && reussite.taux >= SEUILS_STAT.facile) out.push("tres-facile");
  if (reussite.taux !== null && reussite.taux <= SEUILS_STAT.difficile) out.push("tres-difficile");
  if (discrimination !== null) {
    if (discrimination < 0) out.push("discrimine-a-rebours");
    else if (discrimination < SEUILS_STAT.discrimination) out.push("discrimine-peu");
  }
  return out;
}

/** « À revoir » : très difficile, ou discriminant peu ou à rebours. Très facile n'est pas un défaut. */
export function questionARevoir(r: readonly Repere[]): boolean {
  return r.some((x) => x !== "tres-facile");
}

/** Corrélation de Pearson ; `null` si l'une des deux séries est constante. */
export function correlation(xs: readonly number[], ys: readonly number[]): number | null {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return null;
  const mx = xs.slice(0, n).reduce((s, x) => s + x, 0) / n;
  const my = ys.slice(0, n).reduce((s, y) => s + y, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
    syy += (ys[i] - my) ** 2;
  }
  if (sxx === 0 || syy === 0) return null;
  return sxy / Math.sqrt(sxx * syy);
}

export interface AnalyseQuestion {
  questionId: string;
  enonce: string;
  type: string;
  /** Essais de la période où elle a été posée. */
  n: number;
  /** Part des essais où elle est entièrement juste. */
  reussite: Taux;
  /**
   * Indice de discrimination : corrélation point-bisériale corrigée entre la
   * réussite à la question et le score de l'essai sans elle. Au centième ;
   * `null` sous l'effectif minimal, ou si tous l'ont réussie (ou manquée).
   */
  discrimination: number | null;
  /** Part des essais où au moins un élément est resté sans réponse. */
  sansReponse: Taux;
  reperes: Repere[];
  sources: string[];
}

/**
 * Analyse des questions d'un module, sur les essais de la période dont le
 * détail est chargé. Classées de la moins réussie à la plus réussie ; celles
 * dont l'effectif ne permet pas de taux, à la fin.
 */
export function analyserQuestions(tentatives: readonly Tentative[], depuis: string | null = null): AnalyseQuestion[] {
  const paires = new Map<string, { item: ItemTentative; reste: number | null; agent: number }[]>();
  // Dans l'ordre des essais : l'énoncé retenu est celui du dernier.
  for (const t of [...tentatives].sort(chronologique)) {
    if (!t.items || !dansPeriode(t.le, depuis)) continue;
    const total = t.items.reduce((s, i) => s + i.max, 0);
    const obtenus = t.items.reduce((s, i) => s + i.note, 0);
    for (const item of t.items) {
      const reste = total - item.max > 0 ? (obtenus - item.note) / (total - item.max) : null;
      const l = paires.get(item.questionId);
      if (l) l.push({ item, reste, agent: t.agent });
      else paires.set(item.questionId, [{ item, reste, agent: t.agent }]);
    }
  }
  const out: AnalyseQuestion[] = [];
  for (const [questionId, l] of paires) {
    const n = l.length;
    const agents = new Set(l.map((p) => p.agent)).size;
    const justes = l.filter((p) => p.item.correct).length;
    const reussite = tauxAgents(justes, n, agents);
    const avecReste = l.filter((p): p is { item: ItemTentative; reste: number; agent: number } => p.reste !== null);
    const r =
      n >= SEUILS_STAT.effectif && agents >= SEUILS_STAT.effectif
        ? correlation(
            avecReste.map((p) => (p.item.correct ? 1 : 0)),
            avecReste.map((p) => p.reste),
          )
        : null;
    const discrimination = r === null ? null : Math.round(r * 100) / 100;
    const dernier = l[l.length - 1].item;
    out.push({
      questionId,
      enonce: dernier.enonce,
      type: dernier.type,
      n,
      reussite,
      discrimination,
      sansReponse: tauxAgents(l.filter((p) => p.item.nonJugees > 0).length, n, agents),
      reperes: reperes(reussite, discrimination),
      sources: [...new Set(l.flatMap((p) => p.item.sources))],
    });
  }
  return out.sort(
    (a, b) =>
      (a.reussite.taux === null ? 1 : 0) - (b.reussite.taux === null ? 1 : 0) ||
      (a.reussite.taux ?? 0) - (b.reussite.taux ?? 0) ||
      b.n - a.n ||
      a.questionId.localeCompare(b.questionId),
  );
}

// ─────────────────────────────────────────────── éléments précis manqués

export type NatureElement =
  | "bonne-reponse"
  | "distracteur"
  | "proposition-vraie"
  | "proposition-fausse"
  | "legende"
  | "etape"
  | "trou";

export interface AnalyseElement {
  questionId: string;
  enonce: string;
  type: string;
  nature: NatureElement;
  /** La proposition, l'option, la légende attendue, l'étape ou le trou. */
  element: string;
  /** Essais où l'élément était présent. */
  n: number;
  /** Mal jugé, choisi à tort, oublié, mal placé, mal complété. */
  erreurs: number;
  /** Laissé sans réponse : « je ne sais pas », légende vide, étape sans rang, trou vide. */
  sansReponse: number;
  /**
   * Essais anciens de QIM où une proposition non cochée peut avoir été jugée
   * fausse ou laissée sans réponse : le résultat ne le disait pas avant le
   * 25/09/2026. Ni erreur ni « sans réponse » : non départagé.
   */
  nonDepartage: number;
  /** Part d'erreurs, ou, pour un distracteur, part des essais qui l'ont choisi. */
  tauxErreur: Taux;
  /** Distracteur de QCM choisi par moins de `SEUILS_STAT.distracteur` % des essais. */
  nonFonctionnel: boolean;
}

interface Compteur {
  q: ItemTentative;
  nature: NatureElement;
  element: string;
  agents: Set<number>;
  n: number;
  erreurs: number;
  sansReponse: number;
  nonDepartage: number;
}

const RANG = /^(\d+)\.\s(.*)$/;
const TROU = /^(\d+) → (.*)$/;

/**
 * Éléments précis d'une question, essai par essai : ce qui a été manqué.
 * `options` : propositions actuelles de chaque question dans la banque, pour
 * les essais scellés avant le 25/09/2026 qui ne portent pas la liste des
 * propositions présentées.
 */
export function analyserElements(
  tentatives: readonly Tentative[],
  depuis: string | null = null,
  options: ReadonlyMap<string, readonly string[]> = new Map(),
): AnalyseElement[] {
  const compteurs = new Map<string, Compteur>();
  let agent = 0;
  const compter = (q: ItemTentative, nature: NatureElement, element: string, effet: "juste" | "erreur" | "vide" | "incertain") => {
    const cle = `${q.questionId}\u0000${nature}\u0000${element}`;
    const c = compteurs.get(cle) ?? { q, nature, element, agents: new Set<number>(), n: 0, erreurs: 0, sansReponse: 0, nonDepartage: 0 };
    c.q = q;
    c.agents.add(agent);
    c.n += 1;
    if (effet === "erreur") c.erreurs += 1;
    else if (effet === "vide") c.sansReponse += 1;
    else if (effet === "incertain") c.nonDepartage += 1;
    compteurs.set(cle, c);
  };

  for (const t of [...tentatives].sort(chronologique)) {
    if (!t.items || !dansPeriode(t.le, depuis)) continue;
    agent = t.agent;
    for (const q of t.items) {
      if (q.type === "QCM" || q.type === "QIM") {
        const attendus = new Set(q.attendus);
        const choix = new Set(q.choix);
        const liste = q.propositions ?? options.get(q.questionId) ?? [...new Set([...q.attendus, ...q.choix])];
        const sans = q.sansJugement ? new Set(q.sansJugement) : null;
        for (const p of liste) {
          if (q.type === "QCM") {
            if (attendus.has(p)) compter(q, "bonne-reponse", p, choix.has(p) ? "juste" : "erreur");
            else compter(q, "distracteur", p, choix.has(p) ? "erreur" : "juste");
            continue;
          }
          const nature = attendus.has(p) ? "proposition-vraie" : "proposition-fausse";
          if (choix.has(p)) {
            compter(q, nature, p, attendus.has(p) ? "juste" : "erreur");
          } else if (sans) {
            compter(q, nature, p, sans.has(p) ? "vide" : attendus.has(p) ? "erreur" : "juste");
          } else if (q.nonJugees === 0) {
            compter(q, nature, p, attendus.has(p) ? "erreur" : "juste");
          } else {
            compter(q, nature, p, "incertain");
          }
        }
      } else if (q.type === "SCH") {
        for (const l of q.legendes ?? []) {
          compter(q, "legende", `${l.numero}. ${l.attendu}`, l.verdict === "juste" ? "juste" : l.verdict === "vide" ? "vide" : "erreur");
        }
      } else if (q.type === "ORD") {
        // Réponse scellée : « 2. texte » pour une étape placée, « — texte » sans rang.
        const donnes = q.choix.map((c) => {
          const m = c.match(RANG);
          return m ? { rang: Number(m[1]), texte: m[2] } : { rang: null, texte: c.replace(/^— /, "") };
        });
        q.attendus.forEach((ligne, i) => {
          const texte = ligne.match(RANG)?.[2] ?? ligne;
          const donne = donnes.find((d) => d.texte === texte);
          compter(q, "etape", `${i + 1}. ${texte}`, !donne || donne.rang === null ? "vide" : donne.rang === i + 1 ? "juste" : "erreur");
        });
      } else if (q.type === "TAT") {
        q.attendus.forEach((ligne) => {
          const m = ligne.match(TROU);
          if (!m) return;
          const donne = q.choix.find((c) => c.startsWith(`${m[1]} → `))?.match(TROU)?.[2] ?? "—";
          compter(q, "trou", `Trou ${m[1]} : ${m[2]}`, donne === "—" ? "vide" : donne === m[2] ? "juste" : "erreur");
        });
      }
    }
  }

  return [...compteurs.values()]
    .map((c) => {
      const tauxErreur = tauxAgents(c.erreurs, c.n, c.agents.size);
      return {
        questionId: c.q.questionId,
        enonce: c.q.enonce,
        type: c.q.type,
        nature: c.nature,
        element: c.element,
        n: c.n,
        erreurs: c.erreurs,
        sansReponse: c.sansReponse,
        nonDepartage: c.nonDepartage,
        tauxErreur,
        nonFonctionnel: c.nature === "distracteur" && tauxErreur.taux !== null && tauxErreur.taux < SEUILS_STAT.distracteur,
      };
    })
    .sort(
      (a, b) =>
        (b.tauxErreur.taux ?? -1) - (a.tauxErreur.taux ?? -1) ||
        b.erreurs - a.erreurs ||
        a.questionId.localeCompare(b.questionId) ||
        a.element.localeCompare(b.element),
    );
}

/**
 * Les points qui accrochent : erreurs fréquentes, hors distracteurs non
 * fonctionnels (dits à part), sur un effectif suffisant. Une mauvaise réponse
 * de QCM choisie souvent y figure : c'est une idée fausse répandue.
 */
export function pointsManques(elements: readonly AnalyseElement[], maximum = 15): AnalyseElement[] {
  return elements.filter((e) => e.tauxErreur.taux !== null && e.erreurs > 0).slice(0, maximum);
}

// ────────────────────────────────────────────────────────────────── sources

export interface AnalyseSource {
  source: string;
  /** Questions du module qui citent cette source. */
  questions: number;
  /** Réponses données aux questions qui la citent, et leur réussite. */
  reussite: Taux;
}

/**
 * Réussite par source citée : les questions qui renvoient à une même section
 * du support se lisent ensemble. La moins réussie d'abord — c'est la partie
 * du module à retravailler.
 */
export function analyserSources(tentatives: readonly Tentative[], depuis: string | null = null): AnalyseSource[] {
  const m = new Map<string, { questions: Set<string>; agents: Set<number>; n: number; k: number }>();
  for (const t of tentatives) {
    if (!t.items || !dansPeriode(t.le, depuis)) continue;
    for (const q of t.items) {
      for (const s of new Set(q.sources)) {
        const c = m.get(s) ?? { questions: new Set<string>(), agents: new Set<number>(), n: 0, k: 0 };
        c.questions.add(q.questionId);
        c.agents.add(t.agent);
        c.n += 1;
        if (q.correct) c.k += 1;
        m.set(s, c);
      }
    }
  }
  return [...m.entries()]
    .map(([source, c]) => ({ source, questions: c.questions.size, reussite: tauxAgents(c.k, c.n, c.agents.size) }))
    .sort(
      (a, b) =>
        (a.reussite.taux === null ? 1 : 0) - (b.reussite.taux === null ? 1 : 0) ||
        (a.reussite.taux ?? 0) - (b.reussite.taux ?? 0) ||
        a.source.localeCompare(b.source),
    );
}

// ───────────────────────────────────────────────── actions d'amélioration

export interface ActionFormation {
  id: number;
  moduleId: string;
  /** Date de l'action, `AAAA-MM-JJ`. */
  le: string;
  description: string;
  auteur: string;
}

export interface AvantApres {
  action: ActionFormation;
  /** Premiers essais entre l'action précédente (ou le début) et celle-ci. */
  avant: Taux;
  /** Premiers essais entre celle-ci et l'action suivante (ou aujourd'hui). */
  apres: Taux;
}

/**
 * Réussite au premier essai avant et après chaque action, chaque période
 * bornée par les actions voisines : l'effet d'une action ne se mêle pas à
 * celui de la suivante. Le premier essai seulement : il mesure la formation
 * reçue, non l'entraînement accumulé par ceux qui repassent.
 */
export function avantApres(tentatives: readonly Tentative[], actions: readonly ActionFormation[]): AvantApres[] {
  const premiers = premiersEssais(tentatives, null);
  const triees = [...actions].sort((a, b) => a.le.localeCompare(b.le) || a.id - b.id);
  const entre = (de: string | null, a: string | null) => {
    const l = premiers.filter((t) => (de === null || jourParis(t.le) >= de) && (a === null || jourParis(t.le) < a));
    return reussiteDe(l);
  };
  return triees.map((action, i) => ({
    action,
    avant: entre(i > 0 ? triees[i - 1].le : null, action.le),
    apres: entre(action.le, i < triees.length - 1 ? triees[i + 1].le : null),
  }));
}

// ────────────────────────────────────────────────────────────────── tableur

/**
 * Une cellule de texte pour le tableur (`csv` de `lib/registre.ts`) : un texte
 * qui commencerait par `=`, `+`, `-`, `@` ou une tabulation est préfixé d'une
 * apostrophe, sans quoi le tableur l'exécuterait comme une formule (injection
 * de formule). Énoncés, propositions et actions viennent de saisies libres.
 */
export function texteTableur(s: string): string {
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
}
