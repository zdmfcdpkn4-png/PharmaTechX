import { test } from "node:test";
import assert from "node:assert/strict";
import {
  TYPES_CODE,
  genererCode,
  hacherCode,
  libelleDuCode,
  lireTypeCode,
  motifLibelle,
  normaliserCode,
  verifierCode,
} from "../lib/codes";

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

test("types de profil : liste fermée des questions 95 et 96, en capitales sans accent", () => {
  assert.deepEqual(
    TYPES_CODE.map((t) => t.id),
    ["PHARMACIEN", "INTERNE", "PREPARATEUR", "OPQ", "ASH"],
  );
  for (const t of TYPES_CODE) assert.match(t.id, /^[A-Z]+$/, `${t.id} : rien que le motif ne puisse lire tel quel`);
});

test("le type envoyé n'est reçu que s'il est de la liste, casse comprise", () => {
  for (const t of TYPES_CODE) assert.equal(lireTypeCode(t.id), t.id);
  for (const brut of ["", "pharmacien", "interne", " ASH", "ASH ", "CADRE", "Tuteur chimio", "PHARMACIEN-0", null, undefined, 0, {}, ["ASH"]]) {
    assert.equal(lireTypeCode(brut), null, `refusé : ${JSON.stringify(brut)}`);
  }
});

test("le site nomme le code TYPE-n, à partir de 0", () => {
  assert.equal(libelleDuCode("PHARMACIEN", 0), "PHARMACIEN-0");
  assert.equal(libelleDuCode("PREPARATEUR", 12), "PREPARATEUR-12");
});

test("le motif reconnaît les noms au format du type, et eux seuls", () => {
  const motif = new RegExp(motifLibelle("ASH"), "i"); // PostgreSQL le lit sans tenir compte de la casse (~*)
  for (const nom of ["ASH-0", "ASH-12", "ash-7", "ASH-999999999"]) assert.match(nom, motif, nom);
  for (const nom of ["ASH", "ASH-", "ASH-1a", "ASH-3 bis", "XASH-1", "ASH-1234567890", "OPQ-1"]) {
    assert.doesNotMatch(nom, motif, nom);
  }
  assert.equal(motif.exec("ASH-42")?.[1], "42", "le numéro est capturé");
  assert.equal(
    new RegExp(motifLibelle("PHARMACIEN"), "i").exec(libelleDuCode("PHARMACIEN", 3))?.[1],
    "3",
    "un nom donné par le site se relit par son motif",
  );
});
