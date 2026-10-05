import { test } from "node:test";
import assert from "node:assert/strict";
import { voisins } from "../content/parcours";

const liste = [{ id: "a" }, { id: "b" }, { id: "c" }];

test("voisins : précédent et suivant dans une liste ordonnée", () => {
  assert.deepEqual(voisins(liste, "a"), { precedent: null, suivant: { id: "b" }, rang: 1, total: 3 });
  assert.deepEqual(voisins(liste, "b"), { precedent: { id: "a" }, suivant: { id: "c" }, rang: 2, total: 3 });
  assert.deepEqual(voisins(liste, "c"), { precedent: { id: "b" }, suivant: null, rang: 3, total: 3 });
  assert.equal(voisins(liste, "z"), null);
  assert.equal(voisins([], "a"), null);
});

test("voisins ouverts : un apprenant saute les modules sans question, le rang reste celui de la liste", () => {
  const cinq = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }, { id: "e" }];
  const ouvert = (m: { id: string }) => m.id !== "b" && m.id !== "d";
  assert.deepEqual(voisins(cinq, "c", ouvert), { precedent: { id: "a" }, suivant: { id: "e" }, rang: 3, total: 5 });
  assert.deepEqual(voisins(cinq, "a", ouvert), { precedent: null, suivant: { id: "c" }, rang: 1, total: 5 });
  assert.deepEqual(voisins(cinq, "e", ouvert), { precedent: { id: "c" }, suivant: null, rang: 5, total: 5 });
  // Rien d'ouvert après : pas de suivant, plutôt qu'un module fermé.
  assert.equal(voisins(cinq, "c", (m) => m.id === "c")?.suivant, null);
  // Le module lui-même peut être fermé (page d'un tuteur) : ses voisins se cherchent quand même.
  assert.deepEqual(voisins(cinq, "b", ouvert), { precedent: { id: "a" }, suivant: { id: "c" }, rang: 2, total: 5 });
});
