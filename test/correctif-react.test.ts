import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import {
  controlerCode,
  corriger,
  DOSSIER,
  FICHIERS,
  MARQUE,
  VERSION_REACT,
} from "../scripts/correctif-react-35494.mjs";

// Correctif amont React #35494 (décision du 23/09/2026, choix a) : à retirer
// avec le script au passage à Next 16.

/** Squelette de la fonction de rejeu, tel que le compile React 19.2. */
const squelette = (variable: string, retrait: string) =>
  [
    `exports.version = "${VERSION_REACT}";`,
    "var hydrationParentFiber = null, nextHydratableInstance = null, isHydrating = !1;",
    "function popToNextHostParent(fiber) {}",
    "function replaySuspendedUnitOfWork(unitOfWork) {",
    `${retrait}switch (${variable}.tag) {`,
    `${retrait}  case 5:`,
    `${retrait}    resetHooksOnUnwind(${variable});`,
    `${retrait}  default:`,
    `${retrait}    unwindInterruptedWork(current, ${variable});`,
    `${retrait}}`,
    "}",
    "function throwAndUnwindWorkLoop() {}",
    "",
  ].join("\n");

test("React embarqué par Next : les quatre fichiers client portent le correctif #35494", () => {
  for (const nom of FICHIERS) {
    const source = readFileSync(`${DOSSIER}/${nom}`, "utf8");
    assert.ok(source.includes(MARQUE), `${nom} : correctif absent — npm install a-t-il lancé postinstall ?`);
    assert.equal(corriger(source).statut, "deja", nom);
    assert.doesNotThrow(() => new vm.Script(source, { filename: nom }), `${nom} : syntaxe cassée`);
  }
});

test("correctif : huit lignes après resetHooksOnUnwind, dans la branche de l'élément hôte, une seule fois", () => {
  for (const [variable, retrait] of [["next", "  "], ["unitOfWork", "      "]]) {
    const { source, statut } = corriger(squelette(variable, retrait));
    assert.equal(statut, "applique");
    const i = source.indexOf(`resetHooksOnUnwind(${variable});`);
    const j = source.indexOf("default:", i);
    const insere = source.slice(i, j);
    assert.ok(insere.includes(MARQUE));
    assert.ok(insere.includes(`var fiber = ${variable};`));
    assert.ok(insere.includes("(nextHydratableInstance = fiber.stateNode))"));
    assert.ok(insere.includes(": (popToNextHostParent(fiber), (isHydrating = !0)));"));
    assert.equal(source.split(MARQUE).length, 2, "une seule insertion");
    assert.doesNotThrow(() => new vm.Script(source));
    // Seconde passe : rien ne change.
    assert.deepEqual(corriger(source), { source, statut: "deja" });
  }
});

test("correctif : refusé sur une autre version de React ou une branche absente ou en double", () => {
  const base = squelette("next", "  ");
  assert.throws(() => corriger(base.replace(VERSION_REACT, "19.3.0-canary-cbb046ab-20260731")), /ce n'est pas React/);
  assert.throws(() => corriger(base.replace("resetHooksOnUnwind(next);", "resetHooksOnUnwind(next, 1);")), /trouvée 0 fois/);
  const double = base.replace("  case 5:", "  case 5:\n    resetHooksOnUnwind(next);\n  default:\n  case 5:");
  assert.throws(() => corriger(double), /trouvée 2 fois/);
  assert.throws(() => corriger(base.replace("function replaySuspendedUnitOfWork(", "function autre(")), /introuvable/);
});

test("contrôle du code servi : fonction de rejeu minifiée, avec ou sans correctif", () => {
  // Formes relevées dans .next/static/chunks le 23/09/2026.
  const rejeu = (insere: string) =>
    "switch(n.tag){case 11:n=oF(t,n,n.pendingProps,n.type.render,n.ref,uI);break;" +
    `case 5:al(n);${insere}default:o0(t,n),n=oq(t,n=uR=ra(n,uQ),uQ)}`;
  // React 19.2 de Next 15.5, sans correctif.
  assert.deepEqual(controlerCode(rejeu("")), ["non-corrige"]);
  // Le même, corrigé par le script puis minifié par next build.
  const reporte = "var r=n;r===rP&&(rL?(rM(r),5===r.tag&&null!=r.stateNode&&(rN=r.stateNode)):(rM(r),rL=!0));";
  assert.deepEqual(controlerCode(rejeu(reporte)), ["corrige"]);
  // React 19.3, corrigé en amont (routeur « pages » de Next), autres noms courts.
  const amont =
    "switch(t.tag){case 11:t=iu(n,t,t.pendingProps,t.type.render,t.ref,uR);break;case 5:aL(t);" +
    "var r=t;r===rX&&(rJ?(r6(r),5===r.tag&&null!=r.stateNode&&(rZ=r.stateNode)):(r6(r),rJ=!0));default:ix(n,t)}";
  assert.deepEqual(controlerCode(amont), ["corrige"]);
  // Autre chose inséré que le correctif : non corrigé.
  assert.deepEqual(controlerCode(rejeu("x();")), ["non-corrige"]);
  // Fichier sans React : rien à contrôler.
  assert.deepEqual(controlerCode("function f(e){switch(e){case 5:g(e);default:h()}}"), []);
});
