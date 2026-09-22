import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_MODULES_PROGRAMME,
  MENTION_DEGRADE,
  estStatutProgramme,
  libelleProgramme,
  lireIdProgramme,
  manquesPourValider,
  modulesDuProgramme,
  ordonnerProgramme,
  peutValiderProgramme,
} from "../content/programmes";

// ── Programme à la carte : le parcours dégradé (question 50, 22/09/2026)

const LISTE = ["m1", "m2", "m3", "m4", "m5"];

test("sans rang, l'ordre de la liste — celui de la fiche", () => {
  assert.deepEqual(ordonnerProgramme(["m4", "m1", "m3"], {}, LISTE), ["m1", "m3", "m4"]);
});

test("le rang saisi fixe l'ordre ; les modules sans rang passent après", () => {
  assert.deepEqual(ordonnerProgramme(["m1", "m3", "m5"], { m5: "1", m3: "2" }, LISTE), ["m5", "m3", "m1"]);
});

test("à rang égal, l'ordre de la liste départage", () => {
  assert.deepEqual(ordonnerProgramme(["m4", "m2"], { m4: "1", m2: "1" }, LISTE), ["m2", "m4"]);
});

test("ni module inconnu, ni doublon, ni rang absurde", () => {
  assert.deepEqual(ordonnerProgramme(["m2", "inconnu", "m2", 7, null], { m2: "-3" }, LISTE), ["m2"]);
  assert.deepEqual(ordonnerProgramme(["m1", "m2"], { m1: "2,5", m2: "abc" }, LISTE), ["m1", "m2"], "rangs illisibles : ordre de la liste");
});

test("un programme ne dépasse pas le plafond de modules", () => {
  const liste = Array.from({ length: MAX_MODULES_PROGRAMME + 10 }, (_, i) => `m${i}`);
  assert.equal(ordonnerProgramme(liste, {}, liste).length, MAX_MODULES_PROGRAMME);
});

test("valider exige un nom, un motif et un module ; et un brouillon", () => {
  const complet = { nom: "Intérimaire", motif: "Chimiothérapie seule.", modules: ["m1"] };
  assert.deepEqual(manquesPourValider(complet), []);
  assert.deepEqual(manquesPourValider({ nom: " ", motif: "", modules: [] }), [
    "un nom",
    "le motif de l'écart à la fiche",
    "au moins un module",
  ]);
  assert.equal(peutValiderProgramme({ ...complet, statut: "brouillon" }), true);
  assert.equal(peutValiderProgramme({ ...complet, statut: "valide" }), false, "déjà validé");
  assert.equal(peutValiderProgramme({ ...complet, statut: "retire" }), false, "un programme retiré ne se valide pas");
  assert.equal(peutValiderProgramme({ ...complet, motif: "", statut: "brouillon" }), false, "pas d'écart sans motif");
});

test("partout où il paraît, un programme à la carte se dit parcours dégradé", () => {
  assert.equal(libelleProgramme({ nom: "Intérimaire" }), `Programme à la carte « Intérimaire » — ${MENTION_DEGRADE}`);
  assert.match(MENTION_DEGRADE, /dégradé/);
});

test("un module retiré du catalogue est compté absent, jamais deviné", () => {
  const { presents, absents } = modulesDuProgramme({ modules: ["m3", "retire", "m1"] }, [{ id: "m1" }, { id: "m3" }]);
  assert.deepEqual(presents.map((m) => m.id), ["m3", "m1"], "l'ordre du programme est gardé");
  assert.deepEqual(absents, ["retire"]);
});

test("identifiant et statut lus sans rien inventer", () => {
  assert.equal(lireIdProgramme("12"), 12);
  assert.equal(lireIdProgramme(" 3 "), 3);
  assert.equal(lireIdProgramme("0"), null);
  assert.equal(lireIdProgramme("3; DROP"), null);
  assert.equal(lireIdProgramme(undefined), null);
  assert.equal(estStatutProgramme("valide"), true);
  assert.equal(estStatutProgramme("publie"), false);
});
