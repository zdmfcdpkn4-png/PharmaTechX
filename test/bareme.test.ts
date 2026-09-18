import { test } from "node:test";
import assert from "node:assert/strict";
import { noterQuestion, sanitizeQuestion, type Question } from "../content/types";

const qcm: Question = {
  id: "q1",
  enonce: "Une seule réponse",
  type: "QCM",
  options: [{ id: "a", texte: "A" }, { id: "b", texte: "B" }, { id: "c", texte: "C" }],
  bonnesReponses: ["b"],
  justification: "B.",
};

const qcmMultiple: Question = { ...qcm, id: "q2", enonce: "plusieurs réponses", bonnesReponses: ["a", "c"] };

const qim: Question = {
  id: "q3",
  enonce: "QIM",
  type: "QIM",
  options: ["a", "b", "c", "d", "e"].map((id) => ({ id, texte: id.toUpperCase() })),
  bonnesReponses: ["a", "b", "d"],
  justification: "A, B, D.",
};

const sch: Question = {
  id: "q4",
  enonce: "Schéma",
  type: "SCH",
  options: [],
  bonnesReponses: [],
  justification: "",
  modeReponse: "ecrire",
  image: { id: "im", url: "/api/images/im", largeur: 800, hauteur: 600, alt: "coupe" },
  legendes: [
    { id: "l1", attendu: "sas de transfert", repere: { x: 10, y: 10 } },
    { id: "l2", attendu: "filtre HEPA | filtre terminal", repere: { x: 50, y: 10 } },
    { id: "l3", attendu: "gant", repere: { x: 10, y: 60 } },
    { id: "l4", attendu: "plan de travail", repere: { x: 50, y: 60 } },
  ],
};

test("QCM : tout ou rien", () => {
  assert.equal(noterQuestion(qcm, { choix: ["b"] }).note, 1);
  assert.equal(noterQuestion(qcm, { choix: ["a"] }).note, 0);
  assert.equal(noterQuestion(qcmMultiple, { choix: ["a", "c"] }).note, 1);
  assert.equal(noterQuestion(qcmMultiple, { choix: ["a"] }).note, 0);
  assert.equal(noterQuestion(qcmMultiple, { choix: ["a", "b", "c"] }).note, 0);
});

test("QIM en Vrai/Faux : tout juste → 1 ; une non jugée → 0,5 ; rien jugé → 0", () => {
  assert.deepEqual(noterQuestion(qim, { choix: ["a", "b", "d"], juges: ["a", "b", "c", "d", "e"] }), {
    note: 1,
    discordances: 0,
    nonJugees: 0,
  });
  assert.deepEqual(noterQuestion(qim, { choix: ["a", "b", "d"], juges: ["a", "b", "c", "d"] }), {
    note: 0.5,
    discordances: 1,
    nonJugees: 1,
  });
  assert.deepEqual(noterQuestion(qim, { choix: [], juges: [] }), { note: 0, discordances: 5, nonJugees: 5 });
});

test("QIM en cases à cocher : une discordance → 0,5, deux → 0", () => {
  assert.equal(noterQuestion(qim, { choix: ["a", "b"] }).note, 0.5);
  assert.equal(noterQuestion(qim, { choix: ["a", "b", "c", "e"] }).note, 0);
});

test("Schéma : chaque légende vaut 1/n, fausse retire, vide ne compte pas, plancher 0", () => {
  const toutes = { l1: "Sas de transfert", l2: "filtre terminal", l3: "le gant", l4: "plan-de-travail" };
  assert.deepEqual(noterQuestion(sch, { choix: [], legendes: toutes }), { note: 1, discordances: 0, nonJugees: 0 });
  // 3 justes, 1 fausse → 0,75 − 0,25 = 0,5
  assert.equal(noterQuestion(sch, { choix: [], legendes: { ...toutes, l4: "isolateur" } }).note, 0.5);
  // 3 justes, 1 vide → 0,75
  assert.equal(noterQuestion(sch, { choix: [], legendes: { ...toutes, l4: "" } }).note, 0.75);
  // 4 fausses → plancher 0
  const r = noterQuestion(sch, { choix: [], legendes: { l1: "x", l2: "y", l3: "z", l4: "w" } });
  assert.equal(r.note, 0);
  assert.equal(r.discordances, 4);
  // rien → 0, toutes non jugées
  assert.deepEqual(noterQuestion(sch, { choix: [] }), { note: 0, discordances: 4, nonJugees: 4 });
});

test("sanitizeQuestion retire réponses, justification et mots des légendes", () => {
  const p = sanitizeQuestion(sch);
  assert.equal("bonnesReponses" in p, false);
  assert.equal("justification" in p, false);
  assert.deepEqual(p.legendes?.map((l) => Object.keys(l).sort()), [["id", "repere"], ["id", "repere"], ["id", "repere"], ["id", "repere"]]);
  assert.equal(p.etiquettes, undefined);
  const c = sanitizeQuestion({ ...sch, modeReponse: "choisir" });
  assert.deepEqual([...(c.etiquettes ?? [])].sort(), ["filtre HEPA", "gant", "plan de travail", "sas de transfert"]);
  const q = sanitizeQuestion(qim, { id: "s", titre: "t", contexte: "c" });
  assert.equal(q.situation?.id, "s");
  assert.equal((q as unknown as { bonnesReponses?: unknown }).bonnesReponses, undefined);
});
