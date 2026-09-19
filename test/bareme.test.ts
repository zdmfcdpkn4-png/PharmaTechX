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
  assert.equal(noterQuestion(qcm, { choix: ["b"] }).max, 1, "poids de la question");
});

test("QIM, barème des quiz de Flore : juste +, faux −, « je ne sais pas » rien", () => {
  // 5 propositions, 3 attendues : tout juste → 1
  assert.deepEqual(noterQuestion(qim, { choix: ["a", "b", "d"], juges: ["a", "b", "c", "d", "e"] }), {
    note: 1,
    discordances: 0,
    nonJugees: 0,
    max: 1,
  });
  // une proposition laissée sans réponse : 4 justes, ni gain ni perte → 0,8
  assert.deepEqual(noterQuestion(qim, { choix: ["a", "b", "d"], juges: ["a", "b", "c", "d"] }), {
    note: 0.8,
    discordances: 1,
    nonJugees: 1,
    max: 1,
  });
  // rien jugé : cinq « je ne sais pas » → 0, et la question n'est pas juste
  assert.deepEqual(noterQuestion(qim, { choix: [], juges: [] }), { note: 0, discordances: 5, nonJugees: 5, max: 1 });
});

test("QIM en cases à cocher : chaque proposition mal classée retire sa part, plancher 0", () => {
  // d attendue non cochée : 4 justes, 1 fausse → (4 − 1) / 5
  assert.equal(noterQuestion(qim, { choix: ["a", "b"] }).note, 0.6);
  // c et e cochées à tort, d oubliée : 2 justes, 3 fausses → négatif, ramené au plancher
  assert.equal(noterQuestion(qim, { choix: ["a", "b", "c", "e"] }).note, 0);
});

