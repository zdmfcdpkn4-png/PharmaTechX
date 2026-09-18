import { test } from "node:test";
import assert from "node:assert/strict";
import { normaliserEtatEnCours, questionsRenseignees } from "../content/en-cours";

test("normaliserEtatEnCours : forme contrôlée, champs hors tirage ignorés", () => {
  const e = normaliserEtatEnCours({
    questionIds: ["q1", "q2"],
    mode: "evaluation",
    difficulte: "habilitation",
    libelle: "Habilitation · 2 questions",
    reponses: { q1: ["a"], q9: ["z"], q2: 3 },
    qim: { q2: { a: true, b: "oui" } },
    legendes: { q1: { l1: "sas" } },
    indexCourant: 7,
    corrections: { q1: { note: 1 }, q9: {} },
    maj: "2026-09-18T10:00:00.000Z",
  });
  assert.ok(e);
  assert.deepEqual(e.reponses, { q1: ["a"], q2: [] });
  assert.deepEqual(e.qim, { q2: { a: true } });
  assert.deepEqual(e.legendes, { q1: { l1: "sas" } });
  assert.equal(e.indexCourant, 1, "borné à la dernière question");
  assert.deepEqual(Object.keys(e.corrections), ["q1"]);
  assert.equal(questionsRenseignees(e), 2);
  assert.equal(normaliserEtatEnCours({ questionIds: [], mode: "evaluation", difficulte: "complet" }), null);
  assert.equal(normaliserEtatEnCours({ questionIds: ["q1"], mode: "autre", difficulte: "complet" }), null);
  assert.equal(normaliserEtatEnCours("rien"), null);
});
