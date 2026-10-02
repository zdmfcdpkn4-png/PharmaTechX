/**
 * Page d'accueil après la connexion (question 91, choix a, 02/10/2026) :
 * « le chemin ». Bandeau, menu et accès rapide ne changent pas ; cette page
 * dessine l'organisation du site avec les médaillons, et peu de texte.
 *
 * - L'agent suit les six étapes de son habilitation, dans l'ordre où elles se
 *   vivent : les deux qui se font sur ce site sont actives, les quatre autres
 *   grisées, avec le lieu où elles se passent. « Valider un module ne vaut pas
 *   habilitation » s'y voit sans phrase.
 * - Le tutorat et l'administration suivent le circuit d'une question et d'un
 *   rapport — déposer, vérifier, publier, former, viser, suivre —, avec ce
 *   qui attend à chaque arrêt. Ce qui n'est pas une étape (codes d'accès,
 *   squelette, réglages, repères) est rangé à côté.
 *
 * Module pur : les comptes viennent de `lib/attente.ts`, les mêmes que
 * l'accès rapide (« À faire ») ; les deux ne peuvent pas se contredire, et un
 * test le vérifie (`test/accueil.test.ts`).
 */
import type { ComptesAttente, ProfilAcces } from "./acces-rapide";
import { etapes, maintien, type LieuEtape } from "./habilitation";
import type { Module } from "./types";

// ───────────────────────────────────────────────────────────── l'agent

export interface EtapeChemin {
  numero: number;
  /** Titre court, à l'écran. */
  titre: string;
  /** Titre de la fiche d'habilitation, pour le lecteur d'écran. */
  titreFiche: string;
  medaillon: string;
  lieu: LieuEtape;
  /** Où se passe une étape hors du site. */
  ou?: string;
}

const COURTS: Record<number, { titre: string; medaillon: string; ou?: string }> = {
  1: { titre: "Me former", medaillon: "formation-diplome" },
  2: { titre: "M'évaluer", medaillon: "resultats-conformes" },
  3: { titre: "Compagnonnage", medaillon: "habillage-sterile", ou: "Au poste" },
  4: { titre: "Évaluation pratique", medaillon: "hotte-laminaire", ou: "Au poste" },
  5: { titre: "Validation", medaillon: "attestation-habilitation", ou: "Pharmacien" },
  6: { titre: "Maintien", medaillon: "registre-releves", ou: `Tous les ${maintien.periodiciteMois / 12} ans` },
};

/** Les six étapes de la fiche (`content/habilitation.ts`), avec leur titre court et leur médaillon. */
export const CHEMIN: EtapeChemin[] = etapes.map((e) => ({
  numero: e.numero,
  titre: COURTS[e.numero]?.titre ?? e.titre,
  titreFiche: e.titre,
  medaillon: COURTS[e.numero]?.medaillon ?? "formation-diplome",
  lieu: e.lieu,
  ou: COURTS[e.numero]?.ou,
}));

/**
 * L'étape où en est l'agent : 2 pendant une évaluation laissée en plan, 1 tant
 * qu'un module ouvrable reste à acquérir, 3 quand tout est acquis à l'écran —
 * la suite se passe au poste, et l'accueil le dit (« prochaine étape »).
 */
export function etapeCourante(o: { evaluationEnCours: boolean; resteAAcquerir: boolean }): 1 | 2 | 3 {
  if (o.evaluationEnCours) return 2;
  return o.resteAAcquerir ? 1 : 3;
}

// ───────────────────────────────────────────── le tutorat et l'administration

export interface LienArret {
  href: string;
  libelle: string;
}

export interface ArretCircuit {
  cle: "deposer" | "verifier" | "publier" | "former" | "viser" | "suivre";
  titre: string;
  medaillon: string;
  /**
   * Une ligne : ce qui attend à cet arrêt, nommé avec les mots de « À faire » —
   * la pastille dit combien, la ligne dit quoi —, ou ce qui s'y trouve. Jamais
   * le titre ni les liens de l'arrêt redits.
   */
  detail: string;
  /** Ce qui attend un acte, compté comme dans « À faire ». */
  enAttente: number;
  /** Lien principal ; absent quand l'arrêt se passe hors du site. */
  lien?: LienArret;
  /** Écrans voisins du même arrêt. */
  autres: LienArret[];
}

