import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SEUILS_STAT,
  analyserElements,
  analyserQuestions,
  analyserSources,
  avantApres,
  bilanModule,
  bilansModules,
  classerModules,
  correlation,
  evolutionTrimestrielle,
  jourParis,
  libelleTrimestre,
  mediane,
  parNiveauCible,
  pointsManques,
  premierEssaiGlobal,
  questionARevoir,
  reperes,
  seuilAtteint,
  taux,
  tauxAgents,
  trimestre,
  wilson,
  type ItemTentative,
  type Tentative,
} from "../lib/statistiques";

/** Statistiques de réussite (question 78, choix a, 25/09/2026). */

let compteur = 0;
const essai = (agent: number, le: string, score: number, extra: Partial<Tentative> = {}): Tentative => ({
  cle: `t${String(++compteur).padStart(4, "0")}`,
  agent,
  moduleId: "m1",
  moduleTitre: "Module un",
  le,
  score,
  seuil: 70,
  echecEliminatoire: false,
  niveauCible: null,
  ...extra,
});

test("Wilson : intervalle à 95 % honnête sur de petits effectifs, jamais hors de [0, 100]", () => {
  assert.deepEqual(wilson(3, 6), { bas: 19, haut: 81 });
  assert.deepEqual(wilson(0, 5), { bas: 0, haut: 43 });
  assert.deepEqual(wilson(5, 5), { bas: 57, haut: 100 });
  assert.deepEqual(wilson(2, 5), { bas: 12, haut: 77 });
  assert.deepEqual(wilson(0, 0), { bas: 0, haut: 100 });
});

test("taux : rien sous l'effectif minimal, sinon le pourcentage et son intervalle", () => {
  assert.equal(SEUILS_STAT.effectif, 5);
  assert.deepEqual(taux(2, 4), { n: 4, k: 2, taux: null, bas: null, haut: null });
  assert.deepEqual(taux(2, 5), { n: 5, k: 2, taux: 40, bas: 12, haut: 77 });
  assert.equal(taux(0, 0).taux, null);
});

test("médiane, seuil atteint", () => {
  assert.equal(mediane([]), null);
  assert.equal(mediane([40, 90, 50]), 50);
  assert.equal(mediane([30, 40, 50, 75, 90, 95]), 63);
  assert.equal(seuilAtteint({ score: 70, seuil: 70, echecEliminatoire: false }), true);
  assert.equal(seuilAtteint({ score: 69, seuil: 70, echecEliminatoire: false }), false);
  assert.equal(seuilAtteint({ score: 95, seuil: 70, echecEliminatoire: true }), false, "une éliminatoire manquée fait échouer");
});

// Six agents, seuil 70 : A échoue puis réussit ; B réussit ; C échoue deux fois
// puis réussit ; D réussit ; E échoue ; F réussit.
const module1 = [
  essai(1, "2026-01-10T09:00:00.000Z", 50),
  essai(1, "2026-04-02T09:00:00.000Z", 80),
  essai(2, "2026-01-12T09:00:00.000Z", 90),
  essai(3, "2026-01-15T09:00:00.000Z", 40),
  essai(3, "2026-02-15T09:00:00.000Z", 60),
  essai(3, "2026-05-15T09:00:00.000Z", 85),
  essai(4, "2026-02-01T09:00:00.000Z", 75),
  essai(5, "2026-02-03T09:00:00.000Z", 30),
  essai(6, "2026-02-05T09:00:00.000Z", 95),
];

test("bilan d'un module : premier essai, réussite finale par agent, essais pour réussir, score médian", () => {
  const b = bilanModule("m1", "Module un", module1);
  assert.equal(b.agents, 6);
  assert.equal(b.essais, 9);
  assert.deepEqual(b.premierEssai, { n: 6, k: 3, taux: 50, bas: 19, haut: 81 });
  assert.equal(b.final.k, 5, "cinq agents ont atteint le seuil à un essai au moins");
  assert.equal(b.final.taux, 83);
  assert.equal(b.essaisPourReussir, 1.6, "A : 2, B : 1, C : 3, D : 1, F : 1");
  assert.equal(b.scoreMedianPremier, 63);
  assert.equal(b.aRevoir, true, "50 % au premier essai, sous le repère de 60 %");
  assert.equal(b.dernierEssai, "2026-05-15T09:00:00.000Z");
});

