import { A_COMPLETER, A_PRECISER } from "./types";
import type { NiveauHabilitation } from "./types";

/**
 * ────────────────────────────────────────────────────────────────────────────
 * PARAMÉTRAGE — structure d'habilitation de l'unité de pharmacotechnie.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Contenu repris de la fiche d'habilitation préparateur du CHD Vendée
 * (document de onze pages A4 paysage, sept blocs thématiques, colonnes
 * « O / Niv. / Compétence / Validé / Non validé / Preuves de validation /
 * Commentaires »). Les intitulés de blocs et de critères sont transcrits tels
 * quels, sans réécriture.
 *
 * ⚠ Ce document était une **refonte**, pas le document qualité. Les fiches
 * officielles fournies le 22/09/2026 l'ont contredit sur trois points, ici
 * corrigés : le parcours préparatoire se nomme **N1b** et non `P1` / `P2` ;
 * il n'existe **qu'un** niveau référent, N3 ; et le bloc « Encadrement »
 * portait six critères quand la fiche n'en donne qu'un (question 45, choix b).
 *
 * ⚠ Un élément reste en attente d'arbitrage, signalé par
 * `arbitrageEnAttente` et affiché comme tel : le marquage « O » des critères
 * obligatoires. La source existe désormais — les quatre fiches le portent —
 * mais les critères d'ici **agrègent** plusieurs lignes du portfolio, si
 * bien que le marquage ne se reporte pas ligne à ligne. Il le sera critère
 * par critère quand les portfolios seront versés.
 */

/** Marque les données reprises de la fiche mais non encore validées. */
export const arbitrageEnAttente = {
  marquageObligatoire:
    "Le marquage « O » des critères obligatoires vient de la rédaction de la fiche, pas des documents qualité : les quatre fiches officielles portent bien ce marquage, mais les critères d'ici agrègent plusieurs lignes de portfolio et il ne se reporte pas ligne à ligne. Il reste à arbitrer critère par critère.",
  correspondanceBlocsNiveaux:
    "La correspondance blocs ↔ niveaux est une adaptation destinée à préserver la logique N1/N2/N3 malgré la restructuration thématique. Elle ne figure pas telle quelle dans le portfolio.",
} as const;

// ───────────────────────────────────────────────────────────────── Niveaux

export interface Niveau {
  code: NiveauHabilitation;
  libelle: string;
  /**
   * Filière de rattachement. Ouvert depuis le 19/09/2026 (question 38,
   * choix b) : une filière déposée porte son propre identifiant.
   */
  filiere: string;
  /** Condition d'obtention, reprise du chapitre III de la fiche. */
  condition: string;
  prerequis: NiveauHabilitation[];
  /** `base` pour un niveau déposé, `code` (ou absent) pour la fiche versionnée. */
  origine?: "code" | "base";
}

export const niveaux: Niveau[] = [
  {
    code: "N1a",
    libelle: "N1a — socle général",
    filiere: "socle",
    condition:
      "Acquis si tous les critères obligatoires « O » des blocs transversaux (1 et 3) sont validés. Prérequis des deux branches, N1b et N1c.",
    prerequis: [],
  },
  {
    code: "N1b",
    libelle: "N1b — préparatoire",
    filiere: "preparatoire",
    condition:
      "N1a + critères obligatoires du bloc 6 validés. Avec N1a, vaut « niveau 1 » : la fiche écrit « 1a+1b ou 1a+1c ».",
    prerequis: ["N1a"],
  },
  {
    code: "N1c",
    libelle: "N1c — chimiothérapie",
    filiere: "chimiotherapie",
    condition:
      "N1a + critères obligatoires des blocs 2, 4 et 5 validés. Avec N1a, vaut « niveau 1 » : la fiche écrit « 1a+1b ou 1a+1c ».",
    prerequis: ["N1a"],
  },
  {
    code: "N2",
    libelle: "N2 — routine",
    filiere: "chimiotherapie",
    condition:
      "Les trois branches réunies : « Habilitation acquise si niveau 1a + 1b + 1c, si tous les critères obligatoires validés. »",
    prerequis: ["N1a", "N1b", "N1c"],
  },
  {
    code: "N3",
    libelle: "N3 — référent (tuteur des nouveaux préparateurs)",
    filiere: "encadrement",
    condition:
      "100 % des critères des niveaux 1a + 1b + 1c — obligatoires ET non obligatoires, la fiche le précise — puis participation à la formation d'au moins un préparateur en binôme avec un pharmacien ou un préparateur de niveau 3, et plus d'une année d'expérience dans l'unité.",
    prerequis: ["N2"],
  },
];

