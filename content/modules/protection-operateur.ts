import type { Module } from "../types";
import { A_PRECISER } from "../types";

/**
 * MODULE PILOTE 1 — rédigé intégralement à partir de référentiels publics.
 *
 * Aucun élément de procédure interne CHD Vendée n'y figure : les points qui
 * relèvent d'un arbitrage local sont marqués [à préciser] dans le corps du
 * texte et doivent être renseignés avant mise en service.
 */

const BPP_2023 = {
  libelle:
    "Décision du 21/07/2023 relative aux bonnes pratiques de préparation (entrée en vigueur le 20/09/2023)",
  source: "ANSM",
  date: "21/07/2023",
  url: "https://ansm.sante.fr/uploads/2023/08/02/20230802-bonnes-pratiques-de-preparation-08-2023.pdf",
  localisation:
    "Ligne directrice 2 — Préparation de médicaments contenant des substances pouvant présenter un risque pour la santé et l'environnement",
};

const INRS_ED6138 = {
  libelle:
    "Médicaments cytotoxiques et soignants. Manipuler avec précaution ! (ED 6138)",
  source: "INRS",
  date: "Édition en vigueur",
  url: "https://www.inrs.fr/dam/inrs/CataloguePapier/ED/TI-ED-6138.pdf",
};

const INRS_FAR47 = {
  libelle: "Préparation de cytotoxiques en milieu de soins (FAR 47)",
  source: "Assurance maladie – Risques professionnels / INRS",
  date: "Fiche d'aide au repérage",
  url: "https://www.inrs.fr/dam/inrs/CataloguePapier/FICHE/TI-FAR-47.pdf",
};

const INRS_TF255 = {
  libelle:
    "Exposition professionnelle des personnels de santé hospitaliers aux médicaments cytotoxiques. Biométrologie et mesure de la contamination des surfaces (TF 255)",
  source: "INRS — Références en santé au travail",
  date: "Article",
  url: "https://www.inrs.fr/media.html?refINRS=TF+255",
};

const ANSES_CYTO = {
  libelle:
    "Travaux exposant aux cytostatiques — connaître, évaluer, protéger (rapport d'expertise collective)",
  source: "ANSES",
  date: "Rapport",
  url: "https://www.anses.fr/fr/system/files/VSR2017SA0237Ra-1.pdf",
};

