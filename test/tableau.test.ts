import { test } from "node:test";
import assert from "node:assert/strict";
import {
  AUCUN_FILTRE,
  MAX_CONSULTATIONS,
  ajouterConsultation,
  avancementDe,
  choisirReprise,
  correspond,
  etatModule,
  filtrerModules,
  filtresActifs,
  lireConsultations,
  normaliser,
  type EtatModule,
} from "../content/tableau";

// ── Tableau de bord de l'accueil (22/09/2026)

const evaluable = { redige: true, nbQuestions: 10 };

test("l'état d'un module suit le verdict de sa dernière évaluation", () => {
  assert.equal(etatModule(evaluable, { verdict: "acquis" }, false), "acquis");
  assert.equal(etatModule(evaluable, { verdict: "indetermine" }, false), "arbitrage");
  assert.equal(etatModule(evaluable, { verdict: "non_acquis" }, true), "non-acquis", "le verdict l'emporte sur la lecture");
  assert.equal(etatModule(evaluable, { verdict: "non_concluant" }, false), "non-concluant");
});

test("sans évaluation : lecture entamée, à faire, à rédiger, lecture seule", () => {
  assert.equal(etatModule(evaluable, undefined, true), "en-lecture");
  assert.equal(etatModule(evaluable, undefined, false), "a-faire");
  assert.equal(etatModule({ redige: false, nbQuestions: 0 }, undefined, false), "a-rediger");
  assert.equal(etatModule({ redige: false, nbQuestions: 3 }, undefined, false), "a-faire", "évaluable sans texte");
  assert.equal(etatModule({ redige: true, nbQuestions: 0 }, undefined, false), "lecture-seule");
});

test("terminé, en cours, à venir : seul l'acquis est terminé", () => {
  const attendu: Record<EtatModule, string> = {
    acquis: "termine",
    arbitrage: "en-cours",
    "non-acquis": "en-cours",
    "non-concluant": "en-cours",
    "en-lecture": "en-cours",
    "a-faire": "a-venir",
    "a-rediger": "a-venir",
    "lecture-seule": "a-venir",
  };
  for (const [etat, avancement] of Object.entries(attendu)) {
    assert.equal(avancementDe(etat as EtatModule), avancement, etat);
  }
});

const modules = [
  { id: "m1", titre: "Lavage des mains et règles d'hygiène", objectif: "Se laver les mains", critereId: "B1-02", bloc: "1", niveaux: ["N1a"], redige: true, nbQuestions: 10 },
  { id: "m2", titre: "Habillage en zone", objectif: "S'habiller", critereId: "B1-01", bloc: "1", niveaux: ["N1a"], redige: true, nbQuestions: 3 },
  { id: "m3", titre: "Préparation en isolateur", objectif: "Préparer", critereId: "B2-04", bloc: "2", niveaux: ["N2"], redige: false, nbQuestions: 0 },
];

test("la recherche ignore accents et casse, et exige chaque mot", () => {
  assert.equal(normaliser("Hygiène À l'ÉCRAN"), "hygiene a l'ecran");
  assert.equal(correspond(modules[0], "hygiene"), true);
  assert.equal(correspond(modules[0], "MAINS hygiène"), true);
  assert.equal(correspond(modules[0], "mains isolateur"), false, "tous les mots, pas l'un d'eux");
  assert.equal(correspond(modules[0], "b1-02"), true, "par numéro de critère");
  assert.equal(correspond(modules[2], "n2"), true, "par niveau");
  assert.equal(correspond(modules[2], "fabrication", "Fabrication des préparations"), true, "par intitulé de bloc");
  assert.equal(correspond(modules[0], "   "), true, "recherche vide : tout");
});

