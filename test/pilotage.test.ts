import { test } from "node:test";
import assert from "node:assert/strict";
import {
  arcs,
  attenteDe,
  classerCriteres,
  libelleMois,
  moisContinus,
  part,
  pointsCourbe,
  questionsDifficiles,
  libelleAnciennete,
  quizAnciens,
  segments,
  tranchesScores,
  type AncienneteQuiz,
  type BilanCritere,
} from "../lib/pilotage";

test("part : jamais de division par zéro", () => {
  assert.equal(part(3, 4), 75);
  assert.equal(part(0, 0), 0);
  assert.equal(part(1, 3), 33);
  assert.equal(part(2, 3), 67);
});

test("attenteDe : l'arbitrage passe avant le visa du tuteur", () => {
  assert.equal(attenteDe("emis", "indetermine", false), "arbitrage");
  assert.equal(attenteDe("emis", "indetermine", true), "visa-tuteur", "arbitré : le visa suit");
  assert.equal(attenteDe("emis", "acquis", false), "visa-tuteur");
  assert.equal(attenteDe("emis", "non_acquis", false), "visa-tuteur");
  assert.equal(attenteDe("vise_tuteur", "acquis", false), "visa-pharmacien");
  assert.equal(attenteDe("clos", "acquis", true), null);
  assert.equal(attenteDe("annule", "indetermine", false), null);
});

test("questionsDifficiles : trop peu posées, on ne conclut pas", () => {
  const l = [
    { question_id: "q1", posees: 4, reussies: 0 }, // sous le seuil de lecture
    { question_id: "q2", posees: 10, reussies: 2 }, // 20 %
    { question_id: "q3", posees: 10, reussies: 9 }, // 90 % : pas un problème
    { question_id: "q4", posees: 20, reussies: 12 }, // 60 % : retenu (borne incluse)
    { question_id: "q5", posees: 5, reussies: 1 }, // 20 %, moins posée que q2
  ];
  const d = questionsDifficiles(l);
  assert.deepEqual(d.map((q) => q.question_id), ["q2", "q5", "q4"], "taux croissant, puis volume décroissant");
  assert.deepEqual(d.map((q) => q.taux), [20, 20, 60]);
});

test("questionsDifficiles : le maximum affiché est respecté", () => {
  const l = Array.from({ length: 30 }, (_, i) => ({ question_id: `q${i}`, posees: 10, reussies: 1 }));
  assert.equal(questionsDifficiles(l).length, 12);
  assert.equal(questionsDifficiles(l, { minPosees: 5, tauxMax: 60, maximum: 3 }).length, 3);
});

const critere = (cle: string, n: number, acquis: number): BilanCritere => ({
  cle, libelle: cle, critere_id: null, n, acquis,
  non_acquis: n - acquis, indetermine: 0, non_concluant: 0, score_moyen: null,
});

test("classerCriteres : le plus bas taux d'abord, les non évalués à part", () => {
  const { couverts, vides } = classerCriteres([
    critere("a", 10, 9),
    critere("b", 10, 3),
    critere("c", 0, 0),
    critere("d", 4, 1), // 25 %, moins de volume que b (30 %) mais taux plus bas
  ]);
  assert.deepEqual(couverts.map((c) => c.cle), ["d", "b", "a"]);
  assert.deepEqual(couverts.map((c) => c.taux), [25, 30, 90]);
  assert.deepEqual(vides.map((c) => c.cle), ["c"], "un critère sans rapport n'est pas un mauvais critère");
});

test("moisContinus : un mois sans rapport existe et vaut zéro", () => {
  const s = moisContinus([
    { mois: "2026-03", n: 2, acquis: 1, score_moyen: 70 },
    { mois: "2026-06", n: 1, acquis: 1, score_moyen: 90 },
  ]);
  assert.deepEqual(s.map((p) => p.mois), ["2026-03", "2026-04", "2026-05", "2026-06"]);
  assert.deepEqual(s.map((p) => p.n), [2, 0, 0, 1]);
  assert.equal(s[1].score_moyen, null, "pas de score inventé pour un mois vide");
});

