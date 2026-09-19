/**
 * Modèle de contenu.
 *
 * Ce fichier ne contient que des types. Le contenu réel (modules, questions,
 * documents) vit dans `content/modules/` et `content/parcours.ts`, chargés
 * uniquement par du code serveur — voir `content/store.ts`.
 *
 * Invariant de confidentialité : aucune structure de ce fichier ne porte
 * d'identité apprenant. Les résultats d'évaluation ne sont jamais écrits.
 */

/** Marqueur d'un élément non encore arbitré par le pharmacien responsable. */
export const A_PRECISER = "[à préciser]" as const;

import { motAttendu, normaliser, verdictLegende, type Legende, type Repere } from "./schema";
import {
  BAREME_DEFAUT,
  libelleOrdre,
  libelleQcm,
  libelleQim,
  libelleSchema,
  libelleTrous,
  noterElements,
  type Bareme,
} from "./bareme";
export type { Legende, Repere };
export type { Bareme } from "./bareme";

/**
 * Niveaux d'habilitation de l'unité.
 * Socle transversal N1a ; parcours Chimiothérapie N1c → N2 → N3 ;
 * parcours Préparatoire P1 → P2.
 *
 * Depuis la décision du 19/09/2026 (question 38, choix b), des niveaux
 * peuvent être **déposés en base** : le type reste donc ouvert. Les codes
 * ci-dessous sont ceux de la fiche d'habilitation, gardés nommément pour que
 * l'éditeur continue de les proposer ; `(string & {})` accepte les autres
 * sans faire disparaître cette complétion.
 */
export const NIVEAUX_FICHE = ["N1a", "N1c", "N2", "N3", "P1", "P2"] as const;

export type NiveauHabilitation =
  | (typeof NIVEAUX_FICHE)[number]
  | typeof A_PRECISER
  // `string & {}` : accepte n'importe quel code déposé sans faire disparaître
  // la complétion sur les codes de la fiche.
  | (string & NonNullable<unknown>);

export type TypeParcours = "integration" | "maintien";

export interface Reference {
  /** Intitulé exact de la source. */
  libelle: string;
  /** Émetteur (ANSM, INRS, AFNOR…). */
  source: string;
  /** Millésime ou date de la version citée. */
  date: string;
  /** URL de vérification. Absente si la source n'est pas librement accessible. */
  url?: string;
  /** Renvoi interne (chapitre, ligne directrice, numéro de fiche). */
  localisation?: string;
}

/** Natures d'un document rattaché ; « synthese » est affichée en fin de test. */
export type NatureDocument = "procedure-interne" | "reglementaire" | "fiche-reflexe" | "video" | "synthese";

export const NATURES_DOCUMENT: Record<NatureDocument, string> = {
  "procedure-interne": "Procédure interne",
  reglementaire: "Référentiel",
  "fiche-reflexe": "Fiche réflexe",
  video: "Vidéo",
  synthese: "Fiche de synthèse",
};

export function estNatureDocument(v: unknown): v is NatureDocument {
  return typeof v === "string" && Object.prototype.hasOwnProperty.call(NATURES_DOCUMENT, v);
}

export function libelleNature(nature: string): string {
  return estNatureDocument(nature) ? NATURES_DOCUMENT[nature] : nature;
}

/**
 * Document de synthèse d'un module, affiché en fin d'évaluation et
 * d'entraînement (transposé du support de révision du Lecteur QIM · QCM) :
 * un PDF ou une image s'affichent en ligne, tout autre fichier par un lien.
 */
export interface SyntheseDocument {
  id: string;
  titre: string;
  url: string;
  affichage: "pdf" | "image" | "lien";
}

export interface Ressource {
  id: string;
  titre: string;
  /** Nature : procédure interne, fiche réflexe, texte réglementaire, vidéo, fiche de synthèse. */
  nature: NatureDocument;
  /**
   * URL externe pour une source publique, ou chemin de document interne.
   * `null` = emplacement à alimenter par la PUI.
   */
  url: string | null;
  commentaire?: string;
}

export interface SectionModule {
  /** Titre de la section, affiché dans le sommaire. */
  titre: string;
  /** Corps rédigé. Markdown restreint : **gras**, listes `- `, paragraphes. */
  corps: string;
  /** Références appuyant spécifiquement cette section. */
  references?: Reference[];
}

export type Option = {
  id: string;
  texte: string;
};

