import { test } from "node:test";
import assert from "node:assert/strict";
import { legendeJuste, motAttendu, normaliser, ordreLecture, poser, schemaPret, variantes } from "../content/schema";

test("normaliser : accents, casse, articles, tirets, espaces", () => {
  assert.equal(normaliser("Le Réticulum-endoplasmique"), "reticulum endoplasmique");
  assert.equal(normaliser("l'os"), "os");
  assert.equal(normaliser("labrum"), "labrum");
  assert.equal(normaliser("  Sas   de transfert. "), "sas de transfert");
});

test("legendeJuste : tolérant sur la forme, strict sur le mot", () => {
  assert.equal(legendeJuste("sous clavier", "sous-clavier"), true);
  assert.equal(legendeJuste("nucléole", "noyau"), false);
  assert.equal(legendeJuste("", "noyau"), false);
  assert.equal(legendeJuste("TCP", "tube contourné proximal | TCP"), true);
  assert.equal(legendeJuste("tube contourne proximal", "tube contourné proximal | TCP"), true);
});

test("variantes et mot attendu", () => {
  assert.deepEqual(variantes("noyau | nucleus | "), ["noyau", "nucleus"]);
  assert.equal(motAttendu("noyau | nucleus"), "noyau");
});

test("ordreLecture : de haut en bas puis de gauche à droite", () => {
  const l = [
    { id: "a", attendu: "a", repere: { x: 60, y: 50 } },
    { id: "b", attendu: "b", repere: { x: 10, y: 50 } },
    { id: "c", attendu: "c", repere: { x: 90, y: 5 } },
  ];
  assert.deepEqual(ordreLecture(l), [2, 1, 0]);
});

test("poser : cache par défaut contenu dans l'image, repère au centre", () => {
  const r = poser(2, 3, 1.5);
  assert.ok(r.cache);
  assert.equal(r.cache!.x, 0);
  assert.equal(r.cache!.y, 0);
  assert.equal(r.x, r.cache!.w / 2);
  assert.equal(schemaPret([{ id: "l1", attendu: "mot", repere: r }]), true);
  assert.equal(schemaPret([{ id: "l1", attendu: "", repere: r }]), false);
  assert.equal(schemaPret([]), false);
});
