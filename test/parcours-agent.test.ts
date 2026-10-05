import { test } from "node:test";
import assert from "node:assert/strict";
import { appliquerAuProgramme, appliquerParcours, composerParcours, lireParcours } from "../content/parcours-agent";

// ── Question 103 (choix a, 05/10/2026) : parcours d'un agent, composé sur sa fiche par le tutorat

test("parcours relu : identifiants seuls, sans doublon, fermés pris parmi les modules", () => {
  assert.deepEqual(lireParcours(["a", "b", "a", 3, null], ["b", "z", "b"]), { modules: ["a", "b"], fermes: ["b"] });
  assert.deepEqual(lireParcours("pas une liste", undefined), { modules: [], fermes: [] });
  assert.deepEqual(lireParcours(["a"], ["a"]), { modules: ["a"], fermes: ["a"] }, "un parcours d'un seul module, fermé");
});

test("parcours saisi : l'ordre de la liste, gardé aux cochés et aux candidats", () => {
  const candidats = ["s1", "s2", "f1", "f2", "f3"];
  const p = composerParcours(["f2", "s1", "f1", "s2", "f3"], ["s1", "f2", "f3"], ["f3"], candidats);
  assert.deepEqual(p, { modules: ["f2", "s1", "f3"], fermes: ["f3"] });
});

test("parcours saisi : rien d'étranger, aucun doublon, un fermé non coché ne compte pas", () => {
  const candidats = ["s1", "s2", "f1"];
  const p = composerParcours(["intrus", "f1", "f1", 42, "s1"], ["f1", "intrus", "s2", "s1"], ["intrus", "s2", "s1"], candidats);
  // s2 est coché mais la liste rangée l'omet : il se range à la suite, dans l'ordre des candidats.
  assert.deepEqual(p, { modules: ["f1", "s1", "s2"], fermes: ["s1", "s2"] });
  assert.deepEqual(composerParcours(candidats, [], ["s1"], candidats), { modules: [], fermes: [] }, "rien de coché : parcours vide");
  assert.deepEqual(composerParcours([], ["s2"], [], candidats), { modules: ["s2"], fermes: [] }, "coché sans ordre : l'ordre des candidats");
});

const m = (id: string) => ({ id, titre: `Module ${id}` });

test("parcours appliqué à une liste : les présents dans l'ordre du parcours, les absents comptés", () => {
  const liste = [m("s1"), m("s2"), m("f1"), m("f2")];
  const { presents, absents } = appliquerParcours({ modules: ["f2", "retire", "s1"] }, liste);
  assert.deepEqual(presents.map((x) => x.id), ["f2", "s1"], "l'ordre du parcours, pas celui de la liste");
  assert.deepEqual(absents, ["retire"]);
  assert.deepEqual(appliquerParcours({ modules: [] }, liste), { presents: [], absents: [] });
});

test("parcours appliqué au programme du code : ses seuls modules, les fermés et les sans-question fermés", () => {
  const programme = { modules: [m("s1"), m("s2"), m("f1"), m("f2")], ouverts: new Set(["s1", "s2", "f2"]) };
  const r = appliquerAuProgramme(programme, { modules: ["f2", "sorti", "f1", "s1"], fermes: ["s1", "sorti"] });
  assert.deepEqual(r.modules.map((x) => x.id), ["f2", "f1", "s1"]);
  assert.deepEqual([...r.ids].sort(), ["f1", "f2", "s1"]);
  assert.deepEqual([...r.fermes], ["s1"], "un module sorti du programme n'est plus « fermé » : il est absent");
  assert.deepEqual([...r.ouverts], ["f2"], "f1 n'a pas de question, s1 est fermé par le tutorat, s2 n'est pas au parcours");
  assert.equal(r.absents, 1);
});

test("parcours dont plus aucun module n'est au programme : rien d'ouvert, les absents comptés", () => {
  const programme = { modules: [m("s1")], ouverts: new Set(["s1"]) };
  const r = appliquerAuProgramme(programme, { modules: ["ancien-1", "ancien-2"], fermes: [] });
  assert.deepEqual(r.modules, []);
  assert.deepEqual([...r.ouverts], []);
  assert.equal(r.absents, 2);
});