/**
 * Formats d'évaluation.
 *
 * - `QCM` — question à choix multiple. Une ou plusieurs propositions exactes,
 *   notation tout-ou-rien : la réponse doit correspondre exactement à
 *   l'ensemble attendu.
 * - `QIM` — question à interprétation multiple. Chaque proposition est jugée
 *   vraie ou fausse indépendamment ; la note dépend du nombre de discordances
 *   (propositions cochées à tort + propositions exactes non cochées).
 * - `SCH` — schéma à compléter (repris du Lecteur QIM · QCM) : une image dont
 *   les légendes ont été masquées ; l'apprenant écrit chaque légende (mode
 *   « écrire ») ou l'attribue parmi une liste mélangée (mode « choisir »).
 * - `ORD` — séquence à ordonner : des étapes présentées dans le désordre,
 *   auxquelles l'apprenant donne un rang. L'ordre juste est porté par
 *   `bonnesReponses`, qui ne quitte jamais le serveur ; `options` part
 *   mélangée. Une étape à sa place vaut sa part, une étape mal placée la
 *   retire, une étape sans rang ne compte pas.
 * - `TAT` — texte à trous : l'énoncé porte des marques `{1}`, `{2}`…, et
 *   chaque trou se remplit avec une vignette prise dans une liste commune
 *   (menu déroulant). `options` porte les vignettes — les attendues et les
 *   leurres, mélangées — et `bonnesReponses` la vignette attendue de chaque
 *   trou, dans l'ordre des trous.
 */
export type TypeQuestion = "QCM" | "QIM" | "SCH" | "ORD" | "TAT";

/** Marque d'un trou dans l'énoncé d'un texte à trous : `{1}`, `{2}`… */
export const RE_TROU = /\{(\d{1,2})\}/g;

/** Numéros des trous d'un énoncé, dans l'ordre d'apparition, sans doublon. */
export function trousDuTexte(enonce: string): number[] {
  const vus: number[] = [];
  for (const m of enonce.matchAll(RE_TROU)) {
    const n = Number(m[1]);
    if (n > 0 && !vus.includes(n)) vus.push(n);
  }
  return vus;
}

/** Découpe un énoncé à trous en morceaux de texte et en numéros de trou. */
export function morceauxDuTexte(enonce: string): ({ texte: string } | { trou: number })[] {
  const out: ({ texte: string } | { trou: number })[] = [];
  let reste = 0;
  for (const m of enonce.matchAll(RE_TROU)) {
    if (m.index > reste) out.push({ texte: enonce.slice(reste, m.index) });
    out.push({ trou: Number(m[1]) });
    reste = m.index + m[0].length;
  }
  if (reste < enonce.length) out.push({ texte: enonce.slice(reste) });
  return out;
}

export type ModeReponse = "ecrire" | "choisir";

/** Image d'un schéma à compléter, servie par `/api/images/[id]`. */
export interface ImageQuestion {
  id: string;
  url: string;
  largeur: number;
  hauteur: number;
  /** Description lue à la place de l'image par un lecteur d'écran. */
  alt: string;
}

/*
 * Barèmes des QIM et des schémas à compléter : réglables par l'administrateur
 * (`content/bareme.ts`, décision du 18/09/2026, question 10). Les valeurs par
 * défaut sont celles reprises du Lecteur QIM · QCM : QIM 1 · 0,5 · 0 selon les
 * discordances ; schéma 1 point au plus, chaque légende valant 1/n, fausse
 * elle le retire, vide elle ne compte pas, plancher zéro.
 */

/**
 * Question d'évaluation.
 *
 * `bonnesReponses` et `justification` ne quittent JAMAIS le serveur avant
 * soumission : `sanitizeQuestion()` les retire pour l'envoi au navigateur,
 * et la correction est faite par la route API.
 */
export interface Question {
  id: string;
  enonce: string;
  type: TypeQuestion;
  options: Option[];
  /** Identifiants des options correctes. */
  bonnesReponses: string[];
  /** Explication affichée après correction. */
  justification: string;
  /**
   * Question éliminatoire : une erreur invalide le module quel que soit le
   * score global (typiquement sécurité opérateur ou intégrité patient).
   * Sur une QIM, toute discordance vaut erreur.
   */
  eliminatoire?: boolean;
  /**
   * Réservée à l'évaluation (décision du 18/09/2026, question 18, choix c) :
   * jamais posée en entraînement ni dans le tirage Découverte ; tirée en
   * priorité dans les tirages qui peuvent conclure (Habilitation, Complet).
   */
  reservee?: boolean;
  references?: Reference[];
  /** Schéma à compléter : les légendes à écrire, avec leur place sur l'image. */
  legendes?: Legende[];
  /** Schéma à compléter : l'image. */
  image?: ImageQuestion;
  /** Schéma à compléter : écrire la légende, ou la choisir dans une liste. */
  modeReponse?: ModeReponse;
  /** `code` pour une question versionnée avec le site, `base` pour une question déposée. */
  origine?: "code" | "base";
}