export interface InfosCircuit {
  /**
   * La banque, chaque question une fois (`totauxQuestions`) : validées, et à
   * vérifier — le reste du compte « à vérifier » sont des fiches de synthèse.
   * `null` quand la base n'a pas pu la compter.
   */
  banque: { validees: number; aVerifier: number } | null;
  /** Modules déposés au statut brouillon. */
  brouillons: number;
  /** État des modules (`etatModules`) ; `null` quand la base n'a pas pu le dire. */
  modules: EtatModules | null;
}

export interface EtatModules {
  /** Modules hors retirés sans aucune question, validée ou à vérifier : il reste à en déposer. */
  sansQuestion: number;
  /** Modules du programme qu'une évaluation peut tirer : une question validée au moins. */
  evaluables: number;
  /** Modules du programme : ceux du code et les déposés publiés, sur un parcours au moins. */
  auProgramme: number;
}

/**
 * Ce que les modules portent de questions, comptées comme le programme les
 * compte (`resumer`, `app/page.tsx`) : celles du code, mises en situation
 * comprises, et celles de la banque — un module y est « évaluable » dès une
 * question validée. Un module du code n'a pas de statut : il est au
 * programme ; un module déposé n'y entre que publié.
 */
export function etatModules(
  modules: Pick<Module, "id" | "statut" | "parcours" | "questions" | "misesEnSituation">[],
  comptes: Record<string, { valides: number; aVerifier: number }>,
): EtatModules {
  const etat: EtatModules = { sansQuestion: 0, evaluables: 0, auProgramme: 0 };
  for (const m of modules) {
    if (m.statut === "retire" || m.parcours.length === 0) continue;
    const ecrites = m.questions.length + m.misesEnSituation.reduce((n, s) => n + s.questions.length, 0);
    const banque = comptes[m.id] ?? { valides: 0, aVerifier: 0 };
    if (ecrites + banque.valides + banque.aVerifier === 0) etat.sansQuestion++;
    if (m.statut !== undefined && m.statut !== "publie") continue;
    etat.auProgramme++;
    if (ecrites + banque.valides > 0) etat.evaluables++;
  }
  return etat;
}

/** « 1 rapport à viser », « 3 rapports à viser » : zéro se dit autrement, par l'appelant. */
function compte(n: number, singulier: string, pluriel: string): string {
  return `${n} ${n > 1 ? pluriel : singulier}`;
}

/**
 * Vérifier : la pastille compte questions et fiches ensemble (question 59), la
 * ligne les sépare, puis dit combien de questions ont passé la vérification.
 * « validées » se rapporte aux questions nommées juste avant ; sinon, il les
 * nomme.
 */
function ligneVerifier(contenus: number, banque: InfosCircuit["banque"]): string {
  if (banque === null) return contenus > 0 ? `${contenus} à vérifier` : "Rien à vérifier";
  const fiches = Math.max(0, contenus - banque.aVerifier);
  const aVerifier = [
    banque.aVerifier > 0 && compte(banque.aVerifier, "question", "questions"),
    fiches > 0 && compte(fiches, "fiche", "fiches"),
  ].filter(Boolean);
  if (aVerifier.length === 0 && banque.validees === 0) return "Aucune question en banque";
  const nommees = banque.aVerifier > 0;
  const validees =
    banque.validees === 0
      ? nommees ? "aucune validée" : "aucune question validée"
      : nommees ? compte(banque.validees, "validée", "validées") : compte(banque.validees, "question validée", "questions validées");
  return `${aVerifier.length > 0 ? `${aVerifier.join(" et ")} à vérifier` : "Rien à vérifier"} · ${validees}`;
}

/**
 * Les six arrêts, dans l'ordre du circuit. Les comptes sont ceux de la file
 * « À faire » (`itemsAFaire`), répartis par arrêt : leur somme est le total de
 * la file. Sans conservation des rapports, le visa se fait sur papier : l'arrêt
 * reste, sans lien, pour que le circuit ne mente pas.
 */