test("bilan sur une période : les essais antérieurs disent seulement qui n'en est pas à son premier", () => {
  const b = bilanModule("m1", "Module un", module1, "2026-03-01T00:00:00.000Z");
  assert.equal(b.agents, 2, "A et C ont repassé le module dans la période");
  assert.equal(b.premierEssai.n, 0, "aucun premier essai dans la période");
  assert.equal(b.premierEssai.taux, null);
  assert.equal(b.final.n, 2);
  assert.equal(b.final.taux, null, "deux agents : aucun taux");
  assert.equal(b.aRevoir, false, "pas de taux, pas de jugement");
});

test("un agent qui repasse dix fois ne pèse pas dix fois dans la réussite finale", () => {
  const l = [
    ...Array.from({ length: 10 }, (_, i) => essai(1, `2026-01-${String(i + 10).padStart(2, "0")}T09:00:00.000Z`, 20)),
    ...[2, 3, 4, 5].map((a) => essai(a, "2026-01-05T09:00:00.000Z", 90)),
  ];
  const b = bilanModule("m1", "Module un", l);
  assert.equal(b.final.n, 5);
  assert.equal(b.final.k, 4);
  assert.equal(b.essais, 14);
});

test("classement : le plus faible d'abord, ou le plus fort ; sans taux, à la fin", () => {
  const autre = (id: string, scores: number[]) =>
    scores.map((s, i) => essai(100 + i, "2026-03-01T09:00:00.000Z", s, { moduleId: id, moduleTitre: id }));
  const bilans = bilansModules([
    ...module1,
    ...autre("m2", [90, 90, 90, 90, 90]),
    ...autre("m3", [90, 20]),
    ...autre("m4", [20, 20, 20, 20, 90]),
  ]);
  assert.deepEqual(classerModules(bilans, "faible").map((b) => b.moduleId), ["m4", "m1", "m2", "m3"]);
  assert.deepEqual(classerModules(bilans, "fort").map((b) => b.moduleId), ["m2", "m1", "m4", "m3"]);
});

test("un module renommé se lit sous son dernier titre", () => {
  const l = [essai(1, "2026-01-01T00:00:00.000Z", 50, { moduleTitre: "Ancien" }), essai(2, "2026-06-01T00:00:00.000Z", 50, { moduleTitre: "Nouveau" })];
  assert.equal(bilansModules(l)[0].titre, "Nouveau");
});

test("évolution par trimestre, sans trou ; niveau cible", () => {
  assert.equal(trimestre("2026-09-25T10:00:00.000Z"), "2026-T3");
  // Au jour de Paris : 23 h 30 en temps universel le 30 septembre, c'est déjà le 1er octobre.
  assert.equal(jourParis("2026-09-30T23:30:00.000Z"), "2026-10-01");
  assert.equal(trimestre("2026-09-30T23:30:00.000Z"), "2026-T4");
  assert.equal(jourParis("2026-12-31T22:59:00.000Z"), "2026-12-31", "heure d'hiver : UTC + 1");
  assert.equal(libelleTrimestre("2026-T1"), "1er trim. 2026");
  assert.equal(libelleTrimestre("2026-T3"), "3e trim. 2026");
  const l = [
    ...[1, 2, 3, 4, 5].map((a) => essai(a, "2025-11-02T09:00:00.000Z", a <= 2 ? 40 : 80)),
    essai(6, "2026-05-02T09:00:00.000Z", 80, { niveauCible: "N2" }),
  ];
  const ev = evolutionTrimestrielle(l);
  assert.deepEqual(ev.map((p) => p.cle), ["2025-T4", "2026-T1", "2026-T2"], "le 1er trimestre 2026, vide, figure");
  assert.equal(ev[0].premierEssai.taux, 60);
  assert.equal(ev[1].premierEssai.n, 0);
  assert.equal(ev[2].premierEssai.taux, null, "un seul premier essai : aucun taux");
  const niv = parNiveauCible(l);
  assert.deepEqual(niv.map((g) => [g.niveau, g.premierEssai.n]), [["N2", 1], [null, 5]]);
});

