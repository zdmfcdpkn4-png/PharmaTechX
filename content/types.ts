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

import { motAttendu, verdictLegende, type Legende, type Repere } from "./schema";
import { BAREME_DEFAUT, libelleQim, libelleSchema, pointsQim, type Bareme } from "./bareme";
export type { Legende, Repere };
export type { Bareme } from "./bareme";

/**
 * Niveaux d'habilitation de l'unité.
 * Socle transversal N1a ; parcours Chimiothérapie N1c → N2 → N3 ;
 * parcours Préparatoire P1 → P2.
 */
export type NiveauHabilitation =
  | "N1a"
  | "N1c"
  | "N2"
  | "N3"
  | "P1"
  | "P2"
  | typeof A_PRECISER;

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

export interface Ressource {
  id: string;
  titre: string;
  /** Nature : procédure interne, fiche réflexe, texte réglementaire, vidéo. */
  nature: "procedure-interne" | "reglementaire" | "fiche-reflexe" | "video";
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
 */
export type TypeQuestion = "QCM" | "QIM" | "SCH";

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

export function sanitizeQuestion(
  q: Question,
  situation: QuestionPublique["situation"] = null,
): QuestionPublique {
  const { bonnesReponses: _b, justification: _j, legendes, ...reste } = q;
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
}

export interface NoteQuestion {
  /** Sur 1 point, arrondi au centième. */
  note: number;
  /** Propositions mal classées, ou légendes fausses ou vides. */
  discordances: number;
  /** Propositions ou légendes laissées sans réponse. */
  nonJugees: number;
}

function arrondi(n: number): number {
  return Math.round(n * 100) / 100;
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

  const attendues = new Set(q.bonnesReponses);
  const cochees = new Set(rep.choix);
  const jugees = rep.juges ? new Set(rep.juges) : null;

  let discordances = 0;
  let nonJugees = 0;

  for (const o of q.options) {
    const doitEtreCochee = attendues.has(o.id);

    if (q.type === "QIM" && jugees && !jugees.has(o.id)) {
      nonJugees += 1;
      discordances += 1;
      continue;
    }

    const estCochee = cochees.has(o.id);
    if (doitEtreCochee !== estCochee) discordances += 1;
  }

  if (q.type === "QCM") {
    return { note: discordances === 0 ? 1 : 0, discordances, nonJugees: 0 };
  }

  const note = arrondi(pointsQim(discordances, bareme));
  return { note, discordances, nonJugees };
}

function noterSchema(q: Question, reponses: Record<string, string>, bareme: Bareme): NoteQuestion {
  const legendes = q.legendes ?? [];
  const n = legendes.length;
  if (n === 0) return { note: 0, discordances: 0, nonJugees: 0 };
  const unite = 1 / n;
  let brut = 0;
  let discordances = 0;
  let nonJugees = 0;
  for (const l of legendes) {
    const v = verdictLegende(reponses[l.id], l.attendu);
    if (v === "juste") brut += unite;
    else if (v === "fausse") {
      brut -= unite;
      discordances += 1;
    } else {
      if (bareme.schema.videRetire) brut -= unite;
      nonJugees += 1;
      discordances += 1;
    }
  }
  if (bareme.schema.mode === "tout_ou_rien") {
    return { note: discordances === 0 ? 1 : 0, discordances, nonJugees };
  }
  const note = arrondi(Math.min(1, Math.max(0, brut)));
  return { note, discordances, nonJugees };
}

/** Libellé lisible d'un format, tel qu'il s'annonce à l'apprenant. */
export function libelleFormat(q: Pick<Question, "type" | "enonce" | "modeReponse">): string {
  if (q.type === "QIM") return "QIM — barème à la discordance";
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
  return q.enonce.includes("plusieurs")
    ? "Tout ou rien : l'ensemble coché doit être exactement l'ensemble attendu."
    : "1 point si la réponse est exacte, 0 sinon.";
}
