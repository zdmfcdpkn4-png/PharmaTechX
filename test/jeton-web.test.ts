import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { jetonValide, lireJetonWeb, secretEffectif, signerWeb } from "../lib/jeton-web";

const secret = "un-secret-de-test-suffisamment-long";

function jetonNode(charge: object, s = secret): string {
  const c = Buffer.from(JSON.stringify(charge)).toString("base64url");
  return `${c}.${createHmac("sha256", s).update(c).digest("base64url")}`;
}

test("jeton-web : même signature que Node, échéance et falsification", async () => {
  const c = Buffer.from(JSON.stringify({ role: "poste", exp: 4102444800 })).toString("base64url");
  assert.equal(await signerWeb(c, secret), createHmac("sha256", secret).update(c).digest("base64url"));
  assert.equal(await jetonValide(jetonNode({ role: "poste", exp: 4102444800 }), secret), true);
  assert.equal(await jetonValide(jetonNode({ role: "poste", exp: 1 }), secret), false, "échu");
  assert.equal(await jetonValide(jetonNode({ role: "poste", exp: 4102444800 }, "autre-secret-tout-aussi-long"), secret), false, "autre secret");
  const [charge] = jetonNode({ role: "admin", exp: 4102444800 }).split(".");
  assert.equal(await jetonValide(`${charge}.signature-fausse`, secret), false);
  assert.equal(await jetonValide("sans-point", secret), false);
  assert.equal(await jetonValide("", secret), false);
});

test("lireJetonWeb : charge d'un jeton de Node, libellé accentué compris ; activité et identifiant lisibles", async () => {
  const charge = { role: "poste", libelle: "Poste isolateur — préparation", sid: "AbC-12_x", vu: 1_900_000_000, exp: 4102444800 };
  const lue = await lireJetonWeb(jetonNode(charge), secret);
  assert.ok(lue, "signature d'un jeton UTF-8 vérifiée");
  assert.equal(lue.vu, 1_900_000_000);
  assert.equal(lue.sid, "AbC-12_x");
  assert.equal(lue.exp, 4102444800);
  assert.equal(await lireJetonWeb(jetonNode({ ...charge, exp: 1 }), secret), null, "échu");
  assert.equal(await lireJetonWeb(jetonNode(charge, "autre-secret-tout-aussi-long"), secret), null, "autre secret");
});

test("secretEffectif : repli de développement si AUTH_SECRET manque ou est trop court", () => {
  assert.equal(secretEffectif(undefined), "developpement-non-securise-definir-AUTH_SECRET");
  assert.equal(secretEffectif("court"), "developpement-non-securise-definir-AUTH_SECRET");
  assert.equal(secretEffectif(secret), secret);
});