export function arretsCircuit(
  profil: Exclude<ProfilAcces, "poste">,
  comptes: ComptesAttente,
  conservation: boolean,
  infos: InfosCircuit,
): ArretCircuit[] {
  const admin = profil === "admin";
  const m = infos.modules;
  const brouillons =
    infos.brouillons === 0 ? "Aucun module en brouillon" : compte(infos.brouillons, "module en brouillon", "modules en brouillon");
  const aViser = [
    comptes.rapportsAViser > 0 && compte(comptes.rapportsAViser, "rapport à viser", "rapports à viser"),
    comptes.verdictsAArbitrer > 0 && compte(comptes.verdictsAArbitrer, "verdict à arbitrer", "verdicts à arbitrer"),
  ].filter(Boolean);
  const aSuivre = [
    comptes.signalements > 0 && compte(comptes.signalements, "signalement ouvert", "signalements ouverts"),
    conservation && comptes.quizAnciens > 0 && `${comptes.quizAnciens} quiz de plus de ${maintien.periodiciteMois} mois`,
  ].filter(Boolean);
  return [
    {
      cle: "deposer",
      titre: "Déposer",
      medaillon: "dossier-de-lot",
      detail:
        m === null
          ? "Questions, modules, documents"
          : m.sansQuestion === 0
            ? "Chaque module a des questions"
            : compte(m.sansQuestion, "module sans question", "modules sans question"),
      enAttente: 0,
      lien: { href: "/admin/questions/import", libelle: "Déposer des questions" },
      autres: [
        { href: "/admin/modules", libelle: "Modules" },
        { href: "/admin/documents", libelle: "Documents" },
      ],
    },
    {
      cle: "verifier",
      titre: "Vérifier",
      medaillon: "controle-qualite",
      detail: ligneVerifier(comptes.contenusAVerifier, infos.banque),
      enAttente: comptes.contenusAVerifier,
      lien: { href: "/admin/questions?statut=a_verifier", libelle: "Questions et fiches à vérifier" },
      autres: [{ href: "/admin/questions", libelle: "Banque de questions" }],
    },
    {
      cle: "publier",
      titre: "Publier",
      medaillon: "etiquetage",
      // Le tutorat dépose des modules qu'il ne publie pas : la ligne le lui dit.
      detail: admin
        ? brouillons
        : infos.brouillons === 0
          ? "Publication réservée à l'administration"
          : `${brouillons} · publication par l'administration`,
      enAttente: 0,
      lien: { href: "/admin/modules", libelle: "Modules" },
      autres: [],
    },
    {
      cle: "former",
      titre: "Former",
      medaillon: "formation-diplome",
      detail:
        m === null
          ? "Le programme, vu par l'apprenant"
          : m.auProgramme === 0
            ? "Aucun module au programme"
            : `${compte(m.evaluables, "module évaluable", "modules évaluables")} sur ${m.auProgramme}`,
      enAttente: 0,
      lien: { href: "/admin/essai", libelle: "Tester en apprenant" },
      autres: [
        { href: "/", libelle: "Programme" },
        { href: "/admin/ordonnancement", libelle: "Ordre" },
      ],
    },
    {
      cle: "viser",
      titre: "Viser",
      medaillon: "attestation-habilitation",
      detail: !conservation
        ? "Rapport téléchargé, signé sur papier"
        : aViser.length > 0
          ? aViser.join(" · ")
          : "Aucun rapport en attente",
      enAttente: conservation ? comptes.rapportsAViser + comptes.verdictsAArbitrer : 0,
      lien: conservation ? { href: "/admin/rapports", libelle: "Rapports" } : undefined,
      autres: [],
    },
    {
      cle: "suivre",
      titre: "Suivre",
      medaillon: "resultats-conformes",
      detail: aSuivre.length > 0 ? aSuivre.join(" · ") : "Aucun signalement ouvert",
      enAttente: comptes.signalements + (conservation ? comptes.quizAnciens : 0),
      lien: { href: "/admin/pilotage", libelle: "Pilotage" },
      autres: [{ href: "/admin/signalements", libelle: "Signalements" }],
    },
  ];
}

export interface ACote {
  titre: string;
  medaillon: string;
  href: string;
}

/** À côté du circuit : ce qui n'est pas une étape. Réglages est réservé à l'administration. */
export function aCoteDuCircuit(profil: Exclude<ProfilAcces, "poste">): ACote[] {
  return [
    { titre: "Codes d'accès", medaillon: "zone-sterile", href: "/admin" },
    { titre: "Squelette", medaillon: "procede-pharmaceutique", href: "/admin/filieres" },
    ...(profil === "admin" ? [{ titre: "Réglages", medaillon: "autoclave", href: "/admin/bareme" }] : []),
    { titre: "Repères", medaillon: "marche-en-avant", href: "/reperes" },
  ];
}
