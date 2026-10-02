import { test } from "node:test";
import assert from "node:assert/strict";
import { CHEMIN, aCoteDuCircuit, arretsCircuit, etapeCourante, etatModules, type InfosCircuit } from "../content/accueil";
import { AUCUN_COMPTE, itemsAFaire, totalEnAttente, type ComptesAttente } from "../content/acces-rapide";
import { ILLUSTRATIONS } from "../content/badges";
import { etapes } from "../content/habilitation";
import type { Module } from "../content/types";

const COMPTES: ComptesAttente = { signalements: 3, contenusAVerifier: 12, rapportsAViser: 2, verdictsAArbitrer: 1, quizAnciens: 4 };
const INFOS: InfosCircuit = {
  banque: { validees: 57, aVerifier: 10 },
  brouillons: 2,
  modules: { sansQuestion: 41, evaluables: 9, auProgramme: 55 },
};
const lignes = (...args: Parameters<typeof arretsCircuit>) =>
  Object.fromEntries(arretsCircuit(...args).map((a) => [a.cle, a.detail]));

test("le chemin de l'agent reprend les six étapes de la fiche, dans leur ordre", () => {
  assert.deepEqual(
    CHEMIN.map((e) => e.numero),
    etapes.map((e) => e.numero),
  );
  assert.deepEqual(
    CHEMIN.map((e) => e.lieu),
    etapes.map((e) => e.lieu),
    "le lieu vient de la fiche : seules les étapes du site sont actives",
  );
  assert.deepEqual(
    CHEMIN.filter((e) => e.lieu === "site").map((e) => e.numero),
    [1, 2],
    "le site couvre les étapes 1 et 2",
  );
  for (const e of CHEMIN.filter((x) => x.lieu !== "site")) assert.ok(e.ou, `étape ${e.numero} : lieu dit`);
  assert.equal(CHEMIN[5].ou, "Tous les 2 ans", "maintien : la périodicité de la fiche");
});

test("étape courante : l'évaluation en plan, puis la formation, puis le poste", () => {
  assert.equal(etapeCourante({ evaluationEnCours: true, resteAAcquerir: true }), 2);
  assert.equal(etapeCourante({ evaluationEnCours: false, resteAAcquerir: true }), 1);
  assert.equal(etapeCourante({ evaluationEnCours: false, resteAAcquerir: false }), 3, "tout acquis à l'écran : la suite est au poste");
});

test("les comptes du circuit sont ceux de « À faire », et leur somme son total", () => {
  for (const profil of ["tuteur", "admin"] as const) {
    for (const conservation of [true, false]) {
      const arrets = arretsCircuit(profil, COMPTES, conservation, INFOS);
      const somme = arrets.reduce((n, a) => n + a.enAttente, 0);
      assert.equal(somme, totalEnAttente(itemsAFaire(profil, COMPTES, conservation)), `${profil}, conservation ${conservation}`);
    }
  }
  const arrets = arretsCircuit("admin", COMPTES, true, INFOS);
  const de = (cle: string) => arrets.find((a) => a.cle === cle)!;
  assert.equal(de("verifier").enAttente, 12);
  assert.equal(de("viser").enAttente, 3, "rapports à viser et verdicts à arbitrer");
  assert.equal(de("suivre").enAttente, 7, "signalements et quiz anciens");
  assert.equal(arretsCircuit("admin", AUCUN_COMPTE, true, INFOS).reduce((n, a) => n + a.enAttente, 0), 0);
});

test("le circuit : six arrêts, dans l'ordre ; sans conservation, le visa se fait sur papier", () => {
  const avec = arretsCircuit("admin", COMPTES, true, INFOS);
  assert.deepEqual(
    avec.map((a) => a.titre),
    ["Déposer", "Vérifier", "Publier", "Former", "Viser", "Suivre"],
  );
  const sans = arretsCircuit("admin", COMPTES, false, INFOS);
  const viser = sans.find((a) => a.cle === "viser")!;
  assert.equal(viser.lien, undefined, "pas d'écran des rapports sans conservation");
  assert.equal(viser.enAttente, 0);
  for (const a of sans) {
    for (const l of [a.lien, ...a.autres]) assert.notEqual(l?.href, "/admin/rapports", `${a.titre} : écran absent cité`);
  }
});

test("le tutorat publie par l'administration et n'a pas de réglages", () => {
  assert.equal(lignes("tuteur", COMPTES, true, { ...INFOS, brouillons: 0 }).publier, "Publication réservée à l'administration");
  assert.equal(lignes("tuteur", COMPTES, true, INFOS).publier, "2 modules en brouillon · publication par l'administration");
  assert.equal(aCoteDuCircuit("tuteur").some((x) => x.href === "/admin/bareme"), false);
  assert.equal(aCoteDuCircuit("admin").some((x) => x.href === "/admin/bareme"), true);
});

