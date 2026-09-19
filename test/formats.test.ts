import { test } from "node:test";
import assert from "node:assert/strict";
import {
  morceauxDuTexte,
  noterQuestion,
  sanitizeQuestion,
  trousDuTexte,
  type Question,
} from "../content/types";
import { BAREME_DEFAUT, normaliserBareme } from "../content/bareme";

/*
 * Séquence à ordonner (ORD) et texte à trous (TAT), ajoutés le 19/09/2026.
 * L'ordre juste et les vignettes attendues vivent dans `bonnesReponses`, qui
 * ne quitte jamais le serveur ; la note passe par la même règle que les
 * autres formats (`noterElements`).
 */

const sequence: Question = {
  id: "s1",
  enonce: "Remettez les étapes de l'habillage dans l'ordre.",
  type: "ORD",
  options: [
    { id: "a", texte: "Hygiène des mains" },
    { id: "b", texte: "Surchaussures" },
    { id: "c", texte: "Combinaison" },
  ],
  bonnesReponses: ["a", "b", "c"],
  justification: "",
};

const trous: Question = {
  id: "t1",
  enonce: "Le sas de {1} est en dépression par rapport à la {2}.",
  type: "TAT",
  options: [
    { id: "a", texte: "transfert" },
    { id: "b", texte: "zone à atmosphère contrôlée" },
    { id: "c", texte: "couloir" },
    { id: "d", texte: "transfert" },
  ],
  bonnesReponses: ["a", "b"],
  justification: "",
};

test("séquence : chaque étape à sa place vaut sa part", () => {
  assert.equal(noterQuestion(sequence, { choix: [], rangs: { a: 1, b: 2, c: 3 } }).note, 1);
  // une inversion : une étape juste, deux mal placées → plancher
  assert.equal(noterQuestion(sequence, { choix: [], rangs: { a: 1, b: 3, c: 2 } }).note, 0);
  // deux à leur place, une sans rang : 2/3 de point, aucune pénalité
  assert.equal(noterQuestion(sequence, { choix: [], rangs: { a: 1, b: 2 } }).note, 0.67);
  assert.equal(noterQuestion(sequence, { choix: [], rangs: {} }).note, 0);
});

test("séquence : une étape sans rang est une discordance, pas une erreur", () => {
  const n = noterQuestion(sequence, { choix: [], rangs: { a: 1, b: 2 } });
  assert.equal(n.nonJugees, 1);
  assert.equal(n.discordances, 1, "la question n'est pas juste pour autant");
  assert.equal(noterQuestion(sequence, { choix: [], rangs: { a: 1, b: 2, c: 3 } }).discordances, 0);
});

test("texte à trous : la comparaison porte sur le mot, non sur la vignette", () => {
  assert.equal(noterQuestion(trous, { choix: [], trous: { "1": "a", "2": "b" } }).note, 1);
  // « d » porte le même mot que « a » : la réponse est juste
  assert.equal(noterQuestion(trous, { choix: [], trous: { "1": "d", "2": "b" } }).note, 1);
  // un trou faux annule le trou juste (juste +1/n, faux −1/n)
  assert.equal(noterQuestion(trous, { choix: [], trous: { "1": "a", "2": "c" } }).note, 0);
  // un trou laissé vide ne retire rien
  assert.equal(noterQuestion(trous, { choix: [], trous: { "1": "a" } }).note, 0.5);
});

test("l'ordre juste et les vignettes attendues ne partent pas au navigateur", () => {
  const pub = sanitizeQuestion(sequence);
  assert.equal("bonnesReponses" in pub, false);
  assert.equal(pub.options.length, 3, "les étapes partent toutes, mélangées");
  const pubT = sanitizeQuestion(trous);
  assert.equal("bonnesReponses" in pubT, false);
  assert.equal(pubT.options.length, 4, "attendues et leurres, mélangés");
});

test("marques de trou : lecture et découpe de l'énoncé", () => {
  assert.deepEqual(trousDuTexte("Le sas de {1} donne sur la {2}, jamais sur {1}."), [1, 2]);
  assert.deepEqual(trousDuTexte("Sans trou."), []);
  assert.deepEqual(morceauxDuTexte("a {1} b"), [{ texte: "a " }, { trou: 1 }, { texte: " b" }]);
});

test("barème : les deux formats ont leurs six réglages, par défaut ceux de Flore", () => {
  assert.deepEqual(BAREME_DEFAUT.ordre, { mode: "partiel", juste: 1, faux: -1, sansReponse: 0, min: 0, max: 1 });
  assert.deepEqual(BAREME_DEFAUT.trous, BAREME_DEFAUT.ordre);
  // un barème enregistré avant leur existence prend les valeurs par défaut
  const ancien = normaliserBareme({ version: 2, qcm: BAREME_DEFAUT.qcm, seuilDefaut: 75 });
  assert.deepEqual(ancien.ordre, BAREME_DEFAUT.ordre);
  assert.equal(ancien.seuilDefaut, 75);
  // et un réglage propre est relu tel quel
  const regle = normaliserBareme({ ...BAREME_DEFAUT, ordre: { ...BAREME_DEFAUT.ordre, faux: -0.5, max: 0.5 } });
  assert.equal(regle.ordre.faux, -0.5);
  assert.equal(regle.ordre.max, 0.5);
  assert.equal(noterQuestion(sequence, { choix: [], rangs: { a: 1, b: 2, c: 3 } }, regle).note, 0.5);
});
