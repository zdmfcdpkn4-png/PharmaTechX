import type { Module } from "../types";
import { A_PRECISER } from "../types";

/**
 * MODULE PILOTE 2 — rédigé intégralement à partir de référentiels publics.
 *
 * Les valeurs propres à l'installation du CHD Vendée (classes retenues par
 * local, sens des sas, tenue) sont marquées [à préciser].
 */

const BPP_2023_LD1 = {
  libelle:
    "Décision du 21/07/2023 relative aux bonnes pratiques de préparation (entrée en vigueur le 20/09/2023)",
  source: "ANSM",
  date: "21/07/2023",
  url: "https://ansm.sante.fr/uploads/2023/08/02/20230802-bonnes-pratiques-de-preparation-08-2023.pdf",
  localisation: "Ligne directrice 1 — Préparation de médicaments stériles",
};

const BPF_ANNEXE1 = {
  libelle:
    "Bonnes pratiques de fabrication — Annexe 1 relative à la fabrication des médicaments stériles (ajoutée par décision du 28/05/2024)",
  source: "ANSM",
  date: "28/05/2024",
  url: "https://ansm.sante.fr/documents/reference/bonnes-pratiques-de-fabrication-de-medicaments-a-usage-humain",
};

const ISO_14644_1 = {
  libelle:
    "NF EN ISO 14644-1 — Salles propres et environnements maîtrisés apparentés. Partie 1 : classification de la propreté particulaire de l'air",
  source: "ISO / AFNOR",
  date: "2015",
  url: "https://www.iso.org/standard/53394.html",
};