// ───────────────────────────────────────────────────────────────── Filières

/**
 * Axe de composition du programme.
 *
 * La fiche d'habilitation structure les compétences par **filière** et par
 * **niveau**, pas par poste de travail : l'unité n'a pas communiqué de
 * découpage en postes distincts. Cet axe reprend donc les filières réelles.
 * Si des postes de travail identifiés existent (isolateur A / B, préparatoire,
 * réception…), ils restent à fournir — voir `postesDeTravail` plus bas.
 */
export interface Filiere {
  id: string;
  libelle: string;
  description: string;
  blocs: number[];
  niveaux: NiveauHabilitation[];
  /** Pictogramme de la banque (`components/Badge.tsx`) ; vide = aucun. */
  badge?: string;
  /** `base` pour une filière déposée, `code` (ou absent) pour la fiche versionnée. */
  origine?: "code" | "base";
}

export const filieres: Filiere[] = [
  {
    id: "socle",
    libelle: "Socle transversal",
    description:
      "Exigé de tout agent de l'unité, prérequis aux deux parcours.",
    blocs: [1, 3],
    niveaux: ["N1a"],
  },
  {
    id: "chimiotherapie",
    libelle: "Parcours Chimiothérapie",
    description:
      "Préparation des chimiothérapies, de la technique aseptique à la libération. N1c en doublon, puis N2 en autonomie.",
    blocs: [2, 3, 4, 5],
    niveaux: ["N1c", "N2"],
  },
  {
    id: "preparatoire",
    libelle: "Parcours Préparatoire",
    description:
      "Préparations magistrales et hospitalières, et gestion des matières premières. Niveau N1b de la fiche.",
    blocs: [6],
    niveaux: ["N1b"],
  },
  {
    id: "encadrement",
    libelle: "Encadrement et référent",
    description:
      "Encadrement, tutorat, documentation qualité et groupes de travail.",
    blocs: [7],
    niveaux: ["N3"],
  },
];

// ───────────────────────────────────────────────────────────────── Métiers

/**
 * Métier : un par fiche d'habilitation de l'unité.
 *
 * Tranché le 22/09/2026 (question 44, choix c) : un **vivier unique** de
 * critères, chacun portant les métiers auxquels il s'applique et, par métier,
 * son niveau, son caractère obligatoire et le libellé de sa fiche d'origine.
 * Un même texte de formation sert les quatre métiers, au lieu d'être écrit
 * quatre fois et révisé quatre fois.
 *
 * ⚠ Les **échelles de niveaux ne sont pas communes**, et les codes se
 * répètent d'une fiche à l'autre avec un autre sens : la fiche pharmacien
 * nomme `N1a` une sous-catégorie (validation pharmaceutique seule) qui n'a
 * rien du socle `N1a` du préparateur. Tant que les trois autres échelles ne
 * sont pas versées, leur liste reste vide : le conflit de codes n'est pas
 * tranché, et il ne doit pas l'être en silence.
 */
export interface Metier {
  id: string;
  libelle: string;
  /** Référence de la fiche d'habilitation qui fait foi pour ce métier. */
  fiche: string;
  /** Codes de niveaux de **ce** métier, du plus bas au plus haut. */
  niveaux: NiveauHabilitation[];
}

/** Métier dont la fiche a été transcrite : tout critère du vivier le porte. */
export const METIER_PAR_DEFAUT = "preparateur";

export const metiers: Metier[] = [
  {
    id: METIER_PAR_DEFAUT,
    libelle: "Préparateur en pharmacie",
    fiche: A_COMPLETER,
    niveaux: ["N1a", "N1b", "N1c", "N2", "N3"],
  },
  { id: "pharmacien", libelle: "Pharmacien / interne", fiche: A_COMPLETER, niveaux: [] },
  { id: "aide", libelle: "Aide en pharmacie", fiche: A_COMPLETER, niveaux: [] },
  { id: "agent-entretien", libelle: "Agent d'entretien", fiche: A_COMPLETER, niveaux: [] },
];

