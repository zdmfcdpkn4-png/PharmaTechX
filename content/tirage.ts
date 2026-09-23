import type { NiveauQuestion } from "./types";

/**
 * Tirage des questions d'un module, et contrôle de sa conformité.
 *
 * Questions réservées à l'évaluation (décision du 18/09/2026, question 18,
 * choix c) : jamais posées en entraînement ni dans le tirage Découverte ;
 * elles n'entrent que dans les tirages qui peuvent conclure, Habilitation et
 * Complet, en mode évaluation, où elles sont tirées en priorité.
 *
 * Tirage selon le niveau cible (questions 62 et 63, choix a, 23/09/2026) :
 *  - une question au signalement ouvert est écartée de tout tirage, jusqu'à
 *    la clôture du signalement ;
 *  - le niveau cible du profil fixe un plafond de niveau de question, réglé
 *    au barème ; une question sans niveau (« à préciser ») n'est écartée par
 *    aucun plafond ;
 *  - les éliminatoires sont toujours posées, et les obligatoires dans les
 *    tirages qui peuvent conclure ; une question toujours posée qu'un
 *    signalement écarte est remplacée par une question du même niveau ;
 *  - le reste est tiré au hasard, chaque niveau jusqu'à sa part du tirage,
 *    réglée au barème pour le plafond : deux passations ont la même
 *    composition par niveau. Les places qu'un niveau ne peut remplir vont
 *    aux questions sans niveau, puis aux autres niveaux admis.
 *
 * Le tirage se fait dans le navigateur ; le serveur vérifie sa conformité à
 * la correction (`tirageConforme`). Aucune dépendance à Next ni à la base :
 * testable tel quel.
 */

export type Difficulte = "decouverte" | "habilitation" | "complet";
export type ModeTirage = "evaluation" | "entrainement";

/** Les trois niveaux de question, du plus simple au plus exigeant — ceux de `NIVEAUX_QUESTION`. */
export const ORDRE_NIVEAUX: readonly NiveauQuestion[] = ["initial", "intermediaire", "avance"];

/** Nom d'un niveau dans une phrase ; `types.ts` ne s'importe pas ici, il importe le barème qui importe ce module. */
const NOM_NIVEAU: Record<NiveauQuestion, string> = {
  initial: "initial",
  intermediaire: "intermédiaire",
  avance: "avancé",
};

/** Part de chaque niveau de question dans un tirage, en pourcentage. */
export type Repartition = Record<NiveauQuestion, number>;

export interface QuestionTirable {
  id: string;
  eliminatoire?: boolean;
  reservee?: boolean;
  obligatoire?: boolean;
  niveauQuestion?: NiveauQuestion | null;
  situation?: { id: string } | null;
}

/** Ce qui règle un tirage, la banque mise à part. */
export interface ContexteTirage {
  mode: ModeTirage;
  difficulte: Difficulte;
  /** Taille visée, réglée au barème ; `null` : toute la banque admise (Complet). */
  nb: number | null;
  /** Niveau de question le plus élevé tiré ; `null` : aucun plafond. */
  plafond: NiveauQuestion | null;
  /** Part de chaque niveau sous ce plafond ; `null` : pas de répartition par niveau. */
  repartition: Repartition | null;
  /** Questions au signalement ouvert : écartées du tirage. */
  signalees: readonly string[];
}

/** Les réservées n'entrent que dans un tirage qui peut conclure, en mode évaluation. */
export function reserveesAdmises(mode: ModeTirage, difficulte: Difficulte): boolean {
  return mode === "evaluation" && difficulte !== "decouverte";
}

/** Les obligatoires sont toujours posées dans les mêmes tirages : ceux qui peuvent conclure, en évaluation. */
export function obligatoiresForcees(mode: ModeTirage, difficulte: Difficulte): boolean {
  return reserveesAdmises(mode, difficulte);
}

export function niveauDe(q: QuestionTirable): NiveauQuestion | null {
  return q.niveauQuestion ?? null;
}

/** Sous le plafond : toujours vrai pour une question sans niveau, ou sans plafond. */
export function sousPlafond(niveau: NiveauQuestion | null | undefined, plafond: NiveauQuestion | null): boolean {
  if (!niveau || !plafond) return true;
  return ORDRE_NIVEAUX.indexOf(niveau) <= ORDRE_NIVEAUX.indexOf(plafond);
}

