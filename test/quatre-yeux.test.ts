import { test } from "node:test";
import assert from "node:assert/strict";
import { auteurCourant, memeCode, peutValider } from "../content/quatre-yeux";

const creee = { cree_par: "tuteur · Tuteur chimio", cree_par_acces: 3, edite_par: "tuteur · Tuteur chimio", edite_par_acces: 3 };
const modifiee = { ...creee, edite_par: "admin · Administrateur initial", edite_par_acces: 1 };
const ancienne = { cree_par: "tuteur · Tuteur chimio", cree_par_acces: null, edite_par: null, edite_par_acces: null };

test("quatre yeux : l'auteur courant est le dernier code qui a écrit", () => {
  assert.deepEqual(auteurCourant(creee), { libelle: "tuteur · Tuteur chimio", acces: 3 });
  assert.deepEqual(auteurCourant(modifiee), { libelle: "admin · Administrateur initial", acces: 1 });
  assert.deepEqual(auteurCourant(ancienne), { libelle: "tuteur · Tuteur chimio", acces: null });
});

test("quatre yeux : validation refusée au même code, accordée à un autre", () => {
  const tuteur = { role: "tuteur", libelle: "Tuteur chimio", acces: 3 };
  const admin = { role: "admin", libelle: "Administrateur initial", acces: 1 };
  assert.equal(peutValider(creee, tuteur), false);
  assert.equal(peutValider(creee, admin), true);
  assert.equal(peutValider(modifiee, admin), false, "l'éditeur devient l'auteur courant");
  assert.equal(peutValider(modifiee, tuteur), true);
  // deux codes de même libellé mais d'identifiants différents sont distincts
  assert.equal(memeCode(creee, { role: "tuteur", libelle: "Tuteur chimio", acces: 9 }), false);
  // lignes anciennes sans identifiant de code : comparaison par libellé
  assert.equal(peutValider(ancienne, { role: "tuteur", libelle: "Tuteur chimio" }), false);
  assert.equal(peutValider(ancienne, { role: "tuteur", libelle: "Tuteur chimio", acces: 3 }), false);
  assert.equal(peutValider(ancienne, admin), true);
});
