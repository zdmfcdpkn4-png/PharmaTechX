import { test } from "node:test";
import assert from "node:assert/strict";
import { identifiantARattacher, lireChoixAgent, rattachementAdmis, refusLiaison } from "../lib/liaison";

test("liaison : un code de poste ou de tutorat se relie, à un identifiant actif ; jamais un code d'administration", () => {
  assert.equal(refusLiaison("poste", { actif: true }), null);
  // Question 104, choix b (06/10/2026) : un code de tutorat relié, pour le tuteur en formation.
  assert.equal(refusLiaison("tuteur", { actif: true }), null);
  assert.equal(refusLiaison("admin", { actif: true }), "role");
  assert.equal(refusLiaison("poste", null), "agent-inconnu");
  assert.equal(refusLiaison("tuteur", null), "agent-inconnu");
  assert.equal(refusLiaison("poste", { actif: false }), "agent-clos");
  // Le rôle passe avant l'agent : un code d'administration est refusé, quel que soit l'agent.
  assert.equal(refusLiaison("admin", null), "role");
});

test("liaison : le choix d'agent se lit comme une saisie d'identifiant, vide pour délier", () => {
  assert.deepEqual(lireChoixAgent(""), { identifiant: null });
  assert.deepEqual(lireChoixAgent("   "), { identifiant: null });
  assert.deepEqual(lireChoixAgent(undefined), { identifiant: null });
  assert.deepEqual(lireChoixAgent("AG-007"), { identifiant: "AG-007" });
  assert.deepEqual(lireChoixAgent("ag 7"), { identifiant: "AG-007" });
  assert.equal(lireChoixAgent("Dupont"), null);
  assert.equal(lireChoixAgent("AG-000"), null);
});

test("rattachement : sous un code relié, l'identifiant est celui du code, et lui seul", () => {
  assert.deepEqual(identifiantARattacher("AG-004", ""), { identifiant: "AG-004" });
  assert.deepEqual(identifiantARattacher("AG-004", "ag 4"), { identifiant: "AG-004" });
  assert.deepEqual(identifiantARattacher("AG-004", "AG-002"), { refus: "autre-agent" });
  assert.deepEqual(identifiantARattacher("AG-004", "n'importe quoi"), { refus: "autre-agent" });
});

test("rattachement : sous un code partagé, la saisie fait foi, au format AG-001", () => {
  assert.deepEqual(identifiantARattacher(null, "ag 2"), { identifiant: "AG-002" });
  assert.deepEqual(identifiantARattacher(null, ""), { refus: "format" });
  assert.deepEqual(identifiantARattacher(null, "Dupont"), { refus: "format" });
});

test("rattachement : un rattachement posé pour un autre agent ne vaut plus sous un code relié", () => {
  assert.equal(rattachementAdmis(null, 2), true, "code partagé : tout rattachement vaut");
  assert.equal(rattachementAdmis(4, 4), true);
  assert.equal(rattachementAdmis(4, 2), false);
});