/** Toujours posée dans ce tirage : éliminatoire, ou obligatoire dans un tirage qui peut conclure. */
export function toujoursPosee(q: QuestionTirable, c: Pick<ContexteTirage, "mode" | "difficulte">): boolean {
  return q.eliminatoire === true || (q.obligatoire === true && obligatoiresForcees(c.mode, c.difficulte));
}

/** Plafond et règle des réservées ; le signalement se juge à part. */
function admiseHorsSignalement(q: QuestionTirable, c: ContexteTirage): boolean {
  return sousPlafond(niveauDe(q), c.plafond) && (reserveesAdmises(c.mode, c.difficulte) || !q.reservee);
}

/** Les questions admises au tirage, dans l'ordre de la banque. */
export function admissibles<Q extends QuestionTirable>(banque: readonly Q[], c: ContexteTirage): Q[] {
  const signalees = new Set(c.signalees);
  return banque.filter((q) => !signalees.has(q.id) && admiseHorsSignalement(q, c));
}

/**
 * Questions toujours posées qu'un signalement ouvert écarte : chacune cède sa
 * place à une question du même niveau (question 63, choix a).
 */
export function toujoursPoseesEcartees<Q extends QuestionTirable>(banque: readonly Q[], c: ContexteTirage): Q[] {
  const signalees = new Set(c.signalees);
  return banque.filter((q) => signalees.has(q.id) && toujoursPosee(q, c) && admiseHorsSignalement(q, c));
}

/**
 * Nombre de questions de chaque niveau dans un tirage de `nb`, selon les
 * parts réglées : méthode des plus forts restes, en entiers — à reste égal,
 * le niveau le plus simple d'abord. Un niveau au-dessus du plafond ne reçoit
 * rien.
 */
export function repartir(nb: number, repartition: Partial<Repartition> | null, plafond: NiveauQuestion | null): Repartition {
  const out: Repartition = { initial: 0, intermediaire: 0, avance: 0 };
  const admis = ORDRE_NIVEAUX.filter((n) => sousPlafond(n, plafond));
  const poids = admis.map((n) => Math.max(0, Math.round(repartition?.[n] ?? 0)));
  const total = poids.reduce((s, p) => s + p, 0);
  if (!(nb > 0) || total <= 0) return out;
  const produits = poids.map((p) => Math.round(nb) * p);
  const parts = produits.map((x) => Math.floor(x / total));
  let reste = Math.round(nb) - parts.reduce((s, p) => s + p, 0);
  const ordre = admis.map((_, i) => i).sort((a, b) => (produits[b] % total) - (produits[a] % total) || a - b);
  for (const i of ordre) {
    if (reste <= 0) break;
    parts[i] += 1;
    reste -= 1;
  }
  admis.forEach((n, i) => {
    out[n] = parts[i];
  });
  return out;
}