export function getMetier(id: string): Metier | undefined {
  return metiers.find((m) => m.id === id);
}

/**
 * Postes de travail de l'unité.
 *
 * Absents de la fiche d'habilitation, qui raisonne en filières et niveaux.
 * À renseigner si l'unité veut composer les programmes par poste.
 */
export const postesDeTravail: { id: string; libelle: string }[] = [
  { id: "poste-a-preciser", libelle: `Postes de travail — ${A_PRECISER}` },
];

// ────────────────────────────────────────────── Maintien de l'habilitation

/** Chapitre I de la fiche — critère de maintien. */
export const maintien = {
  /** Réévaluation de l'habilitation tous les 2 ans. */
  periodiciteMois: 24,
  activiteMinimale: "Prise de poste a minima 6 jours par trimestre.",
  reserve:
    "Sauf si un complément de formation est nécessaire, auquel cas la réévaluation est avancée.",
} as const;

// ──────────────────────────────────────────────────── Blocs de compétences

export interface BlocCompetence {
  numero: number;
  titre: string;
  /** Ancrage réglementaire du bloc, tel qu'il figure sous son titre. */
  reference: string;
  filiere: string;
}

export const blocsCompetence: BlocCompetence[] = [
  {
    numero: 1,
    titre: "Règles d'hygiène et de sécurité",
    reference:
      "BPP 2023 — Chap. 2 « Personnel », « Locaux et matériel » | ISO 9001:2015 §7.3, §7.1.4",
    filiere: "socle",
  },
  {
    numero: 2,
    titre:
      "Connaissance du circuit des chimiothérapies, AP/AC et essais cliniques",
    reference:
      "BPP 2023 — « Préparations » ; LD recherche impliquant la personne humaine | ISO 9001:2015 §8.1, §8.5.2",
    filiere: "chimiotherapie",
  },
  {
    numero: 3,
    titre: "Connaissances des infrastructures et des logiciels",
    reference:
      "BPP 2023 — « Locaux et matériel », « Documentation », Chap. 1 « Gestion de la qualité » | ISO 9001:2015 §7.1.3, §7.1.5, §7.5, §10.2",
    filiere: "socle",
  },
  {
    numero: 4,
    titre: "Acquérir les gestes techniques aseptiques",
    reference:
      "BPP 2023 — LD « Préparations stériles » (technique aseptique, produits à risque) | ISO 9001:2015 §7.2",
    filiere: "chimiotherapie",
  },
  {
    numero: 5,
    titre: "Réaliser des chimiothérapies (en doublon puis en autonomie)",
    reference:
      "BPP 2023 — LD « Préparations stériles » ; contrôle et libération | ISO 9001:2015 §8.5.2, §8.6, §8.7",
    filiere: "chimiotherapie",
  },
  {
    numero: 6,
    titre:
      "Réaliser des préparations magistrales et hospitalières (parcours préparatoire)",
    reference:
      "BPP 2023 — « Préparations magistrales et hospitalières », « Matières premières » | ISO 9001:2015 §8.1, §8.6",
    filiere: "preparatoire",
  },
  {
    numero: 7,
    titre: "Encadrement et référent (niveau N3)",
    reference:
      "BPP 2023 — Chap. 2 « Personnel » (formation, tutorat) | ISO 9001:2015 §7.1.6, §7.2, §10.3",
    filiere: "encadrement",
  },
];

// ─────────────────────────────────────────────────────────────── Critères

/** Ce qu'une fiche de métier dit d'un critère du vivier. */
export interface RattachementMetier {
  /** Colonne « Niv. » de la fiche de ce métier. */
  niveau: NiveauHabilitation | "N1c→2";
  /** Colonne « O » de la fiche de ce métier. */
  obligatoire: boolean;
  /**
   * Libellé de la fiche de **ce** métier, quand il diffère du libellé commun.
   * Absent : le libellé commun fait foi. Une même compétence ne s'écrit pas
   * pareil d'une fiche à l'autre, et c'est le libellé du métier concerné qui
   * est rendu à l'écran et sur le rapport — sans quoi la pièce produite ne
   * correspondrait plus au document opposable qu'elle sert.
   */
  libelle?: string;
}

