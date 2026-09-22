/**
 * Présentation guidée au premier passage (demande du 19/09/2026).
 *
 * Trois profils ouvrent trois sites différents : le poste de travail ne voit
 * ni la banque de questions ni les visas, le tutorat ne voit ni le journal ni
 * le barème. Une visite unique et commune n'aurait donc rien à dire à
 * personne ; chaque profil a la sienne, courte, et qui ne montre que des
 * écrans auxquels il a accès.
 *
 * Module pur — aucune dépendance au serveur, à la base ni à Next : le contenu
 * se vérifie par des tests (`test/tutoriel.test.ts`), notamment que toutes les
 * adresses citées existent dans le site.
 *
 * Les étapes marquées `conservation` ne paraissent qu'en mode
 * `CONSERVATION_RAPPORTS=pseudonyme` : sans lui, les identifiants d'agents,
 * les rapports enregistrés et le circuit de visas n'existent pas, et la
 * visite montrerait des écrans absents du volet.
 */

/**
 * Les trois profils. Volontairement redéclaré ici plutôt qu'importé de
 * `lib/db.ts`, qui est `server-only` : ce module doit rester lisible par un
 * test et par un composant client. La concordance avec `Role` est tenue à la
 * compilation — `app/layout.tsx` indexe `TUTORIEL` avec `session.role`, ce
 * qui échoue si les deux ensembles divergent.
 */
export type ProfilTutoriel = "poste" | "tuteur" | "admin";

export interface EtapeTutoriel {
  titre: string;
  texte: string;
  /** Écran concerné. Absent sur l'étape d'accueil, qui n'en désigne aucun. */
  href?: string;
  /** Libellé du lien, quand `href` est renseigné. */
  lien?: string;
  /** L'étape n'a de sens que si les rapports sont conservés. */
  conservation?: boolean;
}

/**
 * Version du contenu. L'incrémenter fait reparaître la visite à tous : c'est
 * un acte délibéré, réservé à une refonte des écrans, pas à une correction de
 * formulation.
 */
export const VERSION_TUTORIEL = 1;

/** Clé de mémorisation sur le poste. Ne désigne personne : un profil, pas un agent. */
export function cleTutoriel(profil: ProfilTutoriel): string {
  return `fp-tutoriel-${profil}-v${VERSION_TUTORIEL}`;
}

const POSTE: EtapeTutoriel[] = [
  {
    titre: "Vous êtes entré avec un code de poste",
    texte:
      "Ce code ouvre un profil, pas un compte. La visite qui suit montre les quatre écrans que vous utiliserez.",
  },
  {
    titre: "Vos modules",
    texte:
      "Le sommaire liste les modules de votre filière et de votre niveau. Chacun se lit à votre rythme : le site retient la section où vous vous êtes arrêté, sur ce poste, et vous y ramène.",
    href: "/#modules",
    lien: "Voir mes modules",
  },
  {
    titre: "Composer le programme",
    texte:
      "Filière, niveau et parcours ajustent la liste. Découverte sert à lire et à s'entraîner ; Habilitation ajoute les questions réservées à l'évaluation.",
    href: "/#composer",
    lien: "Composer le programme",
  },
  {
    titre: "L'évaluation et son rapport",
    texte:
      "Le barème, le seuil et la bande de garde sont annoncés avant de commencer, jamais après. Une évaluation terminée produit un rapport détaillé, question par question.",
    href: "/reperes#evaluation",
    lien: "Lire le barème",
  },
  {
    titre: "Votre progression",
    texte:
      "Rattachez votre progression à l'identifiant d'agent remis par votre tuteur, avec un code personnel que vous choisissez. Elle est alors conservée sous cet identifiant, et vous la retrouvez d'un poste à l'autre.",
    href: "/#progression",
    lien: "Ma progression",
    conservation: true,
  },
];

