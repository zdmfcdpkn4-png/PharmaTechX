import test from "node:test";
import assert from "node:assert/strict";
import {
  AUCUN_COMPTE,
  PLAFOND_A_FAIRE,
  fileNonVide,
  itemsAFaire,
  nomAccessible,
  type ComptesAttente,
} from "../content/acces-rapide";

const PLEIN: ComptesAttente = {
  signalements: 3,
  contenusAVerifier: 12,
  rapportsAViser: 2,
  verdictsAArbitrer: 1,
  quizAnciens: 4,
};

test("un profil de poste n'a pas de file d'attente", () => {
  assert.deepEqual(itemsAFaire("poste", PLEIN, true), []);
  assert.equal(fileNonVide(itemsAFaire("poste", PLEIN, true)), false);
});

test("l'ordre des items ne dépend d'aucun compteur (critère 7)", () => {
  const ordre = (c: ComptesAttente) => itemsAFaire("tuteur", c, true).map((i) => i.cle);
  // « Quiz de plus de 24 mois » a été ajouté en **fin** de file le 22/09/2026 :
  // les quatre premiers gardent leur rang, donc leur place sous la main.
  const attendu = ["rapportsAViser", "verdictsAArbitrer", "signalements", "contenusAVerifier", "quizAnciens"];
  assert.deepEqual(ordre(PLEIN), attendu);
  assert.deepEqual(ordre(AUCUN_COMPTE), attendu, "tous les compteurs à zéro : même ordre");
  assert.deepEqual(
    ordre({ signalements: 99, contenusAVerifier: 0, rapportsAViser: 0, verdictsAArbitrer: 0, quizAnciens: 0 }),
    attendu,
    "un compteur élevé ne remonte pas son item",
  );
});

test("tutorat et administration portent la même liste, dans le même ordre", () => {
  assert.deepEqual(
    itemsAFaire("tuteur", PLEIN, true).map((i) => i.cle),
    itemsAFaire("admin", PLEIN, true).map((i) => i.cle),
  );
});

test("un item à zéro reste dans la liste (critère 3)", () => {
  const items = itemsAFaire("admin", AUCUN_COMPTE, true);
  assert.equal(items.length, 5);
  assert.ok(items.every((i) => i.nombre === 0));
  assert.ok(items.some((i) => i.cle === "signalements"), "l'item existe même à zéro");
});

test("sans conservation, les écrans de rapports n'existent pas : pas d'item", () => {
  const cles = itemsAFaire("admin", PLEIN, false).map((i) => i.cle);
  assert.deepEqual(cles, ["signalements", "contenusAVerifier"]);
});

test("jamais plus de cinq items", () => {
  for (const profil of ["poste", "tuteur", "admin"] as const) {
    assert.ok(itemsAFaire(profil, PLEIN, true).length <= PLAFOND_A_FAIRE);
  }
});

test("la pastille du déclencheur ne s'allume que si un item est non nul", () => {
  assert.equal(fileNonVide(itemsAFaire("admin", AUCUN_COMPTE, true)), false);
  assert.equal(fileNonVide(itemsAFaire("admin", PLEIN, true)), true);
  assert.equal(
    fileNonVide(itemsAFaire("admin", { ...AUCUN_COMPTE, signalements: 1 }, true)),
    true,
  );
});

test("le compteur est dans le nom accessible, y compris à zéro", () => {
  assert.equal(nomAccessible({ libelle: "Signalements ouverts", nombre: 3 }), "Signalements ouverts, 3 en attente");
  assert.equal(nomAccessible({ libelle: "Signalements ouverts", nombre: 0 }), "Signalements ouverts, aucun");
});

test("chaque item porte un écran atteignable", () => {
  for (const i of itemsAFaire("admin", PLEIN, true)) {
    assert.match(i.href, /^\/admin\//, `href de ${i.cle}`);
    assert.ok(i.libelle.length > 0);
  }
});
