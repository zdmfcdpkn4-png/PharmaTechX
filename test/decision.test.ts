import { test } from "node:test";
import assert from "node:assert/strict";
import { decider, verdictFinal, type QuestionNotee } from "../lib/decision";

function tirage(notes: number[], options: { eliminatoireRatee?: boolean } = {}): QuestionNotee[] {
  return notes.map((note, i) => ({
    questionId: `q${i + 1}`,
    note,
    eliminatoire: i === 0,
    correct: note >= 1 && !(i === 0 && options.eliminatoireRatee),
  }));
}

test("bande de garde : seuil 80 sur dix questions donne indéterminé de 70 à 89 %", () => {
  const dix = (n: number) => tirage([...Array(n).fill(1), ...Array(10 - n).fill(0)]);
  assert.equal(decider(dix(9), 80).verdictBrut, "acquis"); // 90 %
  assert.equal(decider(dix(8), 80).verdictBrut, "indetermine"); // 80 %
  assert.equal(decider(dix(7), 80).verdictBrut, "indetermine"); // 70 %
  assert.equal(decider(dix(6), 80).verdictBrut, "non_acquis"); // 60 %
  const d = decider(dix(8), 80);
  assert.equal(d.bande, 10);
  assert.equal(d.bandeBasse, 70);
  assert.equal(d.bandeHaute, 89);
  assert.equal(d.score, 80);
  assert.equal(d.concluant, true);
});

test("bornes entières de la bande avec neuf questions (bande 11,1 points)", () => {
  const neuf = tirage(Array(9).fill(1));
  const d = decider(neuf, 80, { minQuestions: 9 });
  assert.equal(d.bande, 11.1);
  assert.equal(d.bandeBasse, 69);
  assert.equal(d.bandeHaute, 91);
  assert.equal(d.verdictBrut, "acquis");
});

test("éliminatoire manquée : non acquis sans arbitrage possible", () => {
  const notes = [0, ...Array(9).fill(1)];
  const d = decider(tirage(notes, { eliminatoireRatee: true }), 80);
  assert.equal(d.score, 90);
  assert.equal(d.echecEliminatoire, true);
  assert.equal(d.verdictBrut, "non_acquis");
  assert.equal(verdictFinal(d, { verdict: "acquis" }), "non_acquis");
});

test("non concluant sous dix questions, quel que soit le score", () => {
  const d = decider(tirage(Array(5).fill(1)), 80);
  assert.equal(d.score, 100);
  assert.equal(d.concluant, false);
  assert.equal(d.verdictBrut, "non_concluant");
});

test("exclusion d'une question retirée : score recalculé sur les questions restantes", () => {
  const notes = [1, 1, 1, 1, 1, 1, 1, 1, 0, 0]; // 80 % sur 10
  const sans = decider(tirage(notes), 80);
  assert.equal(sans.verdictBrut, "indetermine");
  const avec = decider(tirage(notes), 80, { exclues: ["q9"], minQuestions: 9 });
  assert.equal(avec.nbQuestions, 9);
  assert.equal(avec.nbExclues, 1);
  assert.equal(avec.score, 89); // 8 / 9
  assert.equal(avec.verdictBrut, "indetermine"); // 89 < 91,1
  const exclusionRendNonConcluant = decider(tirage(notes), 80, { exclues: ["q9"] });
  assert.equal(exclusionRendNonConcluant.verdictBrut, "non_concluant");
});

test("l'arbitrage ne s'applique qu'à un verdict indéterminé", () => {
  const acquis = decider(tirage(Array(10).fill(1)), 80);
  assert.equal(verdictFinal(acquis, { verdict: "non_acquis" }), "acquis");
  const indetermine = decider(tirage([1, 1, 1, 1, 1, 1, 1, 1, 0, 0]), 80);
  assert.equal(verdictFinal(indetermine, null), "indetermine");
  assert.equal(verdictFinal(indetermine, { verdict: "non_acquis" }), "non_acquis");
  assert.equal(verdictFinal(indetermine, { verdict: "acquis" }), "acquis");
});