test("Schéma : chaque légende vaut 1/n, fausse retire, vide ne compte pas, plancher 0", () => {
  const toutes = { l1: "Sas de transfert", l2: "filtre terminal", l3: "le gant", l4: "plan-de-travail" };
  assert.deepEqual(noterQuestion(sch, { choix: [], legendes: toutes }), { note: 1, discordances: 0, nonJugees: 0, max: 1 });
  // 3 justes, 1 fausse → 0,75 − 0,25 = 0,5
  assert.equal(noterQuestion(sch, { choix: [], legendes: { ...toutes, l4: "isolateur" } }).note, 0.5);
  // 3 justes, 1 vide → 0,75
  assert.equal(noterQuestion(sch, { choix: [], legendes: { ...toutes, l4: "" } }).note, 0.75);
  // 4 fausses → plancher 0
  const r = noterQuestion(sch, { choix: [], legendes: { l1: "x", l2: "y", l3: "z", l4: "w" } });
  assert.equal(r.note, 0);
  assert.equal(r.discordances, 4);
  // rien → 0, toutes non jugées
  assert.deepEqual(noterQuestion(sch, { choix: [] }), { note: 0, discordances: 4, nonJugees: 4, max: 1 });
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

// ── barème harmonisé (décision du 19/09/2026, question 34) ──────────────────
import { BAREME_DEFAUT, estBaremeDefaut, largeurBande, libelleBaremeCourt, libelleQim, normaliserBareme, noterElements, resumeBareme } from "../content/bareme";
import { libelleBareme } from "../content/types";

test("normaliserBareme : défauts, bornes, cohérence tirage / minimum", () => {
  assert.deepEqual(normaliserBareme(undefined), BAREME_DEFAUT);
  assert.deepEqual(normaliserBareme({ qim: { faux: "-0,5" } }).qim, { ...BAREME_DEFAUT.qim, faux: -0.5 });
  const b = normaliserBareme({
    seuilDefaut: 120,
    minQuestions: 12,
    tirages: { habilitation: 8, decouverte: 0 },
    bande: { mode: "fixe", points: 99 },
    schema: { mode: "tout_ou_rien", juste: 5, faux: -9, min: -3, max: 8 },
  });
  assert.equal(b.seuilDefaut, 100);
  assert.equal(b.minQuestions, 12);
  assert.equal(b.tirages.habilitation, 12, "le tirage d'habilitation ne descend pas sous le minimum");
  assert.equal(b.tirages.decouverte, 1);
  assert.deepEqual(b.bande, { mode: "fixe", points: 50 });
  assert.deepEqual(b.schema, { mode: "tout_ou_rien", juste: 1, faux: -1, sansReponse: 0, min: -1, max: 1 }, "chaque part est ramenée dans ses bornes");
  assert.equal(estBaremeDefaut(BAREME_DEFAUT), true);
  assert.equal(estBaremeDefaut(b), false);
  assert.equal(normaliserBareme({ bande: { mode: "autre" } }).bande.mode, "question");
});

test("normaliserBareme : un barème de l'ancien modèle se relit sans planter", () => {
  const v1 = { version: 1, qim: { unDiscordance: 0.5, deuxDiscordances: 0, auDela: 0 }, schema: { mode: "partiel", videRetire: true }, seuilDefaut: 80 };
  const b = normaliserBareme(v1);
  assert.equal(b.version, 2);
  assert.deepEqual(b.qim, BAREME_DEFAUT.qim, "la règle à la discordance n'a pas d'équivalent : valeurs par défaut");
  assert.equal(b.schema.sansReponse, -1, "« la légende vide retire sa part » se transpose");
  // le rapport d'une évaluation scellée avant la refonte garde sa règle
  assert.match(libelleBaremeCourt(v1), /avant la refonte/);
  assert.match(libelleBaremeCourt(v1), /0,5/);
  assert.match(libelleBaremeCourt(BAREME_DEFAUT), /QIM/);
});

test("noterElements : la même règle pour les trois formats", () => {
  const f = BAREME_DEFAUT.qim;
  assert.equal(noterElements(5, 0, 0, f), 1);
  assert.equal(noterElements(4, 1, 0, f), 0.6);
  assert.equal(noterElements(4, 0, 1, f), 0.8);
  assert.equal(noterElements(0, 5, 0, f), 0, "plancher");
  assert.equal(noterElements(0, 0, 0, f), 0, "aucun élément");
  const toutOuRien = { ...f, mode: "tout_ou_rien" as const };
  assert.equal(noterElements(5, 0, 0, toutOuRien), 1);
  assert.equal(noterElements(4, 0, 1, toutOuRien), 0);
  const demiPoids = { ...f, max: 0.5 };
  assert.equal(noterElements(4, 0, 0, demiPoids), 0.5, "le plafond est le poids de la question");
  const plancherNegatif = { ...f, min: -1 };
  assert.equal(noterElements(0, 5, 0, plancherNegatif), -1, "une question peut retirer des points");
  assert.equal(largeurBande(10), 10);
  assert.equal(largeurBande(10, { mode: "demi_question", points: 0 }), 5);
  assert.equal(largeurBande(10, { mode: "fixe", points: 3 }), 3);
  assert.equal(largeurBande(0), 0);
});

test("noterQuestion applique le barème réglé : QIM sans pénalité, schéma tout ou rien", () => {
  const sansPenalite = normaliserBareme({ qim: { faux: 0 } });
  assert.equal(noterQuestion(qim, { choix: ["a", "b"] }, sansPenalite).note, 0.8, "une erreur ne retire plus rien");
  assert.equal(noterQuestion(qim, { choix: ["a", "b"] }).note, 0.6, "défaut inchangé");
  const b = normaliserBareme({ schema: { mode: "tout_ou_rien" } });
  const quatre = { l1: "sas de transfert", l2: "filtre HEPA", l3: "gant", l4: "plan de travail" };
  assert.equal(noterQuestion(sch, { choix: [], legendes: quatre }, b).note, 1);
  assert.equal(noterQuestion(sch, { choix: [], legendes: { ...quatre, l4: "" } }, b).note, 0, "tout ou rien");
  const videRetire = normaliserBareme({ schema: { sansReponse: -1 } });
  assert.equal(noterQuestion(sch, { choix: [], legendes: { ...quatre, l4: "" } }, videRetire).note, 0.5, "la légende vide retire sa part");
  assert.equal(noterQuestion(sch, { choix: [], legendes: { ...quatre, l4: "" } }).note, 0.75, "par défaut, elle ne compte pas");
});

test("libellés du barème : dynamiques", () => {
  const b = normaliserBareme({ qim: { faux: -0.5 } });
  assert.match(libelleQim(b), /faux -0,5/);
  assert.match(libelleBareme(qim, b), /-0,5/);
  assert.match(libelleBareme(qim), /je ne sais pas/);
  assert.match(libelleBareme(qcm), /tout ou rien/);
  assert.equal(resumeBareme().length, 6);
  assert.match(resumeBareme(normaliserBareme({ bande: { mode: "fixe", points: 5 } }))[4], /5 points de pourcentage/);
});
