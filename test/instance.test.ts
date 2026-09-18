import { test } from "node:test";
import assert from "node:assert/strict";
import { conformiteInstance, etiquette } from "../lib/instance";

test("rien déclaré, base sans étiquette : rien n'est vérifié (développement local)", () => {
  assert.deepEqual(conformiteInstance(undefined, null), { ok: true, aInscrire: null, raison: null });
  assert.deepEqual(conformiteInstance("", null), { ok: true, aInscrire: null, raison: null });
  assert.deepEqual(conformiteInstance("  ", ""), { ok: true, aInscrire: null, raison: null });
});

test("base sans étiquette et environnement qui en déclare une : l'étiquette s'inscrit", () => {
  assert.deepEqual(conformiteInstance("service", null), { ok: true, aInscrire: "service", raison: null });
  assert.deepEqual(conformiteInstance(" essai ", null), { ok: true, aInscrire: "essai", raison: null });
});

test("étiquette et déclaration concordantes : la base est servie, rien à inscrire", () => {
  assert.deepEqual(conformiteInstance("service", "service"), { ok: true, aInscrire: null, raison: null });
  assert.deepEqual(conformiteInstance("essai", "essai"), { ok: true, aInscrire: null, raison: null });
});

test("étiquette et déclaration discordantes : refus, les deux étiquettes sont nommées", () => {
  const r = conformiteInstance("essai", "service");
  assert.equal(r.ok, false);
  assert.equal(r.aInscrire, null);
  assert.match(r.raison ?? "", /« service »/);
  assert.match(r.raison ?? "", /« essai »/);
});

test("base étiquetée et environnement muet : refus — c'est ce qui protège la base en service", () => {
  const r = conformiteInstance(undefined, "service");
  assert.equal(r.ok, false);
  assert.match(r.raison ?? "", /BASE_ATTENDUE/);
  assert.equal(conformiteInstance("", "essai").ok, false);
});

test("déclaration inconnue : refus, jamais d'interprétation", () => {
  const r = conformiteInstance("production", null);
  assert.equal(r.ok, false);
  assert.equal(r.aInscrire, null);
  assert.match(r.raison ?? "", /« production »/);
  assert.equal(conformiteInstance("Service", "service").ok, false, "la casse n'est pas devinée");
});

test("étiquette inscrite illisible ou d'un autre type : traitée comme absente ou comme une valeur à respecter", () => {
  assert.deepEqual(conformiteInstance("service", 42), { ok: true, aInscrire: "service", raison: null });
  assert.equal(conformiteInstance("service", "autre-chose").ok, false);
  assert.equal(etiquette("service"), "service");
  assert.equal(etiquette("SERVICE"), null);
  assert.equal(etiquette(undefined), null);
});