export interface Critere {
  id: string;
  bloc: number;
  /** Sous-section du bloc, telle qu'elle figure dans la fiche. */
  sousSection: string | null;
  /** Colonne « O » de la fiche du métier par défaut. Voir `obligatoirePour`. */
  obligatoire: boolean;
  /** Colonne « Niv. » de la fiche du métier par défaut. Voir `niveauPour`. */
  niveau: NiveauHabilitation | "N1c→2";
  /** Colonne « Compétence / savoir-faire évalué », transcrite telle quelle. */
  libelle: string;
  /**
   * Ce que chaque fiche dit de ce critère. Un métier absent de cette carte
   * ne l'évalue pas. Le métier par défaut y figure toujours : c'est celui
   * dont la fiche a été transcrite.
   */
  metiers: Record<string, RattachementMetier>;
  /** Module du site couvrant ce critère, s'il existe. */
  moduleId?: string;
}

function c(
  bloc: number,
  rang: number,
  obligatoire: boolean,
  niveau: Critere["niveau"],
  libelle: string,
  sousSection: string | null = null,
  moduleId?: string,
  autresMetiers: Record<string, RattachementMetier> = {},
): Critere {
  return {
    id: `B${bloc}-${String(rang).padStart(2, "0")}`,
    bloc,
    sousSection,
    obligatoire,
    niveau,
    libelle,
    metiers: { [METIER_PAR_DEFAUT]: { niveau, obligatoire }, ...autresMetiers },
    moduleId,
  };
}

