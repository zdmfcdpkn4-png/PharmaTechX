import { test } from "node:test";
import assert from "node:assert/strict";
import { CHEMIN, aCoteDuCircuit, arretsCircuit, etapeCourante } from "../content/accueil";
import { AUCUN_COMPTE, itemsAFaire, totalEnAttente, type ComptesAttente } from "../content/acces-rapide";
import { ILLUSTRATIONS } from "../content/badges";
import { etapes } from "../content/habilitation";

const COMPTES: ComptesAttente = { signalements: 3, contenusAVerifier: 12, rapportsAViser: 2, verdictsAArbitrer: 1, quizAnciens: 4 };
const INFOS = { validees: 57, brouillons: 2 };

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
  const publier = arretsCircuit("tuteur", COMPTES, true, INFOS).find((a) => a.cle === "publier")!;
  assert.equal(publier.detail, "Réservé à l'administration");
  assert.equal(aCoteDuCircuit("tuteur").some((x) => x.href === "/admin/bareme"), false);
  assert.equal(aCoteDuCircuit("admin").some((x) => x.href === "/admin/bareme"), true);
});

test("chaque médaillon de l'accueil est une illustration du site", () => {
  const noms = [
    ...CHEMIN.map((e) => e.medaillon),
    ...arretsCircuit("admin", COMPTES, true, INFOS).map((a) => a.medaillon),
    ...aCoteDuCircuit("admin").map((x) => x.medaillon),
  ];
  for (const n of noms) assert.ok(ILLUSTRATIONS[n], `médaillon inconnu : ${n}`);
});