test("les filtres se cumulent : texte, bloc, avancement", () => {
  const etats: Record<string, EtatModule> = { m1: "acquis", m2: "a-faire", m3: "a-rediger" };
  const etatDe = (m: { id: string }) => etats[m.id];
  const ids = (f: typeof AUCUN_FILTRE) => filtrerModules(modules, f, etatDe).map((m) => m.id);
  assert.deepEqual(ids(AUCUN_FILTRE), ["m1", "m2", "m3"]);
  assert.deepEqual(ids({ ...AUCUN_FILTRE, bloc: "1" }), ["m1", "m2"]);
  assert.deepEqual(ids({ ...AUCUN_FILTRE, avancement: "termine" }), ["m1"]);
  assert.deepEqual(ids({ ...AUCUN_FILTRE, avancement: "a-venir" }), ["m2", "m3"]);
  assert.deepEqual(ids({ texte: "zone", bloc: "1", avancement: "a-venir" }), ["m2"]);
  assert.deepEqual(ids({ ...AUCUN_FILTRE, bloc: "9" }), []);
  assert.equal(filtresActifs(AUCUN_FILTRE), false);
  assert.equal(filtresActifs({ ...AUCUN_FILTRE, texte: "  " }), false, "des espaces ne filtrent rien");
  assert.equal(filtresActifs({ ...AUCUN_FILTRE, avancement: "en-cours" }), true);
});

const programme = [
  { id: "m1", titre: "Lavage des mains", evaluable: true, redige: true },
  { id: "m2", titre: "Habillage", evaluable: true, redige: true },
  { id: "m3", titre: "Isolateur", evaluable: false, redige: false },
  { id: "m4", titre: "Déchets", evaluable: false, redige: true },
];

test("Reprendre : l'évaluation laissée en plan passe d'abord", () => {
  const r = choisirReprise({
    evaluation: { moduleId: "m2", titre: "Habillage", detail: "3 sur 10 questions" },
    lecture: { module: "m1", titre: "Lavage des mains", num: 2, total: 5 },
    programme,
    acquis: () => false,
  });
  assert.equal(r?.nature, "evaluation");
  assert.equal(r?.href, "/module/m2/evaluation");
  assert.match(r?.detail ?? "", /3 sur 10 questions/);
});

test("Reprendre : puis la lecture en cours, sauf si son module est acquis", () => {
  const lecture = { module: "m1", titre: "Lavage des mains", num: 2, total: 5 };
  const r = choisirReprise({ lecture, programme, acquis: () => false });
  assert.equal(r?.nature, "lecture");
  assert.equal(r?.href, "/module/m1");
  assert.match(r?.detail ?? "", /section 2 sur 5/);
  const apres = choisirReprise({ lecture, programme, acquis: (id) => id === "m1" });
  assert.equal(apres?.nature, "suivant", "lecture d'un module acquis : on passe au suivant");
  assert.equal(apres?.moduleId, "m2");
});

test("Reprendre : sinon le premier module ouvrable non acquis, dans l'ordre du programme", () => {
  const r = choisirReprise({ programme, acquis: (id) => id === "m1" || id === "m2", requete: "?programme=4" });
  assert.equal(r?.moduleId, "m4", "m3 n'est ni rédigé ni évaluable : il ne s'ouvre pas");
  assert.equal(r?.href, "/module/m4?programme=4", "le programme à la carte suit");
  assert.match(r?.detail ?? "", /lecture/);
  assert.equal(choisirReprise({ programme, acquis: (id) => id !== "m3" }), null, "tout est acquis : rien à reprendre");
  assert.equal(choisirReprise({ programme: [], acquis: () => false }), null);
});

test("modules consultés : les plus récents d'abord, sans doublon, bornés", () => {
  const c = (module: string, le = "2026-09-22T10:00:00.000Z") => ({ module, titre: `Titre ${module}`, le });
  let liste = [c("m1"), c("m2")];
  liste = ajouterConsultation(liste, c("m2", "2026-09-22T11:00:00.000Z"));
  assert.deepEqual(liste.map((x) => x.module), ["m2", "m1"], "rouvert : remonte en tête, une seule fois");
  for (let i = 0; i < 10; i++) liste = ajouterConsultation(liste, c(`n${i}`));
  assert.equal(liste.length, MAX_CONSULTATIONS);
  assert.equal(liste[0].module, "n9");
});

test("modules consultés : une trace illisible ou forgée est écartée", () => {
  assert.deepEqual(lireConsultations(null), []);
  assert.deepEqual(lireConsultations("pas du json"), []);
  assert.deepEqual(lireConsultations('{"module":"m1"}'), [], "pas une liste");
  const brut = JSON.stringify([
    { module: "m1", titre: "Lavage", le: "2026-09-22T10:00:00.000Z" },
    { module: "../admin", titre: "x", le: "y" },
    { module: "m2", titre: 12, le: "y" },
    null,
  ]);
  assert.deepEqual(lireConsultations(brut).map((x) => x.module), ["m1"]);
});
