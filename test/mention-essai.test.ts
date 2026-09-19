import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * La mention « Phase d'essai » a quitté les écrans le 19/09/2026 : elle ne
 * disait rien d'utile à un apprenant et occupait le pied de chaque page.
 *
 * Elle reste à deux endroits, et ces deux-là sont intentionnels :
 *   - le **rapport** (`lib/rapport.ts`), qui porte la bande rouge « ce rapport
 *     ne vaut pas preuve » tant que la mise en service n'est pas prononcée ;
 *     c'est le seul endroit où un lecteur extérieur au site peut l'apprendre ;
 *   - l'**administration**, où l'état réel du dispositif doit rester lisible.
 *
 * Ce test garde la frontière : un retour de la mention sur un écran
 * d'apprenant le fait échouer.
 */

const RENDU = /Phase d(?:&apos;|')essai/;

function fichiers(racine: string): string[] {
  const out: string[] = [];
  for (const nom of readdirSync(racine)) {
    const chemin = join(racine, nom);
    if (statSync(chemin).isDirectory()) {
      out.push(...fichiers(chemin));
    } else if (/\.tsx?$/.test(nom)) {
      out.push(chemin);
    }
  }
  return out;
}

test("aucun écran hors administration n'affiche « Phase d'essai »", () => {
  const coupables: string[] = [];
  for (const f of [...fichiers("app"), ...fichiers("components")]) {
    if (f.startsWith("app/admin/")) continue;
    if (RENDU.test(readFileSync(f, "utf8"))) coupables.push(f);
  }
  assert.deepEqual(coupables, [], `mention d'essai revenue dans : ${coupables.join(", ")}`);
});

test("le rapport, lui, porte toujours la mention tant qu'il n'est pas en service", () => {
  const source = readFileSync("lib/rapport.ts", "utf8");
  assert.match(source, /Phase d'essai/, "la bande d'essai a disparu du rapport");
  assert.match(source, /ne vaut pas preuve/, "le rapport n'annonce plus qu'il ne vaut pas preuve");
  // La bande n'est posée que faute de date de mise en service.
  assert.match(source, /options\.miseEnService/, "la bande ne dépend plus de la mise en service");
});