export const protectionOperateur: Module = {
  id: "protection-operateur-cytotoxiques",
  titre: "Protection de l'opérateur face au risque cytotoxique",
  objectif:
    "Identifier les situations d'exposition aux cytotoxiques dans l'unité, porter les protections adaptées et appliquer la conduite à tenir en cas de contamination accidentelle.",
  // Critère B1-04 de la fiche d'habilitation : « Fonctionnement des EPI et
  // gestion d'un incident (kits, masque / casque, douche, rince-œil, bris de
  // flacon) » — obligatoire, niveau N1a, socle transversal.
  bloc: 1,
  affectation: "tronc-commun",
  critereId: "B1-04",
  postes: [],
  niveaux: ["N1a"],
  parcours: ["integration", "maintien"],
  dureeMinutes: 35,
  redige: true,
  seuilReussite: 80,
  periodiciteMois: 24,

  sections: [
    {
      titre: "Pourquoi ce risque est un risque professionnel avéré",
      corps: `Les médicaments cytotoxiques sont utilisés précisément pour leur toxicité cellulaire. Plusieurs d'entre eux sont classés **génotoxiques, cancérogènes et toxiques pour la reproduction**. Ce qui soigne le patient à dose contrôlée constitue, pour l'opérateur, une exposition chronique non thérapeutique et sans bénéfice.

Le point le plus important à retenir de ce module tient en une phrase : **l'exposition professionnelle se fait principalement par voie cutanée**, et non par inhalation comme l'intuition le suggère. Une étude de l'INRS menée dans douze établissements hospitaliers a montré que les expositions touchaient **toutes les catégories professionnelles, du préparateur au coursier** — c'est-à-dire aussi des agents qui n'ouvrent jamais un flacon.

La conséquence pratique est directe : la protection ne se joue pas seulement au moment de la manipulation sous isolateur, mais tout au long du trajet du médicament dans l'établissement — réception, stockage, préparation, transport, administration, élimination.`,
      references: [INRS_TF255, ANSES_CYTO, BPP_2023],
    },
    {
      titre: "Les situations d'exposition dans l'unité",
      corps: `L'exposition ne se limite pas aux incidents visibles. Les sources documentées sont :

- **la contamination de surface des flacons neufs** dès leur réception, avant toute ouverture ;
- **le déballage et le rangement** des spécialités en zone de stockage ;
- **la manipulation elle-même** : perçage de bouchon, purge de tubulure, retrait d'aiguille ;
- **la contamination résiduelle des surfaces de travail**, qui se transfère par contact gant → surface → gant ;
- **la sortie des préparations** de l'isolateur et leur mise en poche de transport ;
- **les déchets et les excrétas** des patients traités ;
- **un déversement accidentel**, cas le plus visible mais statistiquement le moins fréquent.

Retenir que les quatre premières situations sont **silencieuses** : rien ne se voit, rien ne se sent, et c'est pour cela que la protection doit être systématique et non déclenchée par la perception d'un danger.`,
      references: [INRS_TF255, INRS_FAR47],
    },
    {
      titre: "Protection collective : la première ligne",
      corps: `La hiérarchie de prévention impose de traiter le risque à la source avant de protéger l'individu. Dans une unité de production, la protection collective repose sur :

- **le confinement** de la préparation dans un équipement dédié — isolateur ou poste de sécurité microbiologique — placé en zone d'accès restreint ;
- **le maintien en dépression** de l'enceinte vis-à-vis du local pour le risque chimique, avec filtration terminale de l'air rejeté ;
- **la séparation des flux** entrant et sortant, propre et sale ;
- **les systèmes clos de transfert** (connecteurs à double membrane, dispositifs de prise d'air filtrée) lorsqu'ils sont en place ;
- **un plan de nettoyage et de décontamination** dont la périodicité et les produits sont définis par procédure.

Configuration de l'unité (type d'enceinte, régime de pression, dispositifs de transfert retenus au CHD Vendée) : ${A_PRECISER}.

Ces barrières fonctionnent tant qu'elles ne sont pas contournées. La faute classique n'est pas leur absence, mais **le geste qui les annule** : sortir une main de l'enceinte, poser un objet contaminé hors de la zone dédiée, forcer un sas.`,
      references: [BPP_2023, INRS_FAR47],
    },
    {
      titre: "Protection individuelle : ce qui est porté, et pourquoi",
      corps: `L'INRS recommande, pour les tâches impliquant un risque de contact ou de projection :

- **des gants non poudrés** en nitrile, néoprène ou latex, **à manchettes longues recouvrant la surblouse** ;
- une **surblouse à usage unique**, dos fermé, poignets serrés, en matériau peu perméable ;
- une **protection oculaire et respiratoire** dans les situations à risque de projection ou d'aérosolisation, notamment hors enceinte de confinement.

Trois erreurs reviennent systématiquement en audit :

1. **Les gants portés trop longtemps.** La perméation est un phénomène progressif : un gant intact à l'œil peut être traversé. La fréquence de changement doit donc être définie *a priori* par procédure, pas décidée au fil de l'eau. Fréquence retenue dans l'unité : ${A_PRECISER} — la valeur la plus couramment retenue dans les référentiels de pharmacie oncologique est de 30 minutes, et dans tous les cas **immédiatement** en cas de contact ou de projection.
2. **Le gant enfilé sous la manchette** au lieu de la recouvrir, qui laisse une zone de peau exposée au point exact où le produit coule.
3. **Le retrait des EPI dans le mauvais ordre**, qui transfère la contamination des gants vers le visage ou les cheveux.

La règle de retrait est invariable : ce qui est le plus contaminé se retire en premier, et les mains sont lavées à la fin, jamais avant.`,
      references: [INRS_ED6138, INRS_FAR47, BPP_2023],
    },
    {
      titre: "Conduite à tenir en cas de contamination accidentelle",
      corps: `Le réflexe à acquérir est de **traiter la personne avant de traiter la surface**.

En cas de projection cutanée : retirer immédiatement les EPI et les vêtements souillés, **rincer abondamment à l'eau** la zone atteinte, sans frotter et sans solvant. En cas de projection oculaire : rinçage prolongé au sérum physiologique ou au dispositif de rinçage oculaire disponible, paupières maintenues ouvertes.

Ensuite seulement : baliser la zone, utiliser le **kit de déversement** prévu à cet effet, absorber du pourtour vers le centre pour ne pas étendre la flaque, éliminer l'ensemble en filière cytotoxique.

Dans tous les cas : **déclarer**. La déclaration est ce qui alimente l'analyse des causes et fait évoluer les barrières ; l'absence de déclaration rend le risque invisible et donc non traité. Un contact cutané ou une exposition suspectée justifient un contact avec le service de santé au travail.

Emplacement du kit de déversement, circuit de déclaration interne et référent à joindre : ${A_PRECISER}.`,
      references: [INRS_ED6138, INRS_FAR47],
    },
  ],

  ressources: [
    {
      id: "ed6138",
      titre:
        "INRS ED 6138 — Médicaments cytotoxiques et soignants. Manipuler avec précaution !",
      nature: "reglementaire",
      url: "https://www.inrs.fr/dam/inrs/CataloguePapier/ED/TI-ED-6138.pdf",
    },
    {
      id: "far47",
      titre: "INRS FAR 47 — Préparation de cytotoxiques en milieu de soins",
      nature: "reglementaire",
      url: "https://www.inrs.fr/dam/inrs/CataloguePapier/FICHE/TI-FAR-47.pdf",
    },
    {
      id: "bpp2023",
      titre: "ANSM — Bonnes pratiques de préparation, édition 2023",
      nature: "reglementaire",
      url: "https://ansm.sante.fr/uploads/2023/08/02/20230802-bonnes-pratiques-de-preparation-08-2023.pdf",
    },
    {
      id: "proc-epi-interne",
      titre: "Procédure interne — port et retrait des EPI en zone de production",
      nature: "procedure-interne",
      url: null,
      commentaire: `Document à rattacher : référence et version ${A_PRECISER}.`,
    },
    {
      id: "fiche-deversement",
      titre: "Fiche réflexe — déversement accidentel de cytotoxique",
      nature: "fiche-reflexe",
      url: null,
      commentaire: `Document à rattacher : référence et version ${A_PRECISER}.`,
    },
  ],

  questions: [
    {
      id: "po-q1",
      type: "QCM",
      enonce:
        "Quelle est la voie d'exposition professionnelle prépondérante aux médicaments cytotoxiques en milieu hospitalier ?",
      options: [
        { id: "a", texte: "L'inhalation d'aérosols" },
        { id: "b", texte: "La voie cutanée" },
        { id: "c", texte: "L'ingestion" },
        { id: "d", texte: "La voie transcutanée par piqûre uniquement" },
      ],
      bonnesReponses: ["b"],
      justification:
        "Les travaux de biométrologie et de mesure de contamination surfacique de l'INRS montrent que les expositions se font principalement par voie cutanée, par contact avec des surfaces contaminées. C'est ce qui justifie que la protection porte d'abord sur les mains et les avant-bras, et que la décontamination des surfaces soit une barrière majeure et non un simple geste d'entretien.",
      references: [INRS_TF255],
    },
    {
      id: "po-q2",
      type: "QCM",
      enonce:
        "Parmi ces situations, lesquelles constituent une exposition potentielle aux cytotoxiques ? (plusieurs réponses)",
      options: [
        { id: "a", texte: "Le déballage des flacons à la réception" },
        { id: "b", texte: "Le transport des préparations vers l'unité de soins" },
        { id: "c", texte: "La manipulation des excrétas d'un patient traité" },
        {
          id: "d",
          texte:
            "Le passage dans le couloir devant la salle de préparation, portes fermées",
        },
      ],
      bonnesReponses: ["a", "b", "c"],
      justification:
        "Les flacons neufs peuvent être contaminés en surface avant toute ouverture ; le transport et la manipulation des excrétas sont des situations d'exposition documentées, ce qui explique que l'étude INRS ait retrouvé des expositions chez des agents ne préparant jamais, jusqu'aux coursiers. En revanche, la circulation devant un local fermé et maintenu en dépression ne constitue pas une exposition : c'est précisément la fonction de la protection collective.",
      references: [INRS_TF255, INRS_FAR47],
    },
    {
      id: "po-q3",
      type: "QCM",
      enonce:
        "Concernant les gants de protection, quelle proposition est conforme aux recommandations de l'INRS ?",
      options: [
        {
          id: "a",
          texte:
            "Gants poudrés, manchettes glissées sous les manches de la surblouse",
        },
        {
          id: "b",
          texte:
            "Gants non poudrés en nitrile, néoprène ou latex, à manchettes longues recouvrant la surblouse",
        },
        {
          id: "c",
          texte:
            "Gants en vinyle, changés uniquement en fin de séance de préparation",
        },
        {
          id: "d",
          texte:
            "Gants stériles seuls, sans autre exigence de matériau ni de longueur",
        },
      ],
      bonnesReponses: ["b"],
      justification:
        "L'INRS recommande des gants non poudrés en nitrile, néoprène ou latex, à manchettes longues recouvrant la surblouse. La poudre est proscrite car elle véhicule la contamination et constitue un aérosol ; la manchette recouvrant la surblouse évite la zone de peau exposée au poignet, exactement là où un produit projeté s'écoule.",
      references: [INRS_ED6138],
    },
    {
      id: "po-q4",
      type: "QCM",
      enonce:
        "Un gant reste visuellement intact après une heure de manipulation continue. Quelle conduite est correcte ?",
      options: [
        {
          id: "a",
          texte:
            "Le conserver : l'absence de déchirure visible atteste de son intégrité",
        },
        {
          id: "b",
          texte:
            "Le changer selon la périodicité définie par la procédure, indépendamment de son aspect",
        },
        {
          id: "c",
          texte: "Le changer seulement si une projection a été constatée",
        },
        {
          id: "d",
          texte: "Le désinfecter en surface et poursuivre la séance",
        },
      ],
      bonnesReponses: ["b"],
      justification:
        "La perméation est un passage moléculaire progressif à travers un matériau intact : elle ne produit aucun signe visible. L'intégrité apparente d'un gant ne renseigne donc pas sur sa capacité de protection résiduelle. Le changement est piloté par une périodicité définie a priori, et immédiatement en cas de contact ou de projection.",
      eliminatoire: true,
      references: [INRS_ED6138, BPP_2023],
    },
    {
      id: "po-q5",
      type: "QCM",
      enonce:
        "Projection de cytotoxique sur l'avant-bras d'un opérateur. Quel est le premier geste ?",
      options: [
        { id: "a", texte: "Baliser la zone et sortir le kit de déversement" },
        { id: "b", texte: "Prévenir le pharmacien responsable" },
        {
          id: "c",
          texte:
            "Retirer les EPI et vêtements souillés et rincer abondamment la peau à l'eau",
        },
        {
          id: "d",
          texte: "Frotter la zone avec une solution hydro-alcoolique",
        },
      ],
      bonnesReponses: ["c"],
      justification:
        "On traite la personne avant la surface : retrait de ce qui est souillé puis rinçage abondant à l'eau, sans frotter et sans solvant. Frotter ou appliquer un produit alcoolique favorise la pénétration cutanée au lieu de l'éliminer. Le balisage, la déclaration et le traitement de la zone viennent ensuite — ils ne sont pas oubliés, ils sont seconds.",
      eliminatoire: true,
      references: [INRS_ED6138, INRS_FAR47],
    },
    {
      id: "po-q6",
      type: "QCM",
      enonce:
        "Un déversement mineur a été maîtrisé sans conséquence apparente, hors présence de tout témoin. Que faut-il faire ?",
      options: [
        {
          id: "a",
          texte:
            "Rien de plus : l'événement est clos puisqu'il est sans conséquence",
        },
        {
          id: "b",
          texte:
            "Le déclarer selon le circuit interne, y compris en l'absence de conséquence",
        },
        {
          id: "c",
          texte: "En parler oralement à l'équipe sans autre formalisation",
        },
        {
          id: "d",
          texte: "Le déclarer seulement s'il se reproduit",
        },
      ],
      bonnesReponses: ["b"],
      justification:
        "Un événement sans conséquence est un signal gratuit : il renseigne sur une défaillance de barrière au prix d'aucun dommage. Ne pas le déclarer revient à payer le prix de l'incident sans en tirer le bénéfice. C'est la logique même du signalement des événements indésirables, et c'est ce qui permet de faire évoluer les protections avant l'accident qui, lui, aura des conséquences.",
      references: [BPP_2023],
    },
    {
      id: "po-q7",
      type: "QIM",
      enonce:
        "Concernant l'exposition professionnelle aux cytotoxiques, indiquer la ou les propositions exactes.",
      options: [
        {
          id: "a",
          texte:
            "Certains cytotoxiques sont classés cancérogènes, mutagènes ou toxiques pour la reproduction",
        },
        {
          id: "b",
          texte:
            "Un flacon non ouvert peut porter une contamination sur sa surface externe",
        },
        {
          id: "c",
          texte:
            "Seuls les agents affectés à la préparation sont concernés par le risque",
        },
        {
          id: "d",
          texte:
            "La protection collective prime sur la protection individuelle dans la hiérarchie de prévention",
        },
        {
          id: "e",
          texte:
            "Un événement sans conséquence ne relève pas du signalement",
        },
      ],
      bonnesReponses: ["a", "b", "d"],
      justification:
        "A, B et D sont exactes. C est fausse : les mesures de contamination retrouvent des expositions dans toutes les catégories professionnelles, jusqu'aux agents de transport. E est fausse : un événement sans conséquence est précisément le signal le moins coûteux à exploiter, et sa déclaration est ce qui permet de corriger une barrière avant l'accident.",
      references: [INRS_TF255, ANSES_CYTO, BPP_2023],
    },
  ],

  misesEnSituation: [
    {
      id: "po-mes-1",
      titre: "Un flacon qui coule en fin de série",
      contexte: `Vendredi, 16 h 10. La série est presque terminée. En retirant l'aiguille d'un flacon de cytotoxique sous l'enceinte, vous sentez une résistance puis un léger relâchement. Quelques gouttes tombent sur le plan de travail et une fine projection atteint votre avant-bras, au niveau de la jonction entre le gant et la manche.

La douleur est nulle, la zone touchée fait moins d'un centimètre carré. Il reste deux préparations à produire, et le coursier passe à 16 h 30. Votre collègue vous propose d'essuyer rapidement et de terminer la série.`,
      questions: [
        {
          id: "po-mes-1-q1",
          type: "QCM",
          enonce: "Quelle est votre première action ?",
          options: [
            {
              id: "a",
              texte:
                "Terminer les deux préparations en cours, puis traiter la projection",
            },
            {
              id: "b",
              texte:
                "Interrompre l'activité, retirer les EPI souillés et rincer abondamment l'avant-bras à l'eau",
            },
            {
              id: "c",
              texte:
                "Essuyer l'avant-bras avec une compresse imbibée de solution hydro-alcoolique et poursuivre",
            },
            {
              id: "d",
              texte: "Appeler le pharmacien avant tout geste",
            },
          ],
          bonnesReponses: ["b"],
          justification:
            "La contrainte de temps ne modifie pas la conduite à tenir : on traite la personne d'abord. Poursuivre la série prolonge le contact cutané, et l'alcool favorise la pénétration au lieu de l'éliminer. Appeler le pharmacien est nécessaire, mais après le rinçage — l'appel ne fait pas partie des gestes d'urgence immédiats.",
          eliminatoire: true,
          references: [INRS_ED6138, INRS_FAR47],
        },
        {
          id: "po-mes-1-q2",
          type: "QIM",
          enonce:
            "Concernant la suite de la prise en charge de cette situation, indiquer la ou les propositions exactes.",
          options: [
            {
              id: "a",
              texte:
                "Le plan de travail doit être traité avec le kit de déversement, du pourtour vers le centre",
            },
            {
              id: "b",
              texte:
                "Les deux préparations restantes peuvent être produites dans la même enceinte sans autre précaution",
            },
            {
              id: "c",
              texte:
                "L'événement doit être déclaré même en l'absence de conséquence clinique",
            },
            {
              id: "d",
              texte:
                "Un contact avec le service de santé au travail est justifié",
            },
            {
              id: "e",
              texte:
                "Les déchets générés suivent la filière des déchets d'activités de soins ordinaires",
            },
          ],
          bonnesReponses: ["a", "c", "d"],
          justification:
            "A, C et D sont exactes. B est fausse : l'enceinte a été contaminée, la reprise ne peut avoir lieu qu'après décontamination selon la procédure — la pression du coursier ne crée pas de dérogation. E est fausse : tout matériel souillé par un cytotoxique suit la filière dédiée, distincte de celle des DASRI ordinaires.",
          references: [INRS_FAR47, BPP_2023],
        },
      ],
    },
  ],

  bibliographie: [BPP_2023, INRS_ED6138, INRS_FAR47, INRS_TF255, ANSES_CYTO],
};
