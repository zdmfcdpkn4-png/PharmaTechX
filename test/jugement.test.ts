import { test } from "node:test";
import assert from "node:assert/strict";
import {
  estADecouvrir,
  jugementsDuTirage,
  lireJugements,
  nombreDeJugements,
  refusEmissionEntrainement,
  verdictDuJugement,
} from "../content/jugement";
import { annoncePlusieurs, libelleBareme, libelleFormat, lireModeReponse, noterQuestion, sanitizeQuestion, type Question } from "../content/types";
import { BAREME_DEFAUT } from "../content/bareme";
import { normaliserEtatEnCours, questionsRenseignees } from "../content/en-cours";
import { construireRapport, type ResultatRapport } from "../lib/rapport";

// ── Schéma à découvrir, jugé par le tuteur (question 52, choix b)

const schema = (modeReponse: Question["modeReponse"]): Question => ({
  id: "s1",
  enonce: "Nommez les éléments cachés.",
  type: "SCH",
  options: [],
  bonnesReponses: [],
  justification: "",
  modeReponse,
  legendes: [
    { id: "l1", attendu: "sas de transfert", repere: { x: 10, y: 10 } },
    { id: "l2", attendu: "filtre HEPA | filtre terminal", repere: { x: 50, y: 10 } },
    { id: "l3", attendu: "plan de travail", repere: { x: 10, y: 60 } },
    { id: "l4", attendu: "gant", repere: { x: 60, y: 60 } },
  ],
});

test("le mode de réponse se lit sans jamais inventer : inconnu vaut « écrire »", () => {
  assert.equal(lireModeReponse("decouvrir"), "decouvrir");
  assert.equal(lireModeReponse("choisir"), "choisir");
  assert.equal(lireModeReponse("decouvri"), "ecrire", "une valeur tronquée n'est pas reconnue");
  assert.equal(lireModeReponse(undefined), "ecrire");
});

test("seul un schéma en mode « découvrir » se juge cache par cache", () => {
  assert.equal(estADecouvrir(schema("decouvrir")), true);
  assert.equal(estADecouvrir(schema("ecrire")), false);
  assert.equal(estADecouvrir({ type: "QIM", modeReponse: "decouvrir" }), false);
});

test("jugements lus : « juste » et « faux » seulement, le reste est un cache non jugé", () => {
  const j = lireJugements({ s1: { l1: "juste", l2: "faux", l3: "peut-être", l4: true }, s2: ["juste"], s3: "faux" });
  assert.deepEqual(j, { s1: { l1: "juste", l2: "faux" } });
  assert.deepEqual(lireJugements(null), {});
  assert.deepEqual(lireJugements(["x"]), {});
});

test("jugements du tirage : ni autre question, ni cache inconnu", () => {
  const q = schema("decouvrir");
  const autre = { ...schema("ecrire"), id: "s2" };
  const retenus = jugementsDuTirage({ s1: { l1: "juste", l9: "faux" }, s2: { l1: "juste" }, s3: { l1: "juste" } }, [q, autre]);
  assert.deepEqual(retenus, { s1: { l1: "juste" } });
  assert.equal(nombreDeJugements(retenus), 1);
});

test("notation : juste, faux, non jugé suivent le barème du schéma, cache par cache", () => {
  // Barème par défaut : partiel, juste +1, faux −1, sans réponse 0, par part de 1/4, plancher 0.
  const n = noterQuestion(schema("decouvrir"), { choix: [], jugements: { l1: "juste", l2: "juste", l3: "faux" } }, BAREME_DEFAUT);
  assert.equal(n.note, 0.25, "2 justes − 1 faux, sur 4 : un quart");
  assert.equal(n.discordances, 2, "un faux et un non jugé");
  assert.equal(n.nonJugees, 1);
  const parfait = noterQuestion(
    schema("decouvrir"),
    { choix: [], jugements: { l1: "juste", l2: "juste", l3: "juste", l4: "juste" } },
    BAREME_DEFAUT,
  );
  assert.equal(parfait.note, 1);
  assert.equal(parfait.discordances, 0, "entièrement juste : une éliminatoire passe");
});