/** Origine d'un module : versionné avec le code, ou déposé depuis l'administration. */
export type OrigineModule = "code" | "base";

/**
 * Mise en situation : une vignette décrivant un cas concret de l'unité, suivie
 * des questions qui s'y rapportent. C'est le format qui teste le transfert —
 * savoir réciter une règle et savoir l'appliquer sous contrainte ne sont pas
 * la même compétence.
 */
export interface MiseEnSituation {
  id: string;
  titre: string;
  /** La vignette elle-même : situation, contraintes, ce qui est observé. */
  contexte: string;
  questions: Question[];
}

/**
 * Affectation d'un module.
 *
 * - `tronc-commun` — exigé de tout agent de l'unité, quel que soit son poste et
 *   son niveau. C'est le socle : sécurité, environnement, qualité.
 * - `poste` — exigé au titre d'un ou plusieurs postes de travail précis.
 *
 * Dans les deux cas, la maille du module est le **critère** de la fiche
 * d'habilitation : un module couvre un critère et un seul, ce qui permet au
 * rapport d'évaluation de se lire ligne à ligne en face de la fiche.
 */
export type Affectation = "tronc-commun" | "poste";

export interface Module {
  id: string;
  titre: string;
  /**
   * Illustration de domaine (`content/badges.ts`). Vide ou absent : une
   * proposition est faite d'après le titre à l'affichage (`badgeEffectif`) ;
   * `SANS_BADGE` la refuse.
   */
  badge?: string;
  /** Une phrase : ce que l'apprenant sait faire à l'issue du module. */
  objectif: string;
  /** Bloc de compétence de rattachement (fiche d'habilitation CHD Vendée). */
  bloc: number | typeof A_PRECISER;
  affectation: Affectation;
  /**
   * Identifiant du critère couvert. C'est la clé qui relie le module à la
   * ligne correspondante de la fiche d'habilitation.
   */
  critereId: string | typeof A_PRECISER;
  /** Postes concernés. Vide pour un module de tronc commun (tous postes). */
  postes: string[];
  niveaux: NiveauHabilitation[];
  /** Parcours dans lesquels le module apparaît. */
  parcours: TypeParcours[];
  /** Durée indicative de lecture + évaluation, en minutes. */
  dureeMinutes: number | typeof A_PRECISER;
  /** `true` pour un module entièrement rédigé, `false` pour un emplacement. */
  redige: boolean;
  sections: SectionModule[];
  ressources: Ressource[];
  /** Banque de questions isolées (QCM et QIM). */
  questions: Question[];
  /** Vignettes de mise en situation et leurs questions. */
  misesEnSituation: MiseEnSituation[];
  /**
   * Seuil de réussite en pourcentage de points. Pour un module du code, la
   * valeur effective est résolue à la lecture (`content/store.ts`) : seuil
   * réglé pour ce module, sinon seuil par défaut du barème.
   */
  seuilReussite: number;
  /** Périodicité de revalidation, en mois. */
  periodiciteMois: number | typeof A_PRECISER;
  bibliographie: Reference[];
  /** `code` (défaut) ou `base` pour un module déposé depuis l'administration. */
  origine?: OrigineModule;
  /** Module déposé : filières auxquelles il est proposé (vide = tronc commun). */
  filieres?: string[];
  /** Module déposé : `brouillon`, `publie` ou `retire`. */
  statut?: "brouillon" | "publie" | "retire";
}

export interface Bloc {
  numero: number;
  titre: string;
  /** Description du périmètre du bloc. */
  perimetre: string;
  moduleIds: string[];
}

export interface Parcours {
  id: TypeParcours;
  titre: string;
  destinataire: string;
  description: string;
  blocs: Bloc[];
}

/** Légende telle qu'elle est envoyée au navigateur : sa place, jamais son mot. */
export interface LegendePublique {
  id: string;
  repere: Repere;
}

/** Question telle qu'elle est envoyée au navigateur : sans les réponses. */
export type QuestionPublique = Omit<
  Question,
  "bonnesReponses" | "justification" | "legendes"
> & {
  /** Vignette de rattachement, `null` pour une question isolée. */
  situation: { id: string; titre: string; contexte: string } | null;
  /** Schéma à compléter : les repères, sans les mots. */
  legendes?: LegendePublique[];
  /** Mode « choisir » : les mots attendus, mélangés, sans leur place. */
  etiquettes?: string[];
};