const TUTEUR: EtapeTutoriel[] = [
  {
    titre: "Vous êtes entré avec un code de tutorat",
    texte:
      "Vous gardez tout ce que voit un poste de travail, et vous ouvrez en plus la banque de questions, les dépôts et le suivi de l'équipe. Voici les écrans à connaître.",
  },
  {
    titre: "La banque de questions",
    texte:
      "Écrire, déposer en lot, relire et valider. Une question ne se valide jamais par le code qui l'a écrite : il en faut un second, c'est la règle des quatre yeux.",
    href: "/admin/questions",
    lien: "Ouvrir la banque",
  },
  {
    titre: "Modules et documents",
    texte:
      "Déposer un module, lui rattacher ses documents, choisir son illustration et l'ordre dans lequel il paraît. La publication demande elle aussi un second code.",
    href: "/admin/modules",
    lien: "Ouvrir les modules",
  },
  {
    titre: "Les signalements",
    texte:
      "Un apprenant qui conteste une question la signale pendant l'évaluation. Le signalement verrouille la question et attend votre décision : la corriger, la retirer du tirage, ou écarter la remarque.",
    href: "/admin/signalements",
    lien: "Voir les signalements",
  },
  {
    titre: "Le personnel et les visas",
    texte:
      "Créez ici les identifiants d'agents (AG-001…) à remettre aux apprenants. C'est aussi d'ici que vous posez le visa du tutorat sur un rapport émis.",
    href: "/admin/personnel",
    lien: "Ouvrir le personnel",
    conservation: true,
  },
  {
    titre: "Le pilotage",
    texte:
      "Vue d'ensemble des résultats : verdicts, courbe mensuelle, réussite par critère, questions les plus manquées, rapports en attente. Filtrable par filière, niveau, bloc, module et période.",
    href: "/admin/pilotage",
    lien: "Ouvrir le pilotage",
  },
];

const ADMIN: EtapeTutoriel[] = [
  {
    titre: "Vous êtes entré avec un code d'administration",
    texte:
      "Ce code vaut pharmacien responsable : il ouvre tout ce que voit le tutorat, plus les réglages du dispositif et ce qui engage sa valeur de preuve. Voici ceux qui vous appartiennent en propre.",
  },
  {
    titre: "Le pilotage",
    texte:
      "Vue d'ensemble des résultats : verdicts, courbe mensuelle, réussite par critère, questions les plus manquées, rapports en attente. C'est l'écran à ouvrir en premier.",
    href: "/admin/pilotage",
    lien: "Ouvrir le pilotage",
  },
  {
    titre: "Les accès",
    texte:
      "Créer, révoquer et supprimer les codes de tous les rôles. Un code se remplace, il ne se retrouve pas : la base les conserve hachés. Révoquer un code ferme aussitôt les sessions qu'il avait ouvertes.",
    href: "/admin",
    lien: "Gérer les accès",
  },
  {
    titre: "Le référentiel et le barème",
    texte:
      "Les critères d'habilitation, leur rattachement aux filières et aux niveaux, puis les réglages de la décision : seuil, bande de garde, points par type de question.",
    href: "/admin/bareme",
    lien: "Ouvrir le barème",
  },
  {
    titre: "Les rapports",
    texte:
      "Visa du pharmacien responsable, arbitrage d'un verdict indéterminé, annulation et purge. Un rapport ne se modifie pas : il s'annule, et un nouveau est émis.",
    href: "/admin/rapports",
    lien: "Ouvrir les rapports",
    conservation: true,
  },
  {
    titre: "La signature et le journal",
    texte:
      "Déposez l'image de signature incrustée à la clôture des rapports. Le journal garde toute action d'administration, par rôle et libellé de profil.",
    href: "/admin/journal",
    lien: "Ouvrir le journal",
  },
];

export const TUTORIEL: Record<ProfilTutoriel, EtapeTutoriel[]> = {
  poste: POSTE,
  tuteur: TUTEUR,
  admin: ADMIN,
};

/** Les étapes d'un profil, amputées de celles que le mode de conservation ne permet pas. */
export function etapesTutoriel(profil: ProfilTutoriel, conservation: boolean): EtapeTutoriel[] {
  return TUTORIEL[profil].filter((e) => !e.conservation || conservation);
}
