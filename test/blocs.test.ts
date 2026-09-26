import { test } from "node:test";
import assert from "node:assert/strict";
import { fusionnerBlocs, numeroSuivant, plageDesBlocs, type BlocDepose } from "../content/blocs";
import { blocsCompetence } from "../content/habilitation";

const depot = (numero: number, titre: string, actif = true): BlocDepose => ({
  numero,
  titre,
  reference: "Réf. locale",
  filiere: "socle",
  actif,
});

test("blocs servis : sans dépôt, la fiche telle quelle (question 81)", () => {
  const servis = fusionnerBlocs(blocsCompetence, []);
  assert.deepEqual(servis.map((b) => b.numero), blocsCompetence.map((b) => b.numero));
  assert.ok(servis.every((b) => b.origine === "code" && b.fiche && b.actif));
});

test("un dépôt au numéro d'un bloc de la fiche le corrige, et ne le désactive jamais", () => {
  const servis = fusionnerBlocs(blocsCompetence, [depot(2, "Circuit des chimiothérapies (unité)", false)]);
  const b2 = servis.find((b) => b.numero === 2)!;
  assert.equal(b2.titre, "Circuit des chimiothérapies (unité)");
  assert.equal(b2.reference, "Réf. locale");
  assert.equal(b2.origine, "base");
  assert.equal(b2.actif, true, "un bloc de la fiche reste proposé");
  assert.equal(servis.length, blocsCompetence.length);
});

test("un numéro nouveau ajoute un bloc, rangé par numéro ; désactivé, il ne sert qu'à la liste complète", () => {
  const deposes = [depot(9, "Stérilisation"), depot(8, "Radiopharmacie", false)];
  const servis = fusionnerBlocs(blocsCompetence, deposes);
  assert.deepEqual(servis.slice(-1).map((b) => [b.numero, b.fiche, b.actif]), [[9, false, true]]);
  const tous = fusionnerBlocs(blocsCompetence, deposes, true);
  assert.deepEqual(tous.slice(-2).map((b) => [b.numero, b.actif]), [[8, false], [9, true]]);
});

test("numéro suivant et plage des blocs", () => {
  assert.equal(numeroSuivant(blocsCompetence), 8);
  assert.equal(numeroSuivant([]), 1);
  assert.equal(plageDesBlocs(blocsCompetence), "1 à 7");
  assert.equal(plageDesBlocs([...blocsCompetence, { numero: 9 }]), "1 à 7, 9");
  assert.equal(plageDesBlocs([{ numero: 1 }, { numero: 2 }]), "1, 2");
});
