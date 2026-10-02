import { test } from "node:test";
import assert from "node:assert/strict";
import { adresseJournal, filtreActif, lireFiltreJournal, lireJour, motifCible } from "../lib/journal-filtre";

test("jour : une date du calendrier, sinon rien", () => {
  assert.equal(lireJour("2026-10-02"), "2026-10-02");
  assert.equal(lireJour(" 2026-10-02 "), "2026-10-02");
  assert.equal(lireJour("2026-02-30"), undefined, "le 30 février n'existe pas");
  assert.equal(lireJour("02/10/2026"), undefined);
  assert.equal(lireJour(undefined), undefined);
});

test("filtres lus de l'adresse : bornés, période remise dans l'ordre, page entière positive", () => {
  assert.deepEqual(
    lireFiltreJournal({ action: " niveau-question ", du: "2026-10-02", au: "2026-09-30", cible: " q-AbC ", avant: "120" }),
    { action: "niveau-question", du: "2026-09-30", au: "2026-10-02", cible: "q-AbC", avant: 120 },
  );
  assert.deepEqual(lireFiltreJournal({ action: "", du: "hier", cible: ["a", "b"], avant: "0" }), {}, "rien d'exploitable");
  assert.equal(lireFiltreJournal({ cible: "x".repeat(300) }).cible?.length, 100);
  assert.equal(lireFiltreJournal({ avant: "12abc" }).avant, undefined);
  assert.equal(filtreActif({ avant: 10 }), false, "une page n'est pas un filtre");
  assert.equal(filtreActif({ cible: "q-" }), true);
});

test("cible : % , _ et \\ cherchés pour eux-mêmes", () => {
  assert.equal(motifCible("q-AbC"), "%q-AbC%");
  assert.equal(motifCible("50%_a\\b"), "%50\\%\\_a\\\\b%");
});

test("adresse : filtres gardés, l'un remplacé ou retiré", () => {
  const f = { action: "niveau-question", cible: "q-1", avant: 40 };
  assert.equal(adresseJournal(f), "/admin/journal?action=niveau-question&cible=q-1&avant=40");
  assert.equal(adresseJournal(f, { avant: undefined }), "/admin/journal?action=niveau-question&cible=q-1");
  assert.equal(adresseJournal(f, { cible: "q-2", avant: undefined }), "/admin/journal?action=niveau-question&cible=q-2");
  assert.equal(adresseJournal({}), "/admin/journal");
});
