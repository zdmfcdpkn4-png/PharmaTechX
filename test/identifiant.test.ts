import { test } from "node:test";
import assert from "node:assert/strict";
import { FORMAT_IDENTIFIANT, formaterIdentifiant, normaliserIdentifiant } from "../lib/identifiant";

test("identifiant d'agent : format AG-NNN, longueur qui suit au-delà de 999", () => {
  assert.equal(formaterIdentifiant(7), "AG-007");
  assert.equal(formaterIdentifiant(120), "AG-120");
  assert.equal(formaterIdentifiant(1234), "AG-1234");
  assert.ok(FORMAT_IDENTIFIANT.test("AG-007"));
  assert.ok(FORMAT_IDENTIFIANT.test("AG-1234"));
  assert.ok(!FORMAT_IDENTIFIANT.test("AG-7"));
});

test("saisie normalisée : espaces, casse, préfixe et zéros facultatifs ; rien d'autre n'est accepté", () => {
  assert.equal(normaliserIdentifiant("AG-007"), "AG-007");
  assert.equal(normaliserIdentifiant(" ag 7 "), "AG-007");
  assert.equal(normaliserIdentifiant("AG07"), "AG-007");
  assert.equal(normaliserIdentifiant("7"), "AG-007");
  assert.equal(normaliserIdentifiant("1234"), "AG-1234");
  assert.equal(normaliserIdentifiant(""), null);
  assert.equal(normaliserIdentifiant("AG-0"), null);
  assert.equal(normaliserIdentifiant("Dupont"), null);
  assert.equal(normaliserIdentifiant("AG-007 Dupont"), null);
});
