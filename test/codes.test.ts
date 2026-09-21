import { test } from "node:test";
import assert from "node:assert/strict";
import { genererCode, hacherCode, normaliserCode, verifierCode } from "../lib/codes";

test("un code se vérifie contre son empreinte, et rien d'autre", () => {
  const code = genererCode();
  const stocke = hacherCode(code);
  assert.ok(verifierCode(code, stocke), "le code d'origine passe");
  assert.equal(verifierCode(code + "X", stocke), false, "un code voisin est refusé");
  assert.equal(verifierCode("", stocke), false, "un code vide est refusé");
});

test("le hachage tire un sel par code : deux empreintes diffèrent", () => {
  const code = genererCode();
  assert.notEqual(hacherCode(code), hacherCode(code));
  assert.match(hacherCode(code), /^scrypt\$[0-9a-f]{32}\$[0-9a-f]{64}$/);
});

test("une empreinte mal formée est refusée sans lever d'exception", () => {
  for (const stocke of ["", "scrypt", "scrypt$", "md5$aa$bb", "scrypt$zz$bb"]) {
    assert.equal(verifierCode("ABCDE-FGHIJ", stocke), false, `refusé : ${stocke}`);
  }
});

test("le code est lisible : ni 0, ni O, ni 1, ni I, ni l", () => {
  for (let i = 0; i < 50; i++) {
    assert.match(genererCode(), /^[A-HJ-NP-Z2-9]{5}-[A-HJ-NP-Z2-9]{5}$/);
  }
});

test("la saisie se normalise partout de la même façon : connexion et confirmation", () => {
  const code = genererCode();
  const stocke = hacherCode(code);
  for (const saisie of [code, `  ${code} `, code.toLowerCase(), code.replace("-", " - ")]) {
    assert.ok(verifierCode(normaliserCode(saisie), stocke), `acceptée : « ${saisie} »`);
  }
  assert.equal(
    verifierCode(normaliserCode(code.replace("-", "")), stocke),
    false,
    "le tiret fait partie du code, il n'est pas une décoration",
  );
});