function melangerTexte(xs: string[]): string[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function melangerOptions(xs: Option[]): Option[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function sanitizeQuestion(
  q: Question,
  situation: QuestionPublique["situation"] = null,
): QuestionPublique {
  const { bonnesReponses: _b, justification: _j, legendes, ...reste } = q;
  // Séquence et texte à trous : l'ordre de rangement des options porte la
  // réponse (l'ordre juste, les vignettes attendues d'abord). Il est mélangé
  // avant l'envoi — `bonnesReponses` est déjà retiré, mais pas l'ordre.
  if (q.type === "ORD" || q.type === "TAT") {
    return { ...reste, options: melangerOptions(q.options), situation };
  }
  if (q.type !== "SCH") return { ...reste, situation };
  const publiques = (legendes ?? []).map((l) => ({ id: l.id, repere: l.repere }));
  const etiquettes =
    q.modeReponse === "choisir"
      ? melangerTexte((legendes ?? []).map((l) => motAttendu(l.attendu)))
      : undefined;
  return { ...reste, situation, legendes: publiques, ...(etiquettes ? { etiquettes } : {}) };
}

/** Banque complète d'un module : questions isolées puis mises en situation. */
export function banqueDuModule(m: Module): Question[] {
  return [...m.questions, ...m.misesEnSituation.flatMap((s) => s.questions)];
}

/** Banque publique d'un module, vignettes rattachées, réponses retirées. */
export function banquePublique(m: Module): QuestionPublique[] {
  return [
    ...m.questions.map((q) => sanitizeQuestion(q)),
    ...m.misesEnSituation.flatMap((s) =>
      s.questions.map((q) =>
        sanitizeQuestion(q, {
          id: s.id,
          titre: s.titre,
          contexte: s.contexte,
        }),
      ),
    ),
  ];
}

/**
 * Réponse d'un apprenant à une question.
 *
 * - `choix` : identifiants des options cochées (QCM) ou jugées vraies (QIM) ;
 * - `juges` : QIM en Vrai/Faux, identifiants des propositions effectivement
 *   jugées — une proposition laissée sans réponse compte alors comme une
 *   discordance, ce qui ne peut pas être déduit de `choix` seul ;
 * - `legendes` : schéma à compléter, le mot écrit (ou choisi) par légende.
 */
export interface ReponseApprenant {
  choix: string[];
  juges?: string[];
  legendes?: Record<string, string>;
  /** Séquence à ordonner : rang donné à chaque étape (1 = première). */
  rangs?: Record<string, number>;
  /** Texte à trous : vignette choisie pour chaque trou, par numéro de trou. */
  trous?: Record<string, string>;
}

export interface NoteQuestion {
  /** Points obtenus, arrondis au centième ; au plus `max`. */
  note: number;
  /** Propositions mal classées, ou légendes fausses ou vides. */
  discordances: number;
  /** Propositions ou légendes laissées sans réponse — « je ne sais pas », légende vide. */
  nonJugees: number;
  /** Plafond de la question selon le barème : son poids dans le total (1 par défaut). */
  max: number;
}

/**
 * Note d'une question, sur 1 point, selon le barème en vigueur.
 *
 * QCM : tout ou rien. QIM : barème à discordance. SCH : chaque légende vaut
 * 1/n, juste elle l'ajoute, fausse elle le retire, vide elle ne compte pas
 * (réglable) ; plancher zéro ; ou tout ou rien. Dans les trois formats,
 * `discordances === 0` signifie que la réponse est entièrement exacte — c'est
 * ce que lit la règle des questions éliminatoires.
 */
export function noterQuestion(q: Question, rep: ReponseApprenant, bareme: Bareme = BAREME_DEFAUT): NoteQuestion {
  if (q.type === "SCH") return noterSchema(q, rep.legendes ?? {}, bareme);
  if (q.type === "ORD") return noterOrdre(q, rep.rangs ?? {}, bareme);
  if (q.type === "TAT") return noterTrous(q, rep.trous ?? {}, bareme);

  const format = q.type === "QIM" ? bareme.qim : bareme.qcm;
  const attendues = new Set(q.bonnesReponses);
  const cochees = new Set(rep.choix);
  const jugees = rep.juges ? new Set(rep.juges) : null;

  let justes = 0;
  let faux = 0;
  let nonJugees = 0;

  for (const o of q.options) {
    // QIM : une proposition non jugée est un « je ne sais pas » — elle ne
    // rapporte ni ne retire rien (barème des quiz de Flore), mais elle reste
    // une discordance : la question n'est pas juste, et une éliminatoire échoue.
    if (q.type === "QIM" && jugees && !jugees.has(o.id)) {
      nonJugees += 1;
      continue;
    }
    if (attendues.has(o.id) === cochees.has(o.id)) justes += 1;
    else faux += 1;
  }

  const note = noterElements(justes, faux, nonJugees, format);
  return { note, discordances: faux + nonJugees, nonJugees, max: format.max };
}

function noterSchema(q: Question, reponses: Record<string, string>, bareme: Bareme): NoteQuestion {
  const format = bareme.schema;
  const legendes = q.legendes ?? [];
  if (legendes.length === 0) return { note: 0, discordances: 0, nonJugees: 0, max: format.max };
  let justes = 0;
  let faux = 0;
  let vides = 0;
  for (const l of legendes) {
    const v = verdictLegende(reponses[l.id], l.attendu);
    if (v === "juste") justes += 1;
    else if (v === "fausse") faux += 1;
    else vides += 1;
  }
  const note = noterElements(justes, faux, vides, format);
  return { note, discordances: faux + vides, nonJugees: vides, max: format.max };
}

/**
 * Séquence à ordonner : chaque étape est un élément. Elle est juste si son
 * rang est celui qu'elle occupe dans `bonnesReponses`, fausse si le rang est
 * un autre, sans réponse si l'apprenant ne lui en a donné aucun.
 */
function noterOrdre(q: Question, rangs: Record<string, number>, bareme: Bareme): NoteQuestion {
  const format = bareme.ordre;
  const attendu = q.bonnesReponses;
  if (attendu.length === 0) return { note: 0, discordances: 0, nonJugees: 0, max: format.max };
  let justes = 0;
  let faux = 0;
  let sans = 0;
  attendu.forEach((id, i) => {
    const r = rangs[id];
    if (!r) sans += 1;
    else if (r === i + 1) justes += 1;
    else faux += 1;
  });
  const note = noterElements(justes, faux, sans, format);
  return { note, discordances: faux + sans, nonJugees: sans, max: format.max };
}

/**
 * Texte à trous : chaque trou est un élément. La comparaison porte sur le
 * texte de la vignette, non sur son identifiant — deux vignettes peuvent
 * porter le même mot, et l'apprenant ne choisit que ce qu'il lit.
 */
function noterTrous(q: Question, trous: Record<string, string>, bareme: Bareme): NoteQuestion {
  const format = bareme.trous;
  const attendu = q.bonnesReponses;
  if (attendu.length === 0) return { note: 0, discordances: 0, nonJugees: 0, max: format.max };
  const texteDe = (id: string) => normaliser(q.options.find((o) => o.id === id)?.texte ?? "");
  let justes = 0;
  let faux = 0;
  let sans = 0;
  attendu.forEach((idAttendu, i) => {
    const choisi = trous[String(i + 1)];
    if (!choisi) sans += 1;
    else if (texteDe(choisi) !== "" && texteDe(choisi) === texteDe(idAttendu)) justes += 1;
    else faux += 1;
  });
  const note = noterElements(justes, faux, sans, format);
  return { note, discordances: faux + sans, nonJugees: sans, max: format.max };
}

/** Libellé lisible d'un format, tel qu'il s'annonce à l'apprenant. */
export function libelleFormat(q: Pick<Question, "type" | "enonce" | "modeReponse">): string {
  if (q.type === "QIM") return "QIM — barème à la discordance";
  if (q.type === "ORD") return "Séquence — étapes à ordonner";
  if (q.type === "TAT") return "Texte à trous — vignettes à placer";
  if (q.type === "SCH") {
    return q.modeReponse === "choisir"
      ? "Schéma — légendes à attribuer"
      : "Schéma — légendes à écrire";
  }
  return q.enonce.includes("plusieurs")
    ? "QCM — plusieurs réponses"
    : "QCM — une seule réponse";
}

/** Barème lisible d'un format, annoncé sous chaque énoncé, selon le barème en vigueur. */
export function libelleBareme(q: Pick<Question, "type" | "enonce">, bareme: Bareme = BAREME_DEFAUT): string {
  if (q.type === "QIM") return libelleQim(bareme);
  if (q.type === "SCH") return libelleSchema(bareme);
  if (q.type === "ORD") return libelleOrdre(bareme);
  if (q.type === "TAT") return libelleTrous(bareme);
  return libelleQcm(bareme);
}
