import { test } from "node:test";
import assert from "node:assert/strict";
import { INACTIVITE_SECONDES, derniereActivite, inactif, resteAvantInactivite } from "../lib/inactivite";

// ── Déconnexion après quatre heures sans activité (demande du 23/09/2026)

const T = 2_000_000_000;
const H = 3600;

test("quatre heures, pas une de plus : la limite elle-même vaut encore", () => {
  assert.equal(INACTIVITE_SECONDES, 4 * H);
  assert.equal(inactif({ sid: "s1", vu: T - 4 * H }, null, T), false);
  assert.equal(inactif({ sid: "s1", vu: T - 4 * H - 1 }, null, T), true);
  assert.equal(resteAvantInactivite({ vu: T - H }, null, T), 3 * H);
  assert.equal(resteAvantInactivite({ vu: T - 5 * H }, null, T), 0);
});

test("le cookie d'activité entretient les seuls jetons dont il porte l'identifiant", () => {
  const jeton = { sid: "s1", vu: T - 5 * H };
  assert.equal(inactif(jeton, { vu: T - 60, sids: ["s1", "r1"] }, T), false, "lié : entretenu");
  assert.equal(inactif(jeton, { vu: T - 60, sids: ["autre"] }, T), true, "autre jeton : sans effet");
  assert.equal(inactif({ vu: T - 5 * H }, { vu: T - 60, sids: ["s1"] }, T), true, "jeton sans identifiant : rien ne s'y lie");
  assert.equal(inactif(jeton, { vu: T - 60, sids: "s1" }, T), true, "liste illisible : sans effet");
  assert.equal(inactif(jeton, { vu: "récent", sids: ["s1"] }, T), true, "date illisible : sans effet");
});

test("la plus récente des deux activités fait foi : un cookie d'activité ancien ne vieillit pas un jeton neuf", () => {
  assert.equal(derniereActivite({ sid: "s1", vu: T - 10 }, { vu: T - 5 * H, sids: ["s1"] }), T - 10);
  assert.equal(derniereActivite({ sid: "s1", vu: T - 5 * H }, { vu: T - 10, sids: ["s1"] }), T - 10);
  assert.equal(inactif({ sid: "s1", vu: T - 10 }, { vu: T - 5 * H, sids: ["s1"] }, T), false);
});

test("jetons d'avant cette version : l'ouverture fait foi, et un jeton que rien ne date est inactif", () => {
  assert.equal(inactif({ debut: T - H }, null, T), false, "ouvert il y a une heure");
  assert.equal(inactif({ debut: T - 5 * H }, null, T), true, "ouvert il y a cinq heures, jamais entretenu");
  assert.equal(inactif({}, null, T), true);
  assert.equal(resteAvantInactivite({}, null, T), 0);
});