export const comportementZac: Module = {
  id: "comportement-zac",
  badge: "zone-sterile",
  titre: "Comportement et habillage en zone à atmosphère contrôlée",
  objectif:
    "Expliquer ce que la classification particulaire garantit et ce qu'elle ne garantit pas, réaliser l'habillage dans l'ordre et adopter les comportements qui préservent la maîtrise de l'environnement.",
  // Critère B1-01 de la fiche d'habilitation : « Reconnaître zones sales /
  // propres et adapter sa tenue à la zone (pyjama, charlotte, masque, gants) »
  // — obligatoire, niveau N1a, socle transversal. Recoupe aussi B1-06
  // (principe d'une ZAC) et B1-02 (lavage des mains).
  bloc: 1,
  affectation: "tronc-commun",
  critereId: "B1-01",
  postes: [],
  niveaux: ["N1a"],
  parcours: ["integration", "maintien"],
  dureeMinutes: 40,
  redige: true,
  seuilReussite: 80,
  periodiciteMois: 24,

  sections: [
    {
      titre: "Ce que classe une classe",
      corps: `Une zone à atmosphère contrôlée est définie par une **concentration maximale de particules en suspension dans l'air**. La norme NF EN ISO 14644-1 fixe ces limites. Pour les particules de taille supérieure ou égale à 0,5 µm :

- **ISO 5** : 3 520 particules par m³
- **ISO 7** : 352 000 particules par m³
- **ISO 8** : 3 520 000 particules par m³

Soit, d'une classe à la suivante, un facteur cent entre ISO 5 et ISO 7.

Deux points sont systématiquement mal compris :

**Premier point : une classe est une performance d'air, pas une performance de stérilité.** Une particule n'est pas un micro-organisme. La classification particulaire est un indicateur de maîtrise de l'environnement ; la surveillance microbiologique est un contrôle distinct, avec ses propres méthodes et ses propres seuils. Les deux sont exigés, l'un ne remplace pas l'autre.

**Second point : une classe se mesure dans un état donné.** Les référentiels distinguent l'état **au repos** — installation complète, équipements en fonctionnement, sans personnel — et l'état **en activité**, personnel présent et travail en cours. Un local peut être ISO 7 au repos et ISO 8 en activité : ce n'est pas une dérive, c'est la définition. Ce qui fait la différence entre les deux états, c'est très largement **l'opérateur lui-même**.`,
      references: [ISO_14644_1, BPP_2023_LD1],
    },
    {
      titre: "Grades A, B, C, D et correspondance",
      corps: `Les référentiels pharmaceutiques raisonnent en grades, qui se traduisent en classes ISO selon l'état considéré :

- **Grade A** — zone des opérations à haut risque : ISO 5 au repos **et** en activité. C'est le poste de travail lui-même (isolateur, hotte à flux d'air unidirectionnel).
- **Grade B** — environnement immédiat d'une zone A en procédé aseptique ouvert : ISO 5 au repos, ISO 7 en activité.
- **Grade C** — ISO 7 au repos, ISO 8 en activité.
- **Grade D** — ISO 8 au repos ; l'état en activité n'est pas défini par une valeur.

Le grade exigé pour l'environnement d'une zone A dépend du degré de confinement du procédé : un isolateur fermé et correctement qualifié admet un environnement de classe inférieure à celui exigé autour d'un poste ouvert, puisque c'est le confinement qui fait la barrière.

Classes retenues local par local au CHD Vendée, et régime de pression associé : ${A_PRECISER}.`,
      references: [BPF_ANNEXE1, BPP_2023_LD1],
    },
    {
      titre: "L'opérateur est la source principale de contamination",
      corps: `C'est le fait central du module. En zone à atmosphère contrôlée, l'air filtré, les surfaces et les équipements ne sont pas les contributeurs dominants : **la personne présente l'est**. Elle émet en permanence des particules — squames cutanées, fibres textiles, gouttelettes — et ces particules portent des micro-organismes.

Trois conséquences, qui expliquent l'ensemble des règles qui suivent :

1. **La tenue n'habille pas l'opérateur, elle confine ses émissions.** Une surblouse propre mal fermée, une charlotte laissant passer des cheveux, un masque sous le nez : ce ne sont pas des manquements esthétiques, ce sont des fuites.
2. **Le nombre de personnes présentes est un paramètre du procédé.** Chaque personne supplémentaire ajoute une source. La limitation des effectifs en zone n'est pas une règle d'organisation, c'est une règle de qualité.
3. **La vitesse des mouvements compte.** Les gestes rapides remettent en suspension les particules déposées et perturbent les flux d'air unidirectionnels, notamment en zone A où le flux protège le point critique. Se déplacer lentement n'est pas une précaution de confort.`,
      references: [BPP_2023_LD1, BPF_ANNEXE1],
    },
    {
      titre: "L'habillage : un ordre, et la raison de cet ordre",
      corps: `Le principe général de l'habillage est **du plus haut vers le plus bas, du plus propre vers le plus exposé**, avec franchissement de sas et changement d'état à chaque étape.

L'enchaînement type comporte : dépose des effets personnels et bijoux en vestiaire, hygiène des mains, tenue de base dédiée, puis en sas d'habillage la **surchaussure ou le changement de chaussures avec franchissement du banc de séparation**, la **coiffe** englobant la totalité de la chevelure, le **masque** couvrant nez et bouche, la **combinaison ou surblouse**, enfin les **gants** enfilés en dernier par-dessus les poignets.

La logique du banc de séparation mérite d'être comprise plutôt que retenue : il matérialise une frontière que les pieds ne franchissent jamais dans le même état. Enjamber sans s'asseoir, ou reposer un pied déjà changé du côté « sale », annule la séparation — l'opération est alors à reprendre depuis le début, ce qui est précisément ce qu'on cherche à éviter.

Les gants s'enfilent en dernier parce qu'ils sont ce qui touchera le produit : tout geste d'habillage réalisé après eux les contamine.

Tenue exacte, composition des sas et sens de circulation dans l'unité : ${A_PRECISER}.`,
      references: [BPP_2023_LD1, BPF_ANNEXE1],
    },
    {
      titre: "En zone : ce qui se fait et ce qui ne se fait pas",
      corps: `- **Les portes de sas ne s'ouvrent jamais simultanément.** La cascade de pression n'existe que si un seul battant s'ouvre à la fois ; deux portes ouvertes ensemble, c'est un couloir direct entre deux classes.
- **Rien n'entre sans passer par le circuit prévu** : sas matériel, bac de transfert, désinfection des emballages selon la procédure. Un objet entré « juste une fois » par la porte de personnel est une entrée non maîtrisée.
- **Pas de papier non dédié, pas de crayon à gomme, pas d'objet pelucheux.** Les supports d'écriture utilisables en zone sont définis par procédure.
- **Ne pas parler au-dessus d'un point critique** et limiter les échanges verbaux : la parole projette des gouttelettes.
- **Ne pas passer la main ni un objet au-dessus d'un point critique** en flux unidirectionnel : ce qui est en amont du flux contamine ce qui est en aval.
- **Toute anomalie environnementale se signale immédiatement** — alarme de pression, aspect anormal d'un filtre, déchirure de tenue, porte restée ouverte. Un environnement dont on doute ne se rattrape pas après coup : il se traite avant de poursuivre.

Un dernier point, souvent implicite : **l'habillage se refait entièrement après toute sortie de zone**, même brève. « Je sors deux minutes » n'existe pas comme catégorie.`,
      references: [BPP_2023_LD1, BPF_ANNEXE1],
    },
  ],

  ressources: [
    {
      id: "bpp2023-ld1",
      titre: "ANSM — Bonnes pratiques de préparation 2023, ligne directrice 1",
      nature: "reglementaire",
      url: "https://ansm.sante.fr/uploads/2023/08/02/20230802-bonnes-pratiques-de-preparation-08-2023.pdf",
    },
    {
      id: "bpf-annexe1",
      titre: "ANSM — BPF, Annexe 1 : fabrication des médicaments stériles",
      nature: "reglementaire",
      url: "https://ansm.sante.fr/documents/reference/bonnes-pratiques-de-fabrication-de-medicaments-a-usage-humain",
    },
    {
      id: "iso14644",
      titre: "NF EN ISO 14644-1:2015 — classification particulaire de l'air",
      nature: "reglementaire",
      url: "https://www.iso.org/standard/53394.html",
      commentaire: "Norme payante — consultation via l'abonnement de l'établissement.",
    },
    {
      id: "proc-habillage",
      titre: "Procédure interne — habillage et circulation en ZAC",
      nature: "procedure-interne",
      url: null,
      commentaire: `Document à rattacher : référence et version ${A_PRECISER}.`,
    },
    {
      id: "video-habillage",
      titre: "Séquence vidéo — habillage pas à pas",
      nature: "video",
      url: null,
      commentaire: `À produire en interne — décision de tournage ${A_PRECISER}.`,
    },
  ],

  questions: [
    {
      id: "zac-q1",
      type: "QCM",
      enonce:
        "Selon la norme ISO 14644-1, quelle est la concentration maximale de particules ≥ 0,5 µm par m³ admise en classe ISO 5 ?",
      options: [
        { id: "a", texte: "352 particules/m³" },
        { id: "b", texte: "3 520 particules/m³" },
        { id: "c", texte: "35 200 particules/m³" },
        { id: "d", texte: "352 000 particules/m³" },
      ],
      bonnesReponses: ["b"],
      justification:
        "La limite ISO 5 est de 3 520 particules ≥ 0,5 µm par m³. La valeur de 352 000 correspond à la classe ISO 7 : entre les deux, un facteur cent. Ces valeurs découlent de la formule Cn = 10^N × (0,1/D)^2,08 arrondie à trois chiffres significatifs.",
      references: [ISO_14644_1],
    },
    {
      id: "zac-q2",
      type: "QCM",
      enonce:
        "Un local est classé ISO 7 au repos et mesuré ISO 8 pendant une séance de préparation. Comment interpréter ce résultat ?",
      options: [
        {
          id: "a",
          texte: "C'est une non-conformité : la classe doit être tenue en permanence",
        },
        {
          id: "b",
          texte:
            "C'est attendu : les classes sont définies par état, au repos et en activité",
        },
        {
          id: "c",
          texte: "C'est le signe d'une défaillance des filtres terminaux",
        },
        {
          id: "d",
          texte: "C'est sans signification : la mesure en activité n'est pas définie",
        },
      ],
      bonnesReponses: ["b"],
      justification:
        "Les référentiels définissent un état au repos et un état en activité, avec des exigences distinctes. Un grade C correspond précisément à ISO 7 au repos et ISO 8 en activité. L'écart entre les deux états ne traduit pas une dérive : il traduit la présence de l'opérateur, qui est la source principale de particules.",
      references: [BPF_ANNEXE1, ISO_14644_1],
    },
    {
      id: "zac-q3",
      type: "QCM",
      enonce:
        "Quelle affirmation sur la classification particulaire est exacte ?",
      options: [
        {
          id: "a",
          texte: "Une classe ISO 5 garantit l'absence de micro-organismes dans l'air",
        },
        {
          id: "b",
          texte:
            "La classification particulaire et la surveillance microbiologique sont deux contrôles distincts, tous deux exigés",
        },
        {
          id: "c",
          texte:
            "La surveillance microbiologique remplace le comptage particulaire lorsqu'elle est conforme",
        },
        {
          id: "d",
          texte: "Le comptage particulaire est un contrôle de stérilité du produit fini",
        },
      ],
      bonnesReponses: ["b"],
      justification:
        "Une particule n'est pas un micro-organisme : le comptage particulaire mesure la maîtrise de l'environnement, pas sa charge biologique. Les deux surveillances ont des méthodes, des seuils et des finalités différentes, et aucune ne se substitue à l'autre. Aucune des deux n'est par ailleurs un contrôle du produit fini.",
      references: [BPP_2023_LD1, BPF_ANNEXE1],
    },
    {
      id: "zac-q4",
      type: "QCM",
      enonce:
        "À quel moment de l'habillage les gants sont-ils enfilés ?",
      options: [
        { id: "a", texte: "En premier, pour ne rien toucher à mains nues" },
        { id: "b", texte: "Avant la surblouse, pour en protéger l'extérieur" },
        { id: "c", texte: "En dernier, par-dessus les poignets" },
        { id: "d", texte: "Indifféremment, l'ordre relevant de l'habitude de chacun" },
      ],
      bonnesReponses: ["c"],
      justification:
        "Les gants sont ce qui approchera le produit : tout geste d'habillage effectué après les avoir enfilés les contamine. Ils viennent donc en dernier, recouvrant les poignets de la tenue — ce qui supprime aussi la zone de peau exposée à la jonction manche-gant.",
      eliminatoire: true,
      references: [BPP_2023_LD1],
    },
    {
      id: "zac-q5",
      type: "QCM",
      enonce:
        "Quels comportements compromettent la maîtrise de l'environnement en ZAC ? (plusieurs réponses)",
      options: [
        { id: "a", texte: "Ouvrir les deux portes d'un sas en même temps" },
        {
          id: "b",
          texte: "Passer la main au-dessus d'un point critique en flux unidirectionnel",
        },
        { id: "c", texte: "Effectuer des gestes rapides et amples" },
        {
          id: "d",
          texte: "Limiter le nombre de personnes présentes simultanément en zone",
        },
      ],
      bonnesReponses: ["a", "b", "c"],
      justification:
        "Deux portes ouvertes ensemble annulent la cascade de pression ; une main placée en amont d'un point critique contamine ce qui est en aval du flux ; les gestes rapides remettent en suspension les particules déposées et perturbent le flux unidirectionnel. Limiter les effectifs va au contraire dans le sens de la maîtrise, puisque chaque personne est une source d'émission.",
      references: [BPP_2023_LD1, BPF_ANNEXE1],
    },
    {
      id: "zac-q6",
      type: "QCM",
      enonce:
        "Un opérateur habillé doit sortir de zone une minute pour récupérer un document oublié. Que fait-il au retour ?",
      options: [
        {
          id: "a",
          texte: "Il réintègre directement la zone, la sortie ayant été brève",
        },
        {
          id: "b",
          texte: "Il change uniquement de gants",
        },
        {
          id: "c",
          texte: "Il refait l'habillage complet selon la procédure",
        },
        {
          id: "d",
          texte:
            "Il réintègre après désinfection des mains, l'habillage restant valable",
        },
      ],
      bonnesReponses: ["c"],
      justification:
        "La durée de la sortie ne change rien à son effet : la tenue a quitté l'environnement maîtrisé et n'est plus dans l'état qu'elle garantissait. L'habillage se refait intégralement. C'est aussi la raison pour laquelle la préparation de la séance — documents, matériel, consommables — se fait avant l'habillage et non pendant.",
      references: [BPP_2023_LD1],
    },
    {
      id: "zac-q7",
      type: "QIM",
      enonce:
        "Concernant les zones à atmosphère contrôlée, indiquer la ou les propositions exactes.",
      options: [
        {
          id: "a",
          texte:
            "La classe ISO 5 correspond à 3 520 particules ≥ 0,5 µm par m³",
        },
        {
          id: "b",
          texte:
            "Une zone de grade A doit être ISO 5 au repos comme en activité",
        },
        {
          id: "c",
          texte:
            "Le comptage particulaire renseigne directement sur la charge microbiologique de l'air",
        },
        {
          id: "d",
          texte:
            "L'opérateur est le principal contributeur de particules en zone",
        },
        {
          id: "e",
          texte:
            "Une sortie de zone de moins de cinq minutes dispense de refaire l'habillage",
        },
      ],
      bonnesReponses: ["a", "b", "d"],
      justification:
        "A, B et D sont exactes. C est fausse : une particule n'est pas un micro-organisme, et la surveillance microbiologique est un contrôle distinct avec ses propres méthodes. E est fausse : la durée de la sortie ne change rien à son effet sur la tenue, qui a quitté l'environnement maîtrisé — l'habillage se refait intégralement.",
      references: [ISO_14644_1, BPF_ANNEXE1, BPP_2023_LD1],
    },
  ],

  misesEnSituation: [
    {
      id: "zac-mes-1",
      titre: "Le sas, la porte et le carton",
      contexte: `Vous êtes habillé et en zone depuis le début de la séance. Un collègue, en tenue de ville, se présente de l'autre côté du sas matériel avec un carton de consommables commandé en urgence pour la fin de série : il manque des poches de perfusion.

Il vous fait signe à travers le hublot, ouvre la première porte du sas et pose le carton à l'intérieur, tout en maintenant la porte ouverte du pied pour vous parler. Le carton n'a pas été décartonné en zone de déballage. L'alarme de pression différentielle se déclenche.`,
      questions: [
        {
          id: "zac-mes-1-q1",
          type: "QCM",
          enonce:
            "Quel élément de cette situation constitue l'écart le plus grave ?",
          options: [
            {
              id: "a",
              texte:
                "Le collègue est en tenue de ville de l'autre côté du sas",
            },
            {
              id: "b",
              texte:
                "La porte du sas est maintenue ouverte, ce qui rompt la cascade de pression",
            },
            {
              id: "c",
              texte: "Le carton est entré sans avoir été décartonné",
            },
            {
              id: "d",
              texte: "Les consommables ont été commandés en urgence",
            },
          ],
          bonnesReponses: ["b"],
          justification:
            "Le carton non décartonné est un écart réel, mais reste circonscrit au sas tant que la seconde porte n'est pas ouverte. La porte maintenue ouverte rompt en revanche immédiatement la cascade de pression et met la zone en communication directe avec l'extérieur — c'est ce que confirme le déclenchement de l'alarme. La tenue de ville du collègue est normale de son côté du sas ; l'urgence de la commande n'est pas un écart mais un facteur contributif.",
          eliminatoire: true,
          references: [BPP_2023_LD1, BPF_ANNEXE1],
        },
        {
          id: "zac-mes-1-q2",
          type: "QIM",
          enonce:
            "Concernant la conduite à tenir, indiquer la ou les propositions exactes.",
          options: [
            {
              id: "a",
              texte:
                "Demander la fermeture immédiate de la porte avant tout autre échange",
            },
            {
              id: "b",
              texte:
                "Récupérer le carton dans le sas pour terminer la série, l'urgence patient primant",
            },
            {
              id: "c",
              texte:
                "Faire ressortir le carton et le faire passer par le circuit de décartonnage prévu",
            },
            {
              id: "d",
              texte:
                "Signaler l'événement, alarme de pression à l'appui, au titre des écarts environnementaux",
            },
            {
              id: "e",
              texte:
                "Vérifier le retour de la cascade de pression avant de reprendre la production",
            },
          ],
          bonnesReponses: ["a", "c", "d", "e"],
          justification:
            "A, C, D et E sont exactes et s'enchaînent dans cet ordre. B est fausse : l'urgence de la série ne crée aucune dérogation au circuit d'entrée du matériel. C'est précisément dans ces moments que les barrières sont contournées, et c'est pour cela que la règle doit être appliquée sans arbitrage au cas par cas. La reprise n'est légitime qu'après retour documenté des conditions environnementales.",
          references: [BPP_2023_LD1, BPF_ANNEXE1],
        },
      ],
    },
  ],

  bibliographie: [BPP_2023_LD1, BPF_ANNEXE1, ISO_14644_1],
};
