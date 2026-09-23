import { test } from "node:test";
import assert from "node:assert/strict";
import { cheminDe, groupePorteLaPage, relevePage } from "../lib/rail";

test("le chemin d'un lien ignore ancre et paramètres", () => {
  assert.equal(cheminDe("/reperes#dispositif"), "/reperes");
  assert.equal(cheminDe("/admin/questions?statut=a_verifier"), "/admin/questions");
  assert.equal(cheminDe("/#modules"), "/");
});

test("un sous-menu s'ouvre sur ses pages et leurs sous-pages", () => {
  assert.ok(relevePage("/admin/rapports", "/admin/rapports"));
  assert.ok(relevePage("/admin/rapports/RAP-1", "/admin/rapports"), "page d'un rapport : Suivi");
  assert.ok(relevePage("/admin/questions/import", "/admin/questions/import"));
  assert.ok(relevePage("/admin/questions/q-12", "/admin/questions"), "édition d'une question : Contenu");
});

test("une racine de section n'englobe pas toute la section", () => {
  assert.ok(relevePage("/admin", "/admin"), "la page Accès elle-même");
  assert.equal(relevePage("/admin/questions", "/admin"), false, "« Accès » n'ouvre pas Réglages partout");
  assert.equal(relevePage("/module/x", "/#modules"), false);
});

test("un préfixe de nom n'est pas un sous-chemin", () => {
  assert.equal(relevePage("/admin/questionsXYZ", "/admin/questions"), false);
});

test("le groupe de la page courante, même règle pour la barre et le Menu", () => {
  assert.ok(groupePorteLaPage("formation", "/"));
  assert.ok(groupePorteLaPage("formation", "/module/comportement-zac/evaluation"));
  assert.ok(groupePorteLaPage("reperes", "/reperes"));
  assert.ok(groupePorteLaPage("administration", "/admin/questions"));
  assert.ok(groupePorteLaPage("rgpd", "/donnees-personnelles"));
  assert.equal(groupePorteLaPage("formation", "/admin"), false);
  assert.equal(groupePorteLaPage("administration", "/"), false);
  assert.equal(groupePorteLaPage("reperes", "/module/x"), false);
});
