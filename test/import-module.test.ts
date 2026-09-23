import { test } from "node:test";
import assert from "node:assert/strict";
import {
  indexerModules,
  motsSignificatifs,
  proposerModule,
  reperesModules,
  resoudreLigneModule,
  type CorpusModule,
  type ModuleRepere,
} from "../lib/import-module";

const MODULES: ModuleRepere[] = [
  { id: "comportement-zac", titre: "Comportement et habillage en zone à atmosphère contrôlée", critere: "B1-01" },
  { id: "critere-b1-05", titre: "Sécurité incendie (issues de secours, extincteurs, coupure des fluides, évacuation)", critere: "B1-05" },
  { id: "critere-b4-07", titre: "Gestion de fin de préparation (reliquats, déchets) et sortie de poche de l'isolateur", critere: "B4-07" },
  { id: "critere-b5-06", titre: "Conditionnement, sortie de la préparation et élimination des déchets", critere: "B5-06" },
  { id: "mod-abc", titre: "Module déposé sur le même critère", critere: "B5-06" },
  { id: "mod-sans", titre: "Module déposé sans critère", critere: "" },
];

test("ligne « Module : » : code du critère, identifiant, titre, « code — titre »", () => {
  assert.deepEqual(resoudreLigneModule("B1-05", MODULES), { id: "critere-b1-05" });
  assert.deepEqual(resoudreLigneModule("b1-05.", MODULES), { id: "critere-b1-05" }, "casse et point final");
  assert.deepEqual(resoudreLigneModule("critère B1-05", MODULES), { id: "critere-b1-05" });
  assert.deepEqual(resoudreLigneModule("critere-b1-05", MODULES), { id: "critere-b1-05" }, "identifiant");
  assert.deepEqual(resoudreLigneModule("Comportement et habillage en zone a atmosphere controlee", MODULES), { id: "comportement-zac" }, "titre, sans accents");
  assert.deepEqual(resoudreLigneModule("B1-01 — Comportement et habillage en zone à atmosphère contrôlée", MODULES), { id: "comportement-zac" });
  assert.deepEqual(resoudreLigneModule("Sécurité incendie", MODULES), { id: "critere-b1-05" }, "début de titre qui ne désigne qu'un module");
  assert.deepEqual(resoudreLigneModule("mod-sans", MODULES), { id: "mod-sans" });
});

test("ligne « Module : » : inconnue ou ambiguë, la question reste à choisir", () => {
  const inconnue = resoudreLigneModule("Z9-99", MODULES);
  assert.equal(inconnue.id, null);
  assert.match(inconnue.raison ?? "", /aucun module ne répond à « Z9-99 »/);
  const ambigue = resoudreLigneModule("B5-06", MODULES);
  assert.equal(ambigue.id, null, "deux modules portent B5-06");
  assert.match(ambigue.raison ?? "", /plusieurs modules répondent à « B5-06 » : critere-b5-06, mod-abc/);
  const contradictoire = resoudreLigneModule("B1-05 — Comportement et habillage en zone à atmosphère contrôlée", MODULES);
  assert.equal(contradictoire.id, null, "le code et le titre désignent deux modules");
});

test("nom court : le code du critère s'il est seul à le porter, sinon l'identifiant", () => {
  const noms = reperesModules(MODULES);
  assert.equal(noms.get("critere-b1-05"), "B1-05");
  assert.equal(noms.get("critere-b5-06"), "critere-b5-06");
  assert.equal(noms.get("mod-abc"), "mod-abc");
  assert.equal(noms.get("mod-sans"), "mod-sans");
  for (const m of MODULES) assert.deepEqual(resoudreLigneModule(noms.get(m.id) ?? "", MODULES), { id: m.id }, "chaque nom court se relit");
});

test("mots significatifs : sans mots vides ni marque du pluriel, forme lue gardée", () => {
  const mots = motsSignificatifs("Parmi les propositions suivantes, lesquelles concernent les déchets et le déchet ?");
  assert.deepEqual([...mots.keys()], ["concernent", "dechet"]);
  assert.equal(mots.get("dechet"), "déchets", "la forme lue garde ses accents");
});

const CORPUS: CorpusModule[] = [
  ...MODULES.filter((m) => !m.id.startsWith("mod-")).map((m) => ({ ...m, textes: [] })),
  { id: "critere-b3-01", titre: "Équipements et règles de sécurité de l'isolateur", critere: "B3-01", textes: [] },
  { id: "critere-b1-06", titre: "Principe d'une ZAC ; surveillance des températures et des pressions", critere: "B1-06", textes: [] },
  { id: "critere-b2-02", titre: "Protocoles par spécialité, ordre de passage, stabilité et compatibilité des molécules", critere: "B2-02", textes: [] },
];

test("proposition nette : les mots partagés sont rendus, du plus lourd au plus léger", () => {
  const p = proposerModule(indexerModules(CORPUS), "Concernant l'extincteur et l'évacuation en cas d'incendie, lesquelles sont vraies ?");
  assert.equal(p.id, "critere-b1-05");
  assert.deepEqual(p.candidats[0].mots.sort(), ["extincteur", "incendie", "évacuation"]);
});

test("hésitation entre deux titres voisins : à choisir", () => {
  const p = proposerModule(indexerModules(CORPUS), "Où vont les déchets en fin de préparation ?");
  assert.equal(p.id, null);
  assert.deepEqual(p.candidats.slice(0, 2).map((c) => c.id).sort(), ["critere-b4-07", "critere-b5-06"]);
});

test("un seul mot en commun ne suffit pas : « température » n'est pas la stabilité", () => {
  const p = proposerModule(indexerModules(CORPUS), "Quelle température de conservation pour un anticorps reconstitué ?");
  assert.equal(p.candidats[0]?.id, "critere-b1-06", "le module qui partage le mot est bien trouvé…");
  assert.equal(p.id, null, "… mais n'est pas proposé");
});

test("les questions validées d'un module comptent dans sa description", () => {
  const avecBanque = CORPUS.map((m) =>
    m.id === "critere-b2-02" ? { ...m, textes: ["Quelle est la température de conservation d'un anticorps monoclonal reconstitué ?"] } : m,
  );
  const p = proposerModule(indexerModules(avecBanque), "Quelle température de conservation pour un anticorps reconstitué ?");
  assert.equal(p.id, "critere-b2-02");
});

test("aucun mot en commun : à choisir, sans candidat", () => {
  const p = proposerModule(indexerModules(CORPUS), "Alpha ou bêta ?");
  assert.deepEqual(p, { id: null, candidats: [] });
});