test("en mode « découvrir », un mot écrit ne compte pas ; en mode « écrire », un jugement non plus", () => {
  const ecrits = { l1: "sas de transfert", l2: "filtre terminal", l3: "plan de travail", l4: "gant" };
  const aDecouvrir = noterQuestion(schema("decouvrir"), { choix: [], legendes: ecrits }, BAREME_DEFAUT);
  assert.equal(aDecouvrir.note, 0, "rien de jugé : quatre caches sans réponse");
  assert.equal(aDecouvrir.nonJugees, 4);
  const aEcrire = noterQuestion(schema("ecrire"), { choix: [], jugements: { l1: "juste", l2: "juste", l3: "juste", l4: "juste" } }, BAREME_DEFAUT);
  assert.equal(aEcrire.note, 0, "un jugement envoyé pour un schéma à écrire est ignoré");
});

test("verdict d'un jugement, dans le vocabulaire des légendes", () => {
  assert.equal(verdictDuJugement("juste"), "juste");
  assert.equal(verdictDuJugement("faux"), "fausse");
  assert.equal(verdictDuJugement(undefined), "vide");
});

test("à découvrir, le mot part avec la question pour lever le cache ; à écrire, jamais", () => {
  const pub = sanitizeQuestion(schema("decouvrir"));
  assert.deepEqual(pub.legendes?.map((l) => l.mot), ["sas de transfert", "filtre HEPA", "plan de travail", "gant"], "le mot sans ses variantes");
  const ecrire = sanitizeQuestion(schema("ecrire"));
  assert.equal(ecrire.legendes?.some((l) => "mot" in l), false);
  assert.equal(JSON.stringify(ecrire).includes("sas de transfert"), false, "aucun mot attendu dans un schéma à écrire");
});

test("format et barème annoncés à l'apprenant", () => {
  assert.equal(libelleFormat(schema("decouvrir")), "Schéma — caches à découvrir");
  assert.match(libelleBareme(schema("decouvrir")), /chaque cache compte pour sa part/);
  assert.match(libelleBareme(schema("decouvrir")), /cache non jugé/);
  assert.match(libelleBareme(schema("ecrire")), /légende vide/);
});

// ── « Plusieurs » quelle que soit la casse (question 68, choix a, 24/09/2026)

test("un QCM annonce plusieurs réponses quelle que soit la casse de « plusieurs »", () => {
  assert.equal(annoncePlusieurs("Plusieurs réponses possibles : lesquelles ?"), true);
  assert.equal(annoncePlusieurs("Lesquelles ? (PLUSIEURS RÉPONSES)"), true);
  assert.equal(annoncePlusieurs("Lesquelles ? (plusieurs réponses)"), true);
  assert.equal(annoncePlusieurs("Laquelle est exacte ?"), false);
  const qcm = (enonce: string): Question => ({ id: "q1", enonce, type: "QCM", options: [], bonnesReponses: [], justification: "" });
  assert.equal(libelleFormat(qcm("Plusieurs réponses : lesquelles ?")), "QCM — plusieurs réponses");
  assert.equal(libelleFormat(qcm("Laquelle est exacte ?")), "QCM — une seule réponse");
});

test("un résultat d'entraînement ne s'émet pas ; un résultat ancien, sans mode, reste émissible", () => {
  assert.match(String(refusEmissionEntrainement({ mode: "entrainement" })), /entraînement/);
  assert.equal(refusEmissionEntrainement({ mode: "evaluation" }), null);
  assert.equal(refusEmissionEntrainement({}), null);
});