export const criteres: Critere[] = [
  // ── BLOC 1 — Règles d'hygiène et de sécurité
  c(1, 1, true, "N1a", "Reconnaître zones sales / propres et adapter sa tenue à la zone (pyjama, charlotte, masque, gants)", null, "comportement-zac"),
  c(1, 2, true, "N1a", "Lavage des mains et règles d'hygiène en zone"),
  c(1, 3, true, "N1a", "Règles d'ouverture / fermeture de l'unité et conduite à tenir en cas de problème"),
  c(1, 4, true, "N1a", "Fonctionnement des EPI et gestion d'un incident (kits, masque / casque, douche, rince-œil, bris de flacon)", null, "protection-operateur-cytotoxiques"),
  c(1, 5, true, "N1a", "Sécurité incendie (issues de secours, extincteurs, coupure des fluides, évacuation)"),
  c(1, 6, true, "N1a", "Principe d'une ZAC ; surveillance des températures et des pressions (KIMO, chambre froide, réfrigérateurs, CTA)"),
  c(1, 7, true, "N1a", "Déconditionnement / nettoyage / rangement"),
  c(1, 8, false, "N1a", "Traçabilité, gestion de stock, gestion des périmés et alertes de stock"),

  // ── BLOC 2 — Circuit des chimiothérapies, AP/AC et essais cliniques
  c(2, 1, true, "N1c", "Circuit des chimiothérapies, de la prescription à l'administration"),
  c(2, 2, false, "N1c", "Protocoles par spécialité, ordre de passage, stabilité et compatibilité des molécules"),
  c(2, 3, true, "N1c", "Spécificités de manipulation (IT, CEL…) et dispositifs (raccord, perfuseur, diffuseur, arbre de perfusion)"),
  c(2, 4, false, "N1c", "Circuit des médicaments en accès précoces / accès compassionnels (AP/AC)"),
  c(2, 5, false, "N1c", "Essais cliniques : notions (promoteur, bras, randomisation, IWRS), stockage et mise en œuvre"),

  // ── BLOC 3 — Infrastructures et logiciels
  c(3, 1, true, "N1c", "Équipements et règles de sécurité de l'isolateur", "Isolateur"),
  c(3, 2, true, "N1c", "Fonctionnement (chargement, stérilisation, écrans, flux) et contrôles à l'ouverture / fermeture", "Isolateur"),
  c(3, 3, true, "N1c", "Entretien (nettoyage / désinfection), stérilisation générale et cahier de bord", "Isolateur"),
  c(3, 4, true, "N1c", "Situations d'urgence (perforation, arrêt d'urgence, pousse microbiologique, changement de bidons)", "Isolateur"),
  c(3, 5, true, "N1c", "CHIMIO® : activité, priorisation, sortie de fiche de fabrication, éditions, stock / reliquats, recherche, gestion de panne", "Logiciels"),
  c(3, 6, true, "N1c", "Drugcam® : réalisation des préparations assistée par le logiciel", "Logiciels"),
  c(3, 7, false, "N1a", "C-log® (encodage) ; Copilote® (entrées / sorties de stock, commandes, fiche produit)", "Logiciels"),
  c(3, 8, false, "N1a", "Messagerie, calendriers et plannings (Outlook®, Easily®, plannings papier intra et hors les murs)", "Logiciels"),
  c(3, 9, true, "N1a", "Ennov® : système documentaire qualité et déclaration de non-conformité", "Système d'assurance qualité et archives"),
  c(3, 10, false, "N1a", "Fichiers Excel (inventaire, potences, journal de bord, contrôles microbiologiques) ; règles d'archivage", "Système d'assurance qualité et archives"),

  // ── BLOC 4 — Gestes techniques aseptiques
  c(4, 1, true, "N1c", "Gestion des risques liés à la manipulation (aiguille, cytotoxique, stérilité, purge, marche en avant, traçabilité)"),
  c(4, 2, true, "N1c", "Prérequis et faisabilité ; lecture de la fiche de fabrication ; choix des dispositifs médicaux adaptés"),
  c(4, 3, true, "N1c", "Installation du champ stérile et gantage ; préparation du matériel et organisation de l'espace"),
  c(4, 4, true, "N1c", "Percuter / purger une tubulure ; aiguilles et prise d'air ; reconstitution d'un flacon"),
  c(4, 5, true, "N1c", "Prélèvement avec et sans prise d'air (y compris situation complexe) et mesure de volume à la seringue"),
  c(4, 6, true, "N1c", "Étiquetage (poche / seringue, double poche, IT / GEU, RFID) et suremballage"),
  c(4, 7, true, "N1c", "Gestion de fin de préparation (reliquats, déchets) et sortie de poche de l'isolateur"),
  c(4, 8, false, "N1c", "Préparations particulières : poches (duoperf, vide, filtre), diffuseurs, seringues (SC, GEU, IT, Texium, chimioembolisation)"),
  c(4, 9, true, "N1c", "TRA — test de remplissage aseptique : qualification de la technique aseptique"),

  // ── BLOC 5 — Réaliser des chimiothérapies
  c(5, 1, true, "N1c", "Sélection de la prescription (Chimio®), priorisation et compréhension de la fiche de fabrication", "Préparer et stériliser les plateaux"),
  c(5, 2, true, "N1c", "Préparation du plateau (validation des n° de lot, matériel), recyclages et doses standards", "Préparer et stériliser les plateaux"),
  c(5, 3, true, "N1c", "Stérilisation des plateaux (processus, SAS, démarrage et validation)", "Préparer et stériliser les plateaux"),
  c(5, 4, true, "N1c→2", "Champ et gants stériles ; préparation assistée Drugcam® selon les bonnes pratiques de fabrication", "Réaliser des chimiothérapies (doublon → autonomie)"),
  c(5, 5, true, "N1c→2", "Double contrôle à chaque prélèvement et étiquetage patient / produit après vérification", "Réaliser des chimiothérapies (doublon → autonomie)"),
  c(5, 6, true, "N1c→2", "Conditionnement, sortie de la préparation et élimination des déchets", "Réaliser des chimiothérapies (doublon → autonomie)"),
  c(5, 7, true, "N1c→2", "Réalisation des tests microbiologiques", "Réaliser des chimiothérapies (doublon → autonomie)"),
  c(5, 8, true, "N1c→2", "Contrôle de la préparation prête à l'emploi, libération et check-list de sortie de salle", "Réaliser des chimiothérapies (doublon → autonomie)"),
  c(5, 9, false, "N1a", "Envoi d'une chimiothérapie en intra-CHD et Hors Les Murs", "Flux logistiques"),

  // ── BLOC 6 — Préparations magistrales et hospitalières
  c(6, 1, true, "N1b", "Habillage et règles d'hygiène au préparatoire", "Connaissances générales"),
  c(6, 2, true, "N1b", "Circuit des préparations ; supports utilisés et règles de rédaction", "Connaissances générales"),
  c(6, 3, false, "N1b", "Logiciels du préparatoire, archivage, entretien et rangement du matériel, échantillothèque", "Connaissances générales"),
  c(6, 4, true, "N1b", "Cohérence fiche de fabrication / prescription ; matériel, matières premières et contrôle des balances", "Réalisation d'une préparation magistrale et / ou hospitalière"),
  c(6, 5, true, "N1b", "Renseignement et contrôle de la fiche ; inscription à l'ordonnancier et au registre d'envoi", "Réalisation d'une préparation magistrale et / ou hospitalière"),
  c(6, 6, true, "N1b", "Réalisation selon les bonnes pratiques et étiquetage (mentions obligatoires)", "Réalisation d'une préparation magistrale et / ou hospitalière"),
  c(6, 7, false, "N1b", "Échantillonnage le cas échéant", "Réalisation d'une préparation magistrale et / ou hospitalière"),
  c(6, 8, true, "N1b", "Libération après validation pharmaceutique ; traçabilité et gestion des stocks", "Réalisation d'une préparation magistrale et / ou hospitalière"),
  c(6, 9, false, "N1b", "Circuit des préparations hospitalières ; entretien et rangement du matériel", "Réalisation d'une préparation magistrale et / ou hospitalière"),
  c(6, 10, true, "N1b", "Contrôle à réception des matières premières", "Gestion des matières premières"),
  c(6, 11, false, "N1b", "Rangement et commande des matières premières", "Gestion des matières premières"),

  // ── BLOC 7 — Encadrement et référent
  //
  // Ramené à un seul critère le 22/09/2026 (question 45, choix b). Les cinq
  // autres — évaluer et tracer les compétences d'un apprenant, rédiger et
  // réviser des procédures, animer des groupes de travail, CAPA, veille —
  // ne figurent dans **aucune** des quatre fiches officielles, et celui des
  // non-conformités faisait doublon avec B3-09. Le reste de ce que la fiche
  // exige du niveau référent — 100 % des critères des niveaux inférieurs,
  // ancienneté — est une condition d'éligibilité, portée par
  // `niveaux[].condition` : une ancienneté ne s'évalue pas par QCM.
  c(7, 1, true, "N3", "Participation à la formation d'au moins un préparateur, en binôme avec un pharmacien ou un préparateur de niveau 3"),
];