test("moisContinus : passage d'année et série vide", () => {
  const s = moisContinus([
    { mois: "2025-11", n: 1, acquis: 0, score_moyen: 50 },
    { mois: "2026-02", n: 1, acquis: 1, score_moyen: 80 },
  ]);
  assert.deepEqual(s.map((p) => p.mois), ["2025-11", "2025-12", "2026-01", "2026-02"]);
  assert.deepEqual(moisContinus([]), []);
});

test("libelleMois", () => {
  assert.equal(libelleMois("2026-09"), "sept. 26");
  assert.equal(libelleMois("2026-01"), "janv. 26");
});

test("tranchesScores : dix tranches, les creux conservés", () => {
  const t = tranchesScores([0, 55, 59, 100, 100]);
  assert.equal(t.length, 10);
  assert.equal(t[0].n, 1, "0 %");
  assert.equal(t[5].n, 2, "50 à 59 %");
  assert.equal(t[9].n, 2, "100 % compté dans la dernière tranche");
  assert.equal(t[9].a, 100, "la dernière tranche monte jusqu'à 100 inclus");
  assert.equal(t[3].n, 0, "une tranche vide reste dans la série");
  assert.equal(tranchesScores([]).reduce((s, x) => s + x.n, 0), 0);
});

test("pointsCourbe : une valeur absente coupe la ligne", () => {
  const p = pointsCourbe([100, null, 0], 100, 50, 100, 0);
  assert.deepEqual(p[0], { x: 0, y: 0 });
  assert.equal(p[1], null);
  assert.deepEqual(p[2], { x: 100, y: 50 });
});

test("segments : les morceaux continus, pas de trait par-dessus le trou", () => {
  const p = pointsCourbe([50, null, 50, 50], 300, 100, 100, 0);
  const s = segments(p);
  assert.equal(s.length, 2);
  assert.equal(s[0].length, 1);
  assert.equal(s[1].length, 2);
  assert.deepEqual(segments([null, null]), []);
});

test("arcs : les longueurs couvrent la circonférence, sans trou ni chevauchement", () => {
  const a = arcs([1, 1, 2], 100);
  assert.deepEqual(a.map((x) => Math.round(x.longueur)), [25, 25, 50]);
  assert.deepEqual(a.map((x) => Math.round(x.debut)), [0, 25, 50]);
  assert.deepEqual(arcs([0, 0], 100), [{ longueur: 0, debut: 0 }, { longueur: 0, debut: 0 }]);
});

// ── Ancienneté des quiz (question 49, choix b) : un fait, pas une échéance

const ANCIENNETES: AncienneteQuiz[] = [
  { agent_identifiant: "AG-001", module_id: "m1", module_titre: "Un", critere_id: "B1-01", dernier_le: "2024-01-10T09:00:00Z", mois: 32 },
  { agent_identifiant: "AG-002", module_id: "m1", module_titre: "Un", critere_id: "B1-01", dernier_le: "2024-09-22T09:00:00Z", mois: 24 },
  { agent_identifiant: "AG-003", module_id: "m2", module_titre: "Deux", critere_id: null, dernier_le: "2026-06-01T09:00:00Z", mois: 3 },
];

test("le seuil est inclusif : vingt-quatre mois pile, c'est dépassé", () => {
  const anciens = quizAnciens(ANCIENNETES, 24).map((l) => l.agent_identifiant);
  assert.deepEqual(anciens, ["AG-001", "AG-002"]);
});

test("aucun quiz ancien si le seuil est plus haut que la plus vieille ligne", () => {
  assert.deepEqual(quizAnciens(ANCIENNETES, 36), []);
});

test("l'ancienneté se dit en mois, jamais en date d'échéance", () => {
  assert.equal(libelleAnciennete(0), "ce mois-ci");
  assert.equal(libelleAnciennete(1), "il y a 1 mois");
  assert.equal(libelleAnciennete(32), "il y a 32 mois");
  for (const m of [0, 1, 24, 32]) {
    assert.equal(/\d{2}\/\d{2}\/\d{4}/.test(libelleAnciennete(m)), false, "aucune date prononcée");
  }
});
