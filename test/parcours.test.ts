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