// ─────────────────────────────────────────── Chaîne d'habilitation

export type LieuEtape = "site" | "terrain" | "pharmacien";

export interface EtapeHabilitation {
  numero: number;
  titre: string;
  description: string;
  lieu: LieuEtape;
  preuve: string;
}

/**
 * Chaîne d'habilitation.
 *
 * Elle situe ce que le site couvre (étapes 1 et 2) et ce qu'il ne couvre pas,
 * pour qu'aucune étape ne soit tenue pour acquise du seul fait qu'un module a
 * été validé à l'écran. Les preuves des étapes 3 à 6 sont celles de la fiche.
 */
export const etapes: EtapeHabilitation[] = [
  {
    numero: 1,
    titre: "Formation théorique",
    description:
      "Lecture du module couvrant le critère et des procédures internes rattachées.",
    lieu: "site",
    preuve: "Parcours du module dans l'application",
  },
  {
    numero: 2,
    titre: "Évaluation des connaissances",
    description:
      "QCM, QIM et mises en situation. Seuil de réussite et questions éliminatoires définis par critère.",
    lieu: "site",
    preuve: "Rapport d'évaluation exporté par l'apprenant",
  },
  {
    numero: 3,
    titre: "Compagnonnage au poste",
    description:
      "Formation en doublon par un préparateur habilité N3, selon le portfolio de formation. Pour le bloc 5, la fiche distingue explicitement la phase en doublon de la phase en autonomie.",
    lieu: "terrain",
    preuve: "Portfolio de formation renseigné par le tuteur",
  },
  {
    numero: 4,
    titre: "Évaluation pratique au poste",
    description:
      "Notation par le tuteur sur les critères du bloc. La colonne « Preuves de validation » attend la nature de la preuve, sa date et le visa de l'évaluateur.",
    lieu: "terrain",
    preuve: "Fiche d'habilitation — colonne « Preuves de validation (nature, date, visa) »",
  },
  {
    numero: 5,
    titre: "Validation par le pharmacien responsable",
    description:
      "Examen des preuves et prononcé du niveau retenu, ou décision de formation complémentaire (chapitre IV de la fiche).",
    lieu: "pharmacien",
    preuve: "Fiche d'habilitation — « Habilitation finale », datée et signée",
  },
  {
    numero: 6,
    titre: "Maintien et revalidation",
    description: `${maintien.activiteMinimale} Réévaluation de l'habilitation tous les ${maintien.periodiciteMois / 12} ans. ${maintien.reserve}`,
    lieu: "pharmacien",
    preuve: "Chapitre IV — formations complémentaires et réhabilitations",
  },
];

