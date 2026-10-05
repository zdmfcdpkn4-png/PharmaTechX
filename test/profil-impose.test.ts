import { test } from "node:test";
import assert from "node:assert/strict";
import { documentDuProfil, profilDeLaPage, profilImpose, programmeVise } from "../lib/profil-impose";

const poste = { role: "poste" as const, filiere: "chimiotherapie", niveau: "N2R" };

test("profil imposé : un code de poste reçoit le profil de son code", () => {
  assert.deepEqual(profilImpose(poste, true), { filiere: "chimiotherapie", niveau: "N2R" });
  // Un code sans filière ni niveau impose quand même : le socle, à tous les niveaux.
  assert.deepEqual(profilImpose({ role: "poste", filiere: null, niveau: null }, true), { filiere: null, niveau: null });
});

test("profil imposé : la gestion, le mode test et le site sans base choisissent leur profil", () => {
  assert.equal(profilImpose({ ...poste, role: "tuteur" }, true), null);
  assert.equal(profilImpose({ ...poste, role: "admin" }, true), null);
  assert.equal(profilImpose({ ...poste, essai: { role: "admin" } }, true), null, "mode test");
  assert.equal(profilImpose(poste, false), null, "sans base, le site est ouvert");
  assert.equal(profilImpose(null, true), null);
});

test("page de module : le profil de l'adresse pour qui choisit, celui du code pour un poste", () => {
  const adresse = { parcours: "maintien", filiere: "sterilisation", niveau: "N1a" };
  assert.deepEqual(profilDeLaPage(null, adresse), { parcours: "maintien", filiere: "sterilisation", niveau: "N1a" });
  // Le poste garde le parcours de l'adresse, jamais sa filière ni son niveau.
  assert.deepEqual(profilDeLaPage({ filiere: "chimiotherapie", niveau: "N2R" }, adresse), {
    parcours: "maintien",
    filiere: "chimiotherapie",
    niveau: "N2R",
  });
  assert.deepEqual(profilDeLaPage({ filiere: "chimiotherapie", niveau: "N2R" }, {}), {
    parcours: "integration",
    filiere: "chimiotherapie",
    niveau: "N2R",
  });
  // Un code sans niveau n'a pas de profil de page : l'adresse ne lui en prête pas un.
  assert.equal(profilDeLaPage({ filiere: "chimiotherapie", niveau: null }, adresse), null);
  assert.equal(profilDeLaPage({ filiere: null, niveau: "N2R" }, adresse), null);
});

test("programme à la carte : celui du code pour un poste, quelle que soit l'adresse", () => {
  assert.equal(programmeVise(true, 7, 3, false), 3, "un autre programme demandé est ignoré");
  assert.equal(programmeVise(true, 7, null, false), null, "sans programme au code, aucun");
  assert.equal(programmeVise(true, null, 3, true), 3, "un parcours demandé ne fait pas quitter le programme du code");
  // Qui choisit : l'adresse d'abord, sinon le code quand aucun parcours n'est demandé (question 50).
  assert.equal(programmeVise(false, 7, 3, false), 7);
  assert.equal(programmeVise(false, null, 3, false), 3);
  assert.equal(programmeVise(false, null, 3, true), null);
});

test("documents généraux : la règle de l'écran du programme", () => {
  const pourTous = { filieres: [], niveaux: [] };
  const chimioN2R = { filieres: ["chimiotherapie"], niveaux: ["N2R"] };
  assert.equal(documentDuProfil(pourTous, "", ""), true);
  assert.equal(documentDuProfil(chimioN2R, "chimiotherapie", "N2R"), true);
  assert.equal(documentDuProfil(chimioN2R, "chimiotherapie", ""), true, "niveau non précisé : tous les niveaux");
  assert.equal(documentDuProfil(chimioN2R, "chimiotherapie", "N1a"), false);
  assert.equal(documentDuProfil(chimioN2R, "sterilisation", "N2R"), false);
  assert.equal(documentDuProfil(chimioN2R, "", "N2R"), false, "sans filière, un document de filière n'est pas proposé");
});
