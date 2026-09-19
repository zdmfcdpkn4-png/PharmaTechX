import { A_PRECISER } from "./types";
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
 * ⚠ Deux éléments de cette fiche étaient explicitement en attente d'arbitrage
 * pharmacien au moment de sa rédaction, et le restent ici :
 *   1. le marquage « O » (critère obligatoire) — proposition, pas donnée source ;
 *   2. la correspondance blocs ↔ niveaux — adaptation, pas donnée du portfolio.
 * Ils sont signalés par `arbitrageEnAttente` et affichés comme tels.
 */

/** Marque les données reprises de la fiche mais non encore validées. */
export const arbitrageEnAttente = {
  marquageObligatoire:
    "Le marquage « O » des critères obligatoires est une proposition issue de la rédaction de la fiche, fondée sur l'enjeu sécurité/qualité. Il n'a pas de base réglementaire item par item et reste à arbitrer.",
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
      "Acquis si tous les critères obligatoires « O » des blocs transversaux (1 et 3) sont validés. Prérequis aux deux parcours.",
    prerequis: [],
  },
  {
    code: "N1c",
    libelle: "N1c — chimiothérapie (base)",
    filiere: "chimiotherapie",
    condition:
      "N1a + critères obligatoires des blocs 2, 4 et 5 (en doublon) validés.",
    prerequis: ["N1a"],
  },
  {
    code: "N2",
    libelle: "N2 — chimiothérapie (routine)",
    filiere: "chimiotherapie",
    condition: "N1c + production du bloc 5 validée en autonomie.",
    prerequis: ["N1c"],
  },
  {
    code: "P1",
    libelle: "P1 — préparatoire (base)",
    filiere: "preparatoire",
    condition:
      "N1a + critères obligatoires « P1 » du bloc 6 validés.",
    prerequis: ["N1a"],
  },
  {
    code: "P2",
    libelle: "P2 — préparatoire (référent)",
    filiere: "preparatoire",
    condition:
      "P1 + critères « P2 » du bloc 6 validés (autonomie complète au préparatoire).",
    prerequis: ["P1"],
  },
  {
    code: "N3",
    libelle: "N3 — référent / encadrement",
    filiere: "encadrement",
    condition:
      "100 % des critères obligatoires des niveaux détenus, expérience de plus d'un an dans l'unité, encadrement d'au moins un préparateur (bloc 7) et participation aux groupes de travail (chapitre V).",
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
      "Préparations magistrales et hospitalières, et gestion des matières premières. P1 puis P2.",
    blocs: [6],
    niveaux: ["P1", "P2"],
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

export interface Critere {
  id: string;
  bloc: number;
  /** Sous-section du bloc, telle qu'elle figure dans la fiche. */
  sousSection: string | null;
  /** Colonne « O » — critère obligatoire pour l'habilitation. */
  obligatoire: boolean;
  /** Colonne « Niv. » de la fiche. */
  niveau: NiveauHabilitation | "N1c→2";
  /** Colonne « Compétence / savoir-faire évalué », transcrite telle quelle. */
  libelle: string;
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
): Critere {
  return {
    id: `B${bloc}-${String(rang).padStart(2, "0")}`,
    bloc,
    sousSection,
    obligatoire,
    niveau,
    libelle,
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
  c(6, 1, true, "P1", "Habillage et règles d'hygiène au préparatoire", "Connaissances générales"),
  c(6, 2, true, "P1", "Circuit des préparations ; supports utilisés et règles de rédaction", "Connaissances générales"),
  c(6, 3, false, "P1", "Logiciels du préparatoire, archivage, entretien et rangement du matériel, échantillothèque", "Connaissances générales"),
  c(6, 4, true, "P1", "Cohérence fiche de fabrication / prescription ; matériel, matières premières et contrôle des balances", "Réalisation d'une préparation magistrale et / ou hospitalière"),
  c(6, 5, true, "P1", "Renseignement et contrôle de la fiche ; inscription à l'ordonnancier et au registre d'envoi", "Réalisation d'une préparation magistrale et / ou hospitalière"),
  c(6, 6, true, "P1", "Réalisation selon les bonnes pratiques et étiquetage (mentions obligatoires)", "Réalisation d'une préparation magistrale et / ou hospitalière"),
  c(6, 7, false, "P2", "Échantillonnage le cas échéant", "Réalisation d'une préparation magistrale et / ou hospitalière"),
  c(6, 8, true, "P2", "Libération après validation pharmaceutique ; traçabilité et gestion des stocks", "Réalisation d'une préparation magistrale et / ou hospitalière"),
  c(6, 9, false, "P2", "Circuit des préparations hospitalières ; entretien et rangement du matériel", "Réalisation d'une préparation magistrale et / ou hospitalière"),
  c(6, 10, true, "P1", "Contrôle à réception des matières premières", "Gestion des matières premières"),
  c(6, 11, false, "P2", "Rangement et commande des matières premières", "Gestion des matières premières"),

  // ── BLOC 7 — Encadrement et référent
  c(7, 1, true, "N3", "Encadrer et former un préparateur en doublon, selon le portfolio de formation"),
  c(7, 2, true, "N3", "Évaluer et tracer les compétences d'un apprenant (renseigner la présente fiche d'habilitation)"),
  c(7, 3, true, "N3", "Participer à la rédaction et à la révision des procédures et modes opératoires (Ennov®)"),
  c(7, 4, true, "N3", "Animer ou participer aux groupes de travail et projets d'amélioration du service"),
  c(7, 5, true, "N3", "Contribuer à la gestion des non-conformités et aux actions correctives / préventives (CAPA)"),
  c(7, 6, false, "N3", "Assurer la veille et la transmission des savoirs critiques de l'unité"),
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
