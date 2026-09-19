import { test } from "node:test";
import assert from "node:assert/strict";
import config from "../next.config";

/**
 * Garde-fou sur la configuration elle-même : ces deux mesures ne laissent
 * aucune trace dans l'interface, personne ne s'apercevrait de leur
 * disparition. Le parcours de bout en bout les vérifie en plus sur les
 * réponses réelles du serveur.
 */

async function entetesDeLaConfig(): Promise<Map<string, { source: string; valeur: string }>> {
  const declare = config.headers;
  assert.ok(typeof declare === "function", "next.config déclare headers()");
  const trouve = new Map<string, { source: string; valeur: string }>();
  for (const r of await declare()) for (const e of r.headers) trouve.set(e.key.toLowerCase(), { source: r.source, valeur: e.value });
  return trouve;
}

test("aucune divulgation de la pile technique : X-Powered-By est retiré", () => {
  assert.equal(config.poweredByHeader, false);
});

test("détournement de clic : frame-ancestors et X-Frame-Options sur toutes les réponses", async () => {
  const e = await entetesDeLaConfig();
  assert.match(e.get("content-security-policy")?.valeur ?? "", /(^|;)\s*frame-ancestors 'self'\s*(;|$)/);
  assert.equal(e.get("x-frame-options")?.valeur, "SAMEORIGIN");
  // Un motif qui ne couvrirait plus la racine laisserait les pages sans
  // protection sans rien casser d'autre : la panne serait silencieuse.
  for (const { source } of e.values()) assert.match(source, /^\/:[a-z]+\*$/);
});
