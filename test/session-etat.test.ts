import { test } from "node:test";
import assert from "node:assert/strict";
import { etatDeSession } from "../lib/session-etat";

const s = { role: "poste", acces: 7, debut: 1_000_000 };

test("session liée à son code : sans cookie, rien n'est fermé", () => {
  assert.deepEqual(etatDeSession(null, true, undefined), { session: null, fermee: false });
});

test("sans base configurée, le cookie signé fait foi", () => {
  assert.deepEqual(etatDeSession(s, false, undefined), { session: s, fermee: false });
});

test("code actif et jamais révoqué : session valide", () => {
  assert.deepEqual(etatDeSession(s, true, { actif: true, ferme: null }), { session: s, fermee: false });
});

test("code supprimé, révoqué, ou réactivé après une révocation postérieure à l'ouverture : session fermée", () => {
  assert.deepEqual(etatDeSession(s, true, null), { session: null, fermee: true });
  assert.deepEqual(etatDeSession(s, true, { actif: false, ferme: 1_000_500 }), { session: null, fermee: true });
  assert.deepEqual(etatDeSession(s, true, { actif: true, ferme: 1_000_500 }), { session: null, fermee: true });
  assert.deepEqual(etatDeSession(s, true, { actif: true, ferme: 1_000_000 }), { session: null, fermee: true });
});

test("code réactivé : une session ouverte après la révocation vaut", () => {
  const apres = { ...s, debut: 1_000_500.5 };
  assert.deepEqual(etatDeSession(apres, true, { actif: true, ferme: 1_000_500 }), { session: apres, fermee: false });
});

test("session d'avant cette version, sans code ou sans date d'ouverture : fermée une fois", () => {
  assert.deepEqual(etatDeSession({ role: "admin", acces: null, debut: 1 }, true, undefined), { session: null, fermee: true });
  assert.deepEqual(etatDeSession({ role: "admin", acces: 3 }, true, { actif: true, ferme: null }), { session: null, fermee: true });
});
