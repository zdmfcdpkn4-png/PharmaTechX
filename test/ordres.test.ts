import { test } from "node:test";
import assert from "node:assert/strict";
import {
  appliquerOrdre,
  chronologie,
  cleProfil,
  deplacer,
  lireOrdreSaisi,
  lireProfilDemande,
  modulesDuProfil,
  requeteProfil,
} from "../content/ordres";

// ── Question 55 (choix a, 23/09/2026) : ordonnancement par profil de poste et niveau cible

const m = (id: string, niveaux: string[] = ["N1a", "N2"]) => ({ id, niveaux });

test("modules d'un profil : socle puis filière, au niveau cible, sans doublon, dans l'ordre reçu", () => {
  const socle = [m("s1"), m("s2", ["N2"]), m("s3", ["[à préciser]"])];
  const filiere = [m("f1", ["N1a"]), m("f2"), m("s1")];
  assert.deepEqual(modulesDuProfil(socle, filiere, "N1a").map((x) => x.id), ["s1", "f1", "f2"]);
  assert.deepEqual(modulesDuProfil(socle, filiere, "N2").map((x) => x.id), ["s1", "s2", "f2"]);
  assert.deepEqual(modulesDuProfil(socle, filiere, "N3"), [], "niveau sans module : profil vide, pas deviné");
});

test("ordre appliqué : les modules nommés dans l'ordre enregistré, les nouveaux à la suite, les sortis ignorés", () => {
  const profil = [m("a"), m("b"), m("c"), m("d")];
  const { ranges, nouveaux } = appliquerOrdre(profil, ["c", "x-sorti", "a", "c"]);
  assert.deepEqual(ranges.map((x) => x.id), ["c", "a"]);
  assert.deepEqual(nouveaux.map((x) => x.id), ["b", "d"], "entrés depuis : dans l'ordre par défaut");
  assert.deepEqual(chronologie(profil, ["c", "a"]).map((x) => x.id), ["c", "a", "b", "d"]);
  assert.deepEqual(chronologie(profil, []).map((x) => x.id), ["a", "b", "c", "d"]);
});

test("ordre saisi : rien d'étranger au profil, aucun doublon, les omis à la suite", () => {
  const profil = ["a", "b", "c", "d"];
  assert.deepEqual(lireOrdreSaisi(["d", "b", "a", "c"], profil), ["d", "b", "a", "c"]);
  assert.deepEqual(lireOrdreSaisi(["d", "intrus", "d", 42, "b"], profil), ["d", "b", "a", "c"]);
  assert.deepEqual(lireOrdreSaisi([], profil), profil);
});

test("déplacer : glisser, flèches ou numéro saisi, place d'arrivée bornée", () => {
  const l = ["a", "b", "c", "d"];
  assert.deepEqual(deplacer(l, 3, 0), ["d", "a", "b", "c"], "le dernier en premier");
  assert.deepEqual(deplacer(l, 0, 2), ["b", "c", "a", "d"]);
  assert.deepEqual(deplacer(l, 1, 99), ["a", "c", "d", "b"], "au-delà de la liste : en dernier");
  assert.deepEqual(deplacer(l, 2, -5), ["c", "a", "b", "d"], "en deçà : en premier");
  assert.deepEqual(deplacer(l, 7, 0), l, "élément inconnu : rien ne bouge");
  assert.deepEqual(l, ["a", "b", "c", "d"], "la liste reçue ne change pas");
});

test("clé de profil : filière et niveau, le niveau gardant sa casse", () => {
  assert.equal(cleProfil("chimiotherapie", "N1a"), "chimiotherapie|N1a");
});

test("profil dans l'adresse : filière et niveau exigés, bien formés ; parcours d'intégration par défaut", () => {
  assert.deepEqual(lireProfilDemande({ parcours: "maintien", filiere: "chimiotherapie", niveau: "N1a" }), {
    parcours: "maintien",
    filiere: "chimiotherapie",
    niveau: "N1a",
  });
  assert.deepEqual(lireProfilDemande({ filiere: "aide-pharmacie", niveau: "AP-N1" })?.parcours, "integration");
  assert.equal(lireProfilDemande({ filiere: "chimiotherapie" }), null, "sans niveau");
  assert.equal(lireProfilDemande({ filiere: "Chimio<script>", niveau: "N1a" }), null, "filière mal formée");
  assert.equal(lireProfilDemande({ filiere: "chimiotherapie", niveau: "N1a&x=1" }), null, "niveau mal formé");
  const p = { parcours: "integration" as const, filiere: "chimiotherapie", niveau: "N1a" };
  assert.equal(requeteProfil(p), "?parcours=integration&filiere=chimiotherapie&niveau=N1a");
  assert.deepEqual(lireProfilDemande(Object.fromEntries(new URLSearchParams(requeteProfil(p)))), p, "aller-retour");
});