test("session en cours : jugements et caches levés conservés, hors tirage ignorés, jamais de code", () => {
  const e = normaliserEtatEnCours({
    questionIds: ["s1", "q2"],
    mode: "evaluation",
    difficulte: "decouverte",
    reponses: {},
    qim: {},
    legendes: {},
    jugements: { s1: { l1: "juste", l2: "bof" }, s9: { l1: "juste" } },
    reveles: { s1: ["l1", "l2"], s9: ["l1"] },
    codeTuteur: "ABCDE-FGHJK",
    indexCourant: 0,
    corrections: {},
    maj: "2026-09-22T10:00:00.000Z",
  });
  assert.ok(e);
  assert.deepEqual(e.jugements, { s1: { l1: "juste" } });
  assert.deepEqual(e.reveles, { s1: ["l1", "l2"] });
  assert.equal(JSON.stringify(e).includes("ABCDE"), false, "le code du tuteur n'entre jamais dans l'état sauvegardé");
  assert.equal(questionsRenseignees(e), 1, "un cache jugé suffit à renseigner la question");
});

// ── Le rapport imprimé

const base: ResultatRapport = {
  moduleId: "m",
  moduleTitre: "Module",
  critereId: "B1-02",
  seuilReussite: 80,
  pointsObtenus: 1.25,
  pointsTotal: 2,
  score: 63,
  echecEliminatoire: false,
  reussi: false,
  verdict: "non_acquis",
  bande: 10,
  bandeBasse: 70,
  bandeHaute: 90,
  concluant: true,
  minQuestions: 2,
  bareme: BAREME_DEFAUT,
  horodatage: "22 septembre 2026 à 10:00",
  horodatageIso: "2026-09-22T08:00:00.000Z",
  tirage: "Découverte · 2 questions",
  jeton: "x",
  mode: "evaluation",
  jugement: { par: "Tutorat · Tuteur test", role: "tuteur", le: "2026-09-22T08:00:00.000Z" },
  detail: [
    {
      questionId: "s1", enonce: "Nommez les éléments cachés.", type: "SCH", situation: null, note: 0.25, discordances: 2, nonJugees: 1,
      correct: false, eliminatoire: false, reservee: false, choixApprenant: [], reponsesAttendues: [], justification: "", sources: [],
      decouverte: true,
      legendes: [
        { numero: 1, reponse: "", attendu: "sas de transfert", verdict: "juste" },
        { numero: 2, reponse: "", attendu: "filtre HEPA", verdict: "fausse" },
        { numero: 3, reponse: "", attendu: "gant", verdict: "vide" },
      ],
    },
    {
      questionId: "o1", enonce: "Ordonnez.", type: "ORD", situation: null, note: 1, discordances: 0, nonJugees: 0,
      correct: true, eliminatoire: false, reservee: false, choixApprenant: ["1. a", "2. b"], reponsesAttendues: ["1. a", "2. b"], justification: "", sources: [],
    },
  ],
};

test("rapport : le schéma à découvrir imprime les jugements et le code qui a jugé", () => {
  const html = construireRapport({ identifiant: "AG-001", nom: "", qualite: "", parcours: "" }, [base], { conservation: "pseudonyme" });
  assert.ok(html.includes("Schéma à découvrir"));
  assert.ok(html.includes("jugé juste") && html.includes("jugé faux") && html.includes("non jugé"));
  assert.ok(html.includes("Sous le cache"), "la colonne dit ce qui était caché, pas une réponse écrite");
  assert.ok(html.includes("Tutorat · Tuteur test"));
  assert.ok(html.includes("1 cache jugé faux, 1 non jugé"));
});

test("rapport : une séquence n'est plus imprimée « QCM multiple »", () => {
  const html = construireRapport({ identifiant: "AG-001", nom: "", qualite: "", parcours: "" }, [base], { conservation: "pseudonyme" });
  assert.ok(html.includes("Séquence"));
  assert.equal(html.includes("QCM multiple"), false);
});

test("rapport : l'auto-évaluation n'est jamais présentée comme un jugement du tuteur", () => {
  const auto: ResultatRapport = { ...base, jugement: { par: "auto-évaluation", role: "apprenant", le: base.horodatageIso } };
  const html = construireRapport({ identifiant: "AG-001", nom: "", qualite: "", parcours: "" }, [auto], { conservation: "pseudonyme" });
  assert.equal(html.includes("jugés par"), false);
});
