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
 */
export type TypeQuestion = "QCM" | "QIM";

/**
 * Barème des QIM, exprimé en fraction du point.
 *
 * Valeurs retenues par défaut dans l'application, à confirmer par le
 * pharmacien responsable : le barème réel est [à préciser].
 */
export const BAREME_QIM: Record<number, number> = {
  0: 1, // aucune discordance
  1: 0.5, // une discordance
};
/** Au-delà d'une discordance, la question ne rapporte rien. */
export const BAREME_QIM_AU_DELA = 0;

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
}

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
  /** Seuil de réussite en pourcentage de points. */
  seuilReussite: number;
  /** Périodicité de revalidation, en mois. */
  periodiciteMois: number | typeof A_PRECISER;
  bibliographie: Reference[];
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

/** Question telle qu'elle est envoyée au navigateur : sans les réponses. */
export type QuestionPublique = Omit<
  Question,
  "bonnesReponses" | "justification"
> & {
  /** Vignette de rattachement, `null` pour une question isolée. */
  situation: { id: string; titre: string; contexte: string } | null;
};

export function sanitizeQuestion(
  q: Question,
  situation: QuestionPublique["situation"] = null,
): QuestionPublique {
  const { bonnesReponses: _b, justification: _j, ...reste } = q;
  return { ...reste, situation };
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
 * Note d'une question, sur 1 point.
 *
 * QCM : tout ou rien. QIM : barème à discordance.
 *
 * `juges` porte, pour une QIM présentée en Vrai/Faux, les identifiants des
 * propositions auxquelles l'apprenant a effectivement répondu. Une proposition
 * laissée sans réponse compte alors comme une discordance — c'est la règle
 * annoncée à l'écran, et elle ne peut pas être déduite de `choix` seul :
 * « non cochée » et « non jugée » y seraient confondues.
 *
 * Quand `juges` est absent (QIM présentée en cases à cocher), on retombe sur
 * l'ancien comportement : non cochée vaut jugée fausse.
 */
export function noterQuestion(
  q: Question,
  choix: string[],
  juges?: string[],
): { note: number; discordances: number; nonJugees: number } {
  const attendues = new Set(q.bonnesReponses);
  const cochees = new Set(choix);
  const jugees = juges ? new Set(juges) : null;

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

  const note = BAREME_QIM[discordances] ?? BAREME_QIM_AU_DELA;
  return { note, discordances, nonJugees };
}
