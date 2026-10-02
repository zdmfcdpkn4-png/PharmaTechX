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
  /** Une ligne : ce qu'on y fait, ou ce qui s'y trouve. */
  detail: string;
  /** Ce qui attend un acte, compté comme dans « À faire ». */
  enAttente: number;
  /** Lien principal ; absent quand l'arrêt se passe hors du site. */
  lien?: LienArret;
  /** Écrans voisins du même arrêt. */
  autres: LienArret[];
}

export interface InfosCircuit {
  /** Questions validées en base, chaque question une fois (`totauxQuestions`). */
  validees: number;
  /** Modules déposés au statut brouillon. */
  brouillons: number;
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
  return [
    {
      cle: "deposer",
      titre: "Déposer",
      medaillon: "dossier-de-lot",
      detail: "Questions, modules, documents",
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
      detail: `Quatre yeux · ${infos.validees} validée${infos.validees > 1 ? "s" : ""}`,
      enAttente: comptes.contenusAVerifier,
      lien: { href: "/admin/questions?statut=a_verifier", libelle: "Questions et fiches à vérifier" },
      autres: [{ href: "/admin/questions", libelle: "Banque de questions" }],
    },
    {
      cle: "publier",
      titre: "Publier",
      medaillon: "etiquetage",
      detail: admin
        ? `${infos.brouillons} module${infos.brouillons > 1 ? "s" : ""} en brouillon`
        : "Réservé à l'administration",
      enAttente: 0,
      lien: { href: "/admin/modules", libelle: "Modules" },
      autres: [],
    },
    {
      cle: "former",
      titre: "Former",
      medaillon: "formation-diplome",
      detail: "Le programme, vu par l'apprenant",
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
      detail: conservation ? "Arbitrer, viser, clore" : "Rapport téléchargé, signé sur papier",
      enAttente: conservation ? comptes.rapportsAViser + comptes.verdictsAArbitrer : 0,
      lien: conservation ? { href: "/admin/rapports", libelle: "Rapports" } : undefined,
      autres: [],
    },
    {
      cle: "suivre",
      titre: "Suivre",
      medaillon: "resultats-conformes",
      detail: "Pilotage, signalements",
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