const item = (questionId: string, correct: boolean, extra: Partial<ItemTentative> = {}): ItemTentative => ({
  questionId,
  enonce: `Énoncé ${questionId}`,
  type: "QCM",
  correct,
  note: correct ? 1 : 0,
  max: 1,
  nonJugees: 0,
  choix: [],
  attendus: [],
  sources: [],
  ...extra,
});

test("corrélation : nulle quand une série est constante", () => {
  assert.equal(correlation([1, 1, 1], [1, 2, 3]), null);
  assert.equal(correlation([0, 1], [0, 1]), 1);
  assert.ok(Math.abs((correlation([0, 0, 1, 1], [1, 2, 3, 4]) ?? 0) - 0.894) < 0.001);
});

test("questions : réussite, discrimination corrigée, repères", () => {
  // Six essais. q1 réussie par les meilleurs (discrimine bien) ; q2 réussie par
  // les plus faibles (à rebours) ; q3 par tous (très facile) ; q4 par personne.
  const profil = [
    [true, false, true, false, true, true],
    [true, false, true, false, true, true],
    [true, false, true, false, true, true],
    [false, true, true, false, false, false],
    [false, true, true, false, false, false],
    [false, true, true, false, false, false],
  ];
  const l = profil.map((r, i) =>
    essai(i + 1, `2026-03-0${i + 1}T09:00:00.000Z`, 50, {
      items: [
        item("q1", r[0]),
        item("q2", r[1]),
        item("q3", r[2]),
        item("q4", r[3], { type: "QIM", nonJugees: i < 3 ? 1 : 0 }),
        item("q5", r[4]),
        item("q6", r[5]),
      ],
    }),
  );
  const a = analyserQuestions(l);
  const q = (id: string) => a.find((x) => x.questionId === id)!;
  assert.equal(q("q1").reussite.taux, 50);
  assert.ok((q("q1").discrimination ?? 0) > 0.8, `q1 discrimine : ${q("q1").discrimination}`);
  assert.ok((q("q2").discrimination ?? 0) < -0.8, `q2 à rebours : ${q("q2").discrimination}`);
  assert.deepEqual(q("q2").reperes, ["discrimine-a-rebours"]);
  assert.equal(q("q3").reussite.taux, 100);
  assert.equal(q("q3").discrimination, null, "réussie par tous : aucune corrélation");
  assert.deepEqual(q("q3").reperes, ["tres-facile"]);
  assert.equal(q("q4").reussite.taux, 0);
  assert.deepEqual(q("q4").reperes, ["tres-difficile"]);
  assert.equal(q("q4").sansReponse.taux, 50, "trois essais sur six avec un « je ne sais pas »");
  assert.deepEqual(a.map((x) => x.questionId).slice(0, 1), ["q4"], "la moins réussie d'abord");
});

test("un agent qui repasse six fois ne fait pas un taux : ce serait le sien", () => {
  assert.equal(tauxAgents(0, 6, 1).taux, null);
  assert.equal(tauxAgents(3, 6, 5).taux, 50);
  const l = [1, 2, 3, 4, 5, 6].map((i) =>
    essai(1, `2026-03-0${i}T09:00:00.000Z`, 0, {
      items: [item("q", false, { sources: ["Support — section 1"], choix: ["Piège"], attendus: ["Bonne"], propositions: ["Bonne", "Piège"] })],
    }),
  );
  const q = analyserQuestions(l)[0];
  assert.equal(q.n, 6);
  assert.equal(q.reussite.taux, null);
  assert.equal(q.discrimination, null);
  assert.ok(analyserElements(l).every((e) => e.tauxErreur.taux === null), "aucune réponse chiffrée");
  assert.equal(analyserSources(l)[0].reussite.taux, null, "aucune source chiffrée");
});

test("repères : très facile n'est pas un défaut ; le reste est à revoir", () => {
  assert.deepEqual(reperes(taux(9, 10), 0.35), ["tres-facile"]);
  assert.deepEqual(reperes(taux(2, 10), 0.1), ["tres-difficile", "discrimine-peu"]);
  assert.deepEqual(reperes(taux(2, 4), null), [], "sous l'effectif : aucun repère");
  assert.equal(questionARevoir(["tres-facile"]), false);
  assert.equal(questionARevoir(["discrimine-peu"]), true);
});