// ──────────────────────────────────────────────────────────── Utilitaires

export function criteresDuBloc(numero: number): Critere[] {
  return criteres.filter((x) => x.bloc === numero);
}

export function blocsDeLaFiliere(filiereId: string): BlocCompetence[] {
  const f = filieres.find((x) => x.id === filiereId);
  if (!f) return [];
  return blocsCompetence.filter((b) => f.blocs.includes(b.numero));
}

/** Critères d'une filière, éventuellement restreints à un niveau. */
export function criteresDeLaFiliere(
  filiereId: string,
  niveau?: string,
): Critere[] {
  const numeros = blocsDeLaFiliere(filiereId).map((b) => b.numero);
  return criteres.filter((x) => {
    if (!numeros.includes(x.bloc)) return false;
    if (!niveau) return true;
    // « N1c→2 » relève à la fois de N1c (en doublon) et de N2 (en autonomie).
    return x.niveau === niveau || (x.niveau === "N1c→2" && (niveau === "N1c" || niveau === "N2"));
  });
}

export function getCritere(id: string): Critere | undefined {
  return criteres.find((x) => x.id === id);
}

// ──────────────────────────────────────── Lecture du vivier, métier par métier

/** Critères que la fiche de ce métier évalue, dans l'ordre du vivier. */
export function criteresDuMetier(metierId: string): Critere[] {
  return criteres.filter((x) => x.metiers[metierId] !== undefined);
}

/** Métiers dont la fiche évalue ce critère, dans l'ordre de `metiers`. */
export function metiersDuCritere(critere: Critere): Metier[] {
  return metiers.filter((m) => critere.metiers[m.id] !== undefined);
}

/**
 * Le libellé à rendre pour un métier : celui de sa fiche s'il en a un, le
 * libellé commun sinon. Un métier qui n'évalue pas le critère reçoit quand
 * même le libellé commun — le texte reste lisible hors de tout rattachement.
 */
export function libellePour(critere: Critere, metierId: string): string {
  return critere.metiers[metierId]?.libelle ?? critere.libelle;
}

/** Obligatoire pour ce métier ? Faux si sa fiche n'évalue pas ce critère. */
export function obligatoirePour(critere: Critere, metierId: string): boolean {
  return critere.metiers[metierId]?.obligatoire ?? false;
}

/** Niveau de ce critère dans la fiche de ce métier, `null` s'il n'y figure pas. */
export function niveauPour(
  critere: Critere,
  metierId: string,
): Critere["niveau"] | null {
  return critere.metiers[metierId]?.niveau ?? null;
}

/**
 * Codes de niveaux que la fiche versionnée connaît.
 *
 * Sert à repérer les rattachements devenus orphelins après une correction de
 * l'échelle — `P1` et `P2` ont disparu le 22/09/2026. Rien n'est supprimé sur
 * ce constat : un rattachement orphelin se signale, il ne s'efface pas.
 */
export function codesDeNiveauDeLaFiche(): Set<string> {
  return new Set(niveaux.map((n) => String(n.code)));
}