test("sous chaque arrêt, ce qui attend ou ce qui s'y trouve, avec les mots de « À faire »", () => {
  assert.deepEqual(lignes("admin", COMPTES, true, INFOS), {
    deposer: "41 modules sans question",
    verifier: "10 questions et 2 fiches à vérifier · 57 validées",
    publier: "2 modules en brouillon",
    former: "9 modules évaluables sur 55",
    viser: "2 rapports à viser · 1 verdict à arbitrer",
    suivre: "3 signalements ouverts · 4 quiz de plus de 24 mois",
  });
  // Rien en attente : la ligne le dit, en toutes lettres.
  assert.deepEqual(
    lignes("admin", AUCUN_COMPTE, true, {
      banque: { validees: 0, aVerifier: 0 },
      brouillons: 0,
      modules: { sansQuestion: 0, evaluables: 0, auProgramme: 0 },
    }),
    {
      deposer: "Chaque module a des questions",
      verifier: "Aucune question en banque",
      publier: "Aucun module en brouillon",
      former: "Aucun module au programme",
      viser: "Aucun rapport en attente",
      suivre: "Aucun signalement ouvert",
    },
  );
  // Un de chaque : le singulier.
  assert.deepEqual(
    lignes("admin", { signalements: 1, contenusAVerifier: 1, rapportsAViser: 1, verdictsAArbitrer: 0, quizAnciens: 1 }, true, {
      banque: { validees: 1, aVerifier: 1 },
      brouillons: 1,
      modules: { sansQuestion: 1, evaluables: 1, auProgramme: 1 },
    }),
    {
      deposer: "1 module sans question",
      verifier: "1 question à vérifier · 1 validée",
      publier: "1 module en brouillon",
      former: "1 module évaluable sur 1",
      viser: "1 rapport à viser",
      suivre: "1 signalement ouvert · 1 quiz de plus de 24 mois",
    },
  );
});

test("Vérifier : questions et fiches séparées ; « validées » nomme les questions quand la ligne ne l'a pas fait", () => {
  const verifier = (contenus: number, banque: InfosCircuit["banque"]) =>
    lignes("admin", { ...AUCUN_COMPTE, contenusAVerifier: contenus }, true, { ...INFOS, banque }).verifier;
  assert.equal(verifier(12, { validees: 0, aVerifier: 12 }), "12 questions à vérifier · aucune validée");
  assert.equal(verifier(2, { validees: 3, aVerifier: 0 }), "2 fiches à vérifier · 3 questions validées");
  assert.equal(verifier(0, { validees: 5, aVerifier: 0 }), "Rien à vérifier · 5 questions validées");
  assert.equal(verifier(2, { validees: 0, aVerifier: 0 }), "2 fiches à vérifier · aucune question validée");
  // Banque illisible : le compte de la pastille, sans le partager.
  assert.equal(verifier(12, null), "12 à vérifier");
  assert.equal(verifier(0, null), "Rien à vérifier");
});

test("sans conservation ni état des modules, aucune ligne n'invente un compte", () => {
  const sans = lignes("admin", COMPTES, false, { ...INFOS, modules: null });
  assert.equal(sans.viser, "Rapport téléchargé, signé sur papier");
  assert.equal(sans.suivre, "3 signalements ouverts", "pas de quiz anciens sans rapports conservés");
  assert.equal(sans.deposer, "Questions, modules, documents");
  assert.equal(sans.former, "Le programme, vu par l'apprenant");
});

test("état des modules : sans question, au programme, évaluables, comptés comme le programme", () => {
  const fictif = (
    id: string,
    o: { statut?: Module["statut"]; ecrites?: number; enSituation?: number; parcours?: Module["parcours"] } = {},
  ) => ({
    id,
    statut: o.statut,
    parcours: o.parcours ?? (["integration"] as Module["parcours"]),
    questions: Array(o.ecrites ?? 0).fill({}) as Module["questions"],
    misesEnSituation: (o.enSituation ? [{ questions: Array(o.enSituation).fill({}) }] : []) as Module["misesEnSituation"],
  });
  const etat = etatModules(
    [
      fictif("code-ecrit", { ecrites: 2 }),
      fictif("code-a-verifier"),
      fictif("code-vide"),
      fictif("code-situation", { enSituation: 1 }),
      fictif("brouillon-depose", { statut: "brouillon" }),
      fictif("brouillon-vide", { statut: "brouillon" }),
      fictif("publie-depose", { statut: "publie" }),
      fictif("retire-vide", { statut: "retire" }),
      fictif("hors-parcours", { parcours: [] }),
    ],
    {
      "code-a-verifier": { valides: 0, aVerifier: 3 },
      "brouillon-depose": { valides: 1, aVerifier: 0 },
      "publie-depose": { valides: 2, aVerifier: 0 },
    },
  );
  assert.deepEqual(etat, {
    // code-vide et brouillon-vide ; un module retiré ou hors parcours n'attend plus rien.
    sansQuestion: 2,
    // code-ecrit, code-situation, publie-depose : une question validée au moins, ou écrite dans le code.
    evaluables: 3,
    // les quatre du code sur un parcours, et le seul déposé publié.
    auProgramme: 5,
  });
});

test("chaque médaillon de l'accueil est une illustration du site", () => {
  const noms = [
    ...CHEMIN.map((e) => e.medaillon),
    ...arretsCircuit("admin", COMPTES, true, INFOS).map((a) => a.medaillon),
    ...aCoteDuCircuit("admin").map((x) => x.medaillon),
  ];
  for (const n of noms) assert.ok(ILLUSTRATIONS[n], `médaillon inconnu : ${n}`);
});