test("éléments : QCM — mauvaise réponse choisie, distracteur que personne ne choisit", () => {
  const propositions = ["Bonne", "Piège", "Inutile"];
  const l = [0, 1, 2, 3, 4, 5].map((i) =>
    essai(i + 1, `2026-03-0${i + 1}T09:00:00.000Z`, 50, {
      items: [item("qcm", i >= 3, { choix: [i < 3 ? "Piège" : "Bonne"], attendus: ["Bonne"], propositions })],
    }),
  );
  const e = analyserElements(l);
  const el = (x: string) => e.find((y) => y.element === x)!;
  assert.equal(el("Piège").nature, "distracteur");
  assert.equal(el("Piège").tauxErreur.taux, 50, "choisie par la moitié : une idée fausse répandue");
  assert.equal(el("Bonne").erreurs, 3, "la bonne réponse oubliée trois fois");
  assert.equal(el("Inutile").nonFonctionnel, true, "jamais choisie : elle ne piège personne");
  assert.equal(el("Piège").nonFonctionnel, false);
  assert.ok(pointsManques(e).some((x) => x.element === "Piège"));
  assert.ok(!pointsManques(e).some((x) => x.element === "Inutile"));
});

test("éléments : QIM — vraie jugée fausse, fausse jugée vraie, « je ne sais pas », essais anciens non départagés", () => {
  const propositions = ["Vraie A", "Fausse B"];
  const base = { type: "QIM", attendus: ["Vraie A"], propositions };
  const l = [
    essai(1, "2026-03-01T09:00:00.000Z", 50, { items: [item("qim", false, { ...base, choix: ["Vraie A", "Fausse B"] })] }),
    essai(2, "2026-03-02T09:00:00.000Z", 50, { items: [item("qim", false, { ...base, choix: [] })] }),
    essai(3, "2026-03-03T09:00:00.000Z", 50, {
      items: [item("qim", false, { ...base, choix: [], nonJugees: 1, sansJugement: ["Vraie A"] })],
    }),
    // Essai ancien : une proposition sans jugement, sans dire laquelle.
    essai(4, "2026-03-04T09:00:00.000Z", 50, {
      items: [item("qim", false, { type: "QIM", attendus: ["Vraie A"], choix: [], nonJugees: 1 })],
    }),
    essai(5, "2026-03-05T09:00:00.000Z", 50, { items: [item("qim", true, { ...base, choix: ["Vraie A"] })] }),
  ];
  const e = analyserElements(l, null, new Map([["qim", propositions]]));
  const el = (x: string) => e.find((y) => y.element === x)!;
  assert.equal(el("Vraie A").nature, "proposition-vraie");
  assert.equal(el("Vraie A").erreurs, 1, "jugée fausse par l'agent 2");
  assert.equal(el("Vraie A").sansReponse, 1, "« je ne sais pas » de l'agent 3");
  assert.equal(el("Vraie A").nonDepartage, 1, "essai ancien : fausse ou sans réponse, on ne sait pas");
  assert.equal(el("Fausse B").nature, "proposition-fausse");
  assert.equal(el("Fausse B").erreurs, 1, "jugée vraie par l'agent 1");
  assert.equal(el("Fausse B").n, 5, "la liste actuelle de la banque sert aux essais anciens");
});

test("éléments : légendes, étapes et trous", () => {
  const l = [1, 2, 3, 4, 5].map((a) =>
    essai(a, `2026-03-0${a}T09:00:00.000Z`, 50, {
      items: [
        item("sch", false, {
          type: "SCH",
          legendes: [
            { numero: 1, attendu: "Sas", verdict: a <= 2 ? "fausse" : "juste" },
            { numero: 2, attendu: "Isolateur", verdict: a === 5 ? "vide" : "juste" },
          ],
        }),
        item("ord", false, {
          type: "ORD",
          attendus: ["1. Friction", "2. Gants"],
          choix: a <= 3 ? ["1. Gants", "2. Friction"] : ["1. Friction", "— Gants"],
        }),
        item("tat", false, {
          type: "TAT",
          attendus: ["1 → classe A", "2 → 0,5 µm"],
          choix: a <= 4 ? ["1 → classe B", "2 → 0,5 µm"] : ["1 → classe A", "2 → —"],
        }),
      ],
    }),
  );
  const e = analyserElements(l);
  const el = (x: string) => e.find((y) => y.element === x)!;
  assert.equal(el("1. Sas").erreurs, 2);
  assert.equal(el("2. Isolateur").sansReponse, 1);
  assert.equal(el("1. Friction").erreurs, 3, "placée deuxième trois fois");
  assert.equal(el("2. Gants").erreurs, 3);
  assert.equal(el("2. Gants").sansReponse, 2, "sans rang deux fois");
  assert.equal(el("Trou 1 : classe A").erreurs, 4);
  assert.equal(el("Trou 1 : classe A").tauxErreur.taux, 80);
  assert.equal(el("Trou 2 : 0,5 µm").sansReponse, 1);
});

