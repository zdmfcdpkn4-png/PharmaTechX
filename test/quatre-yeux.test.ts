import { test } from "node:test";
import assert from "node:assert/strict";
import { auteurCourant, memeCode, peutValider, validationParAuteur } from "../content/quatre-yeux";

const creee = { cree_par: "tuteur · Tuteur chimio", cree_par_acces: 3, edite_par: "tuteur · Tuteur chimio", edite_par_acces: 3 };
const modifiee = { ...creee, edite_par: "admin · Administrateur initial", edite_par_acces: 1 };
const ancienne = { cree_par: "tuteur · Tuteur chimio", cree_par_acces: null, edite_par: null, edite_par_acces: null };

test("quatre yeux : l'auteur courant est le dernier code qui a écrit", () => {
  assert.deepEqual(auteurCourant(creee), { libelle: "tuteur · Tuteur chimio", acces: 3 });
  assert.deepEqual(auteurCourant(modifiee), { libelle: "admin · Administrateur initial", acces: 1 });
  assert.deepEqual(auteurCourant(ancienne), { libelle: "tuteur · Tuteur chimio", acces: null });
});

const tuteur = { role: "tuteur", libelle: "Tuteur chimio", acces: 3 };
const admin = { role: "admin", libelle: "Administrateur initial", acces: 1 };

test("quatre yeux : au tutorat, validation refusée au même code, accordée à un autre", () => {
  assert.equal(peutValider(creee, tuteur), false);
  assert.equal(peutValider(creee, admin), true);
  assert.equal(peutValider(modifiee, tuteur), true);
  const reprise = { ...modifiee, edite_par: "tuteur · Tuteur chimio", edite_par_acces: 3, cree_par: "admin · Administrateur initial", cree_par_acces: 1 };
  assert.equal(peutValider(reprise, tuteur), false, "l'éditeur devient l'auteur courant");
  // deux codes de même libellé mais d'identifiants différents sont distincts
  assert.equal(memeCode(creee, { role: "tuteur", libelle: "Tuteur chimio", acces: 9 }), false);
  // lignes anciennes sans identifiant de code : comparaison par libellé
  assert.equal(peutValider(ancienne, { role: "tuteur", libelle: "Tuteur chimio" }), false);
  assert.equal(peutValider(ancienne, { role: "tuteur", libelle: "Tuteur chimio", acces: 3 }), false);
  assert.equal(peutValider(ancienne, admin), true);
});

test("quatre yeux : l'administration valide aussi ses questions, et la validation par l'auteur se reconnaît", () => {
  assert.equal(peutValider(modifiee, admin), true, "exception du 23/09/2026");
  assert.equal(validationParAuteur(modifiee, admin), true);
  assert.equal(validationParAuteur(creee, admin), false, "question d'un autre code : validation ordinaire");
  assert.equal(validationParAuteur(creee, tuteur), false, "le tutorat ne valide pas les siennes");
  assert.equal(validationParAuteur(modifiee, tuteur), false);
  // un autre code d'administration n'est pas l'auteur
  assert.equal(validationParAuteur(modifiee, { role: "admin", libelle: "Administrateur initial", acces: 2 }), false);
  // lignes anciennes sans identifiant de code : comparaison par libellé
  const ancienneAdmin = { cree_par: "admin · Administrateur initial", cree_par_acces: null, edite_par: null, edite_par_acces: null };
  assert.equal(validationParAuteur(ancienneAdmin, admin), true);
});