export function melanger<T>(xs: readonly T[], alea: () => number = Math.random): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(alea() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Ajoute des candidates, dans leur ordre, jusqu'à `nb` questions. */
function completer<Q>(choisies: Set<Q>, candidates: readonly Q[], nb: number): void {
  for (const q of candidates) {
    if (choisies.size >= nb) return;
    choisies.add(q);
  }
}

/** Questions isolées d'abord, dans l'ordre de la banque ; puis les mises en situation, par vignette. */
function ordonner<Q extends QuestionTirable>(admises: readonly Q[], choisies: ReadonlySet<Q>): Q[] {
  const situations = new Map<string, Q[]>();
  const isolees: Q[] = [];
  for (const q of admises) {
    if (!choisies.has(q)) continue;
    if (q.situation) {
      const liste = situations.get(q.situation.id) ?? [];
      liste.push(q);
      situations.set(q.situation.id, liste);
    } else {
      isolees.push(q);
    }
  }
  return [...isolees, ...[...situations.values()].flat()];
}

/**
 * Tirage. Les questions toujours posées sont retenues — laisser au hasard le
 * soin de poser ou non la question de sécurité n'aurait pas de sens —, puis
 * chaque niveau est complété jusqu'à sa part, réservées d'abord ; enfin les
 * places restantes, jusqu'à `nb` (null : toute la banque admise). Les mises
 * en situation sont rendues par vignette, après les questions isolées, dans
 * l'ordre de la banque.
 */
export function tirer<Q extends QuestionTirable>(
  banque: readonly Q[],
  c: ContexteTirage,
  alea: () => number = Math.random,
): Q[] {
  const admises = admissibles(banque, c);
  if (c.nb === null || c.nb >= admises.length) return admises;
  const nb = c.nb;
  const choisies = new Set<Q>(admises.filter((q) => toujoursPosee(q, c)));
  // Les réservées d'abord (elles ne sont admises que là où elles passent en priorité), chaque lot mélangé.
  const libres = (garder: (q: Q) => boolean): Q[] => [
    ...melanger(admises.filter((q) => !choisies.has(q) && garder(q) && q.reservee), alea),
    ...melanger(admises.filter((q) => !choisies.has(q) && garder(q) && !q.reservee), alea),
  ];
  if (c.repartition) {
    for (const ecartee of toujoursPoseesEcartees(banque, c)) {
      const remplacante = libres((q) => niveauDe(q) === niveauDe(ecartee))[0];
      if (remplacante) choisies.add(remplacante);
    }
    const parts = repartir(nb, c.repartition, c.plafond);
    for (const n of ORDRE_NIVEAUX) {
      let manque = parts[n] - [...choisies].filter((q) => niveauDe(q) === n).length;
      for (const q of libres((x) => niveauDe(x) === n)) {
        if (manque <= 0) break;
        choisies.add(q);
        manque -= 1;
      }
    }
    completer(choisies, libres((q) => niveauDe(q) === null), nb);
  }
  completer(choisies, libres(() => true), nb);
  return ordonner(admises, choisies);
}

/** Ce qu'un tirage écarte et impose, pour l'annoncer avant l'épreuve. */
export interface BilanTirage {
  /** Questions admises au tirage. */
  admises: number;
  /** Écartées par un signalement ouvert (sous le plafond, hors règle des réservées). */
  signalees: number;
  /** Au-dessus du plafond de niveau. */
  auDessus: number;
  /** Obligatoires posées (éliminatoires non comprises). */
  obligatoires: number;
  /** Questions toujours posées qu'un signalement écarte et qu'une question du même niveau remplace… */
  remplacees: number;
  /** … ou que rien ne remplace : la banque admise n'offre plus d'autre question de leur niveau. */
  nonRemplacees: number;
}

export function bilanTirage(banque: readonly QuestionTirable[], c: ContexteTirage): BilanTirage {
  const signalees = new Set(c.signalees);
  const admises = admissibles(banque, c);
  // Même compte que le tirage : chaque écartée prend une question libre de son niveau, tant qu'il en reste.
  const libres = new Map<NiveauQuestion | null, number>();
  for (const q of admises) if (!toujoursPosee(q, c)) libres.set(niveauDe(q), (libres.get(niveauDe(q)) ?? 0) + 1);
  let remplacees = 0;
  let nonRemplacees = 0;
  for (const e of c.repartition ? toujoursPoseesEcartees(banque, c) : []) {
    const reste = libres.get(niveauDe(e)) ?? 0;
    if (reste > 0) {
      libres.set(niveauDe(e), reste - 1);
      remplacees += 1;
    } else {
      nonRemplacees += 1;
    }
  }
  return {
    admises: admises.length,
    signalees: banque.filter((q) => signalees.has(q.id) && admiseHorsSignalement(q, c)).length,
    auDessus: banque.filter((q) => !sousPlafond(niveauDe(q), c.plafond)).length,
    obligatoires: admises.filter((q) => q.obligatoire && !q.eliminatoire && toujoursPosee(q, c)).length,
    remplacees,
    nonRemplacees,
  };
}

export type Conformite = { ok: true } | { ok: false; raison: string };

const s = (n: number) => (n > 1 ? "s" : "");

/**
 * Conformité d'un tirage soumis à la correction, la banque étant celle du
 * module à cet instant :
 *  - entraînement ou Découverte : aucune question réservée ; l'entraînement,
 *    corrigé question par question, ne se vérifie pas plus avant ;
 *  - évaluation : aucune question au-dessus du plafond ; toutes les questions
 *    toujours posées de la banque admise ; les réservées en priorité, niveau
 *    par niveau quand une répartition s'applique ; chaque niveau au moins à
 *    sa part, ou à ce que la banque admise en offre.
 *
 * `c.signalees` est ici ce que le serveur tient pour signalé ; il y compte
 * aussi les signalements clos depuis peu (voir la route de correction), pour
 * qu'une clôture survenue pendant l'épreuve ne la fasse pas refuser.
 */
export function tirageConforme(
  posees: readonly QuestionTirable[],
  banque: readonly QuestionTirable[],
  c: ContexteTirage,
): Conformite {
  const avecReservees = reserveesAdmises(c.mode, c.difficulte);
  if (!avecReservees && posees.some((q) => q.reservee)) {
    return {
      ok: false,
      raison:
        c.mode === "entrainement"
          ? "Une question réservée à l'évaluation ne se pose pas en entraînement."
          : "Une question réservée à l'évaluation n'entre pas dans le tirage Découverte.",
    };
  }
  if (c.mode === "entrainement") return { ok: true };

  const auDessus = posees.filter((q) => !sousPlafond(niveauDe(q), c.plafond)).length;
  if (auDessus > 0) {
    return {
      ok: false,
      raison: `Tirage non conforme : ${auDessus} question${s(auDessus)} au-dessus du niveau cible. Recommencez l'évaluation.`,
    };
  }

  const ids = new Set(posees.map((q) => q.id));
  const admises = admissibles(banque, c);
  const oubliees = admises.filter((q) => toujoursPosee(q, c) && !ids.has(q.id)).length;
  if (oubliees > 0) {
    return {
      ok: false,
      raison: `Tirage non conforme : ${oubliees} question${s(oubliees)} éliminatoire${s(oubliees)} ou obligatoire${s(oubliees)} non posée${s(oubliees)}. Recommencez l'évaluation.`,
    };
  }

  // Une strate par niveau, plus les questions sans niveau, quand une répartition s'applique ; sinon une seule.
  const strates: ((q: QuestionTirable) => boolean)[] = c.repartition
    ? [...ORDRE_NIVEAUX, null].map((n) => (q: QuestionTirable) => niveauDe(q) === n)
    : [() => true];
  if (avecReservees) {
    for (const dans of strates) {
      const libresPosees = posees.filter((q) => dans(q) && !toujoursPosee(q, c));
      const reserveesPosees = libresPosees.filter((q) => q.reservee).length;
      const disponibles = admises.filter((q) => dans(q) && q.reservee && !toujoursPosee(q, c)).length;
      const attendues = Math.min(disponibles, libresPosees.length);
      if (reserveesPosees < attendues) {
        return {
          ok: false,
          raison: `Tirage non conforme : ${attendues} question${s(attendues)} réservée${s(attendues)} à l'évaluation attendue${s(attendues)}, ${reserveesPosees} posée${s(reserveesPosees)}. Recommencez l'évaluation.`,
        };
      }
    }
  }

  if (c.repartition && c.nb !== null) {
    const parts = repartir(c.nb, c.repartition, c.plafond);
    const ecartees = toujoursPoseesEcartees(banque, c).filter((q) => !ids.has(q.id));
    for (const n of [...ORDRE_NIVEAUX, null]) {
      const auNiveau = (q: QuestionTirable) => niveauDe(q) === n;
      const disponibles = admises.filter(auNiveau).length;
      const imposees = admises.filter((q) => auNiveau(q) && toujoursPosee(q, c)).length + ecartees.filter(auNiveau).length;
      const attendu = Math.min(disponibles, Math.max(n ? parts[n] : 0, imposees));
      const pose = posees.filter(auNiveau).length;
      if (pose < attendu) {
        return {
          ok: false,
          raison: `Tirage non conforme : ${attendu} question${s(attendu)} ${n ? `de niveau ${NOM_NIVEAU[n]}` : "sans niveau"} attendue${s(attendu)}, ${pose} posée${s(pose)}. Recommencez l'évaluation.`,
        };
      }
    }
  }
  return { ok: true };
}
