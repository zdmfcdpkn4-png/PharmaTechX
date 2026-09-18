import { test } from "node:test";
import assert from "node:assert/strict";
import { melanger, reserveesAdmises, tirageConforme, tirer } from "../content/tirage";

const q = (id: string, extra: { eliminatoire?: boolean; reservee?: boolean; situation?: { id: string } | null } = {}) => ({
  id,
  situation: null,
  ...extra,
});
const banque = [
  q("e1", { eliminatoire: true }),
  q("r1", { reservee: true }),
  q("r2", { reservee: true }),
  q("a"),
  q("b"),
  q("c"),
  q("s1", { situation: { id: "s" } }),
  q("s2", { situation: { id: "s" } }),
];
const fixe = () => 0.5;

test("réservées admises : évaluation en Habilitation ou Complet seulement", () => {
  assert.equal(reserveesAdmises("evaluation", "habilitation"), true);
  assert.equal(reserveesAdmises("evaluation", "complet"), true);
  assert.equal(reserveesAdmises("evaluation", "decouverte"), false);
  assert.equal(reserveesAdmises("entrainement", "complet"), false);
});

test("tirage d'évaluation : toutes les éliminatoires, puis les réservées en priorité, jusqu'au nombre demandé", () => {
  const ids = tirer(banque, 4, true, fixe).map((x) => x.id);
  assert.equal(ids.length, 4);
  assert.ok(ids.includes("e1"));
  assert.ok(ids.includes("r1") && ids.includes("r2"));
});

test("entraînement et Découverte : aucune réservée, même en tirage complet", () => {
  assert.deepEqual(tirer(banque, null, false, fixe).map((x) => x.id), ["e1", "a", "b", "c", "s1", "s2"]);
  assert.ok(tirer(banque, 3, false, fixe).every((x) => !x.reservee));
});

test("tirage complet en évaluation : toute la banque, ordre conservé", () => {
  assert.deepEqual(tirer(banque, null, true, fixe).map((x) => x.id), banque.map((x) => x.id));
});

test("mises en situation rendues par vignette, après les questions isolées", () => {
  const t = tirer(banque, 7, true, fixe);
  const premiereSituation = t.findIndex((x) => x.situation);
  const derniereIsolee = t.map((x) => !x.situation).lastIndexOf(true);
  if (premiereSituation >= 0) assert.ok(derniereIsolee < premiereSituation);
});

test("conformité : refus des réservées en entraînement et en Découverte", () => {
  assert.equal(tirageConforme([q("r1", { reservee: true })], banque, "entrainement", "complet").ok, false);
  assert.equal(tirageConforme([q("r1", { reservee: true })], banque, "evaluation", "decouverte").ok, false);
  assert.equal(tirageConforme([q("a")], banque, "entrainement", "complet").ok, true);
});

test("conformité : en Habilitation, autant de réservées que le tirage prioritaire en aurait pris", () => {
  assert.equal(tirageConforme(tirer(banque, 4, true, fixe), banque, "evaluation", "habilitation").ok, true);
  const sans = [q("e1", { eliminatoire: true }), q("a"), q("b"), q("c")];
  const c = tirageConforme(sans, banque, "evaluation", "habilitation");
  assert.equal(c.ok, false);
  if (!c.ok) assert.match(c.raison, /2 questions réservées/);
  assert.equal(tirageConforme(sans, sans, "evaluation", "habilitation").ok, true, "banque sans réservée : rien d'attendu");
  assert.equal(tirageConforme(banque, banque, "evaluation", "complet").ok, true);
  const eliminatoireReservee = [q("e1", { eliminatoire: true, reservee: true }), q("a")];
  assert.equal(tirageConforme(eliminatoireReservee, eliminatoireReservee, "evaluation", "habilitation").ok, true);
});

test("mélange déterministe : permutation des mêmes éléments", () => {
  assert.deepEqual([...melanger([1, 2, 3, 4], fixe)].sort(), [1, 2, 3, 4]);
});