test("sources : la section du support la moins réussie d'abord", () => {
  const l = [1, 2, 3, 4, 5].map((a) =>
    essai(a, `2026-03-0${a}T09:00:00.000Z`, 50, {
      items: [
        item("q1", a > 4, { sources: ["Support — section 2"] }),
        item("q2", true, { sources: ["Support — section 1"] }),
        item("q3", a > 1, { sources: ["Support — section 2"] }),
      ],
    }),
  );
  const s = analyserSources(l);
  assert.deepEqual(s.map((x) => [x.source, x.questions, x.reussite.taux]), [
    ["Support — section 2", 2, 50],
    ["Support — section 1", 1, 100],
  ]);
});

test("avant / après une action : chaque période bornée par les actions voisines, premiers essais seulement", () => {
  const l = [
    ...[1, 2, 3, 4, 5].map((a) => essai(a, "2026-01-10T09:00:00.000Z", a <= 4 ? 40 : 90)),
    ...[6, 7, 8, 9, 10].map((a) => essai(a, "2026-03-10T09:00:00.000Z", a <= 6 ? 40 : 90)),
    // Un agent de la première période repasse après l'action : ce n'est pas un premier essai.
    essai(1, "2026-03-11T09:00:00.000Z", 95),
    ...[11, 12].map((a) => essai(a, "2026-06-10T09:00:00.000Z", 90)),
  ];
  const actions = [
    { id: 1, moduleId: "m1", le: "2026-02-01", description: "Section 2 réécrite", auteur: "admin" },
    { id: 2, moduleId: "m1", le: "2026-05-01", description: "Question reformulée", auteur: "tuteur" },
  ];
  const r = avantApres(l, actions);
  assert.deepEqual([r[0].avant.taux, r[0].apres.taux], [20, 80]);
  assert.equal(r[0].apres.n, 5, "la reprise de l'agent 1 n'est pas comptée");
  assert.equal(r[1].avant.taux, 80);
  assert.equal(r[1].apres.taux, null, "deux premiers essais seulement après la seconde action");
});

test("réussite globale au premier essai : cinq agents distincts, pas cinq modules d'un seul", () => {
  const seul = ["m1", "m2", "m3", "m4", "m5"].map((m) => essai(1, "2026-03-01T09:00:00.000Z", 90, { moduleId: m }));
  assert.equal(premierEssaiGlobal(seul).n, 5);
  assert.equal(premierEssaiGlobal(seul).taux, null, "un seul agent : aucun taux");
  const cinq = [1, 2, 3, 4, 5].map((a) => essai(a, "2026-03-01T09:00:00.000Z", a <= 2 ? 40 : 90));
  assert.equal(premierEssaiGlobal(cinq).taux, 60);
  // Période : seul le premier essai de toujours compte, s'il y tombe.
  const reprise = [...cinq, essai(1, "2026-04-01T09:00:00.000Z", 90)];
  assert.equal(premierEssaiGlobal(reprise, "2026-03-15T00:00:00.000Z").n, 0);
});

test("avant / après : un essai se range au jour de Paris, comme l'action", () => {
  // 0 h 30 à Paris le 1er février : encore le 31 janvier en temps universel.
  const l = [1, 2, 3, 4, 5].map((a) => essai(a, "2026-01-31T23:30:00.000Z", 90));
  const r = avantApres(l, [{ id: 1, moduleId: "m1", le: "2026-02-01", description: "Section réécrite", auteur: "admin" }]);
  assert.equal(r[0].avant.n, 0);
  assert.equal(r[0].apres.n, 5);
});
