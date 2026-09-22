import { test } from "node:test";
import assert from "node:assert/strict";
import { analyserTexte, lireReference } from "../lib/import-questions";

const TEXTE = `QCM 1. Quelle est la voie d'exposition prépondérante ? (plusieurs réponses)
A. L'inhalation (F)
B. La voie cutanée (V)
C. L'ingestion (F)
D. La piqûre seule (F)
Justification : les mesures de contamination surfacique montrent une exposition cutanée.
Source : INRS — TF 255 — 2020 — https://www.inrs.fr/media.html?refINRS=TF+255
Éliminatoire : oui

2. Un gant reste intact après une heure. Conduite correcte ?
A. Le conserver
B. Le changer selon la périodicité définie
C. Le changer seulement après projection
Réponses : B

QIM 3. Concernant les ZAC, indiquer les propositions exactes.
A. ISO 5 = 3 520 particules ≥ 0,5 µm par m³ (V)
B. Grade A : ISO 5 au repos et en activité (V)
C. Le comptage particulaire renseigne sur la charge microbiologique (F)
D. L'opérateur est le principal contributeur (V)
E. Une sortie brève dispense de refaire l'habillage (F)

4. Question sans corrigé
A. Première
B. Deuxième

SCHÉMA 1. Coupe d'un isolateur : légendez les éléments repérés.
Image : isolateur-coupe.png
1. sas de transfert (32, 24, 14, 5)
2. filtre HEPA | filtre terminal (58, 19)
3. gant
Justification : cf. procédure interne.
`;

test("analyse d'un texte mixte QCM / QIM / schéma", () => {
  const r = analyserTexte(TEXTE, { formatDefaut: "QCM" });
  assert.equal(r.questions.length, 5);

  const [q1, q2, q3, q4, s1] = r.questions;
  assert.equal(q1.format, "QCM");
  assert.equal(q1.enonce, "Quelle est la voie d'exposition prépondérante ? (plusieurs réponses)");
  assert.deepEqual(q1.options.map((o) => o.vrai), [false, true, false, false]);
  assert.equal(q1.options[1].texte, "La voie cutanée");
  assert.equal(q1.eliminatoire, true);
  assert.equal(q1.corrigeDetecte, true);
  assert.equal(q1.justification.startsWith("les mesures"), true);
  assert.equal(q1.refs[0].source, "INRS");
  assert.equal(q1.refs[0].url, "https://www.inrs.fr/media.html?refINRS=TF+255");

  assert.equal(q2.format, "QCM");
  assert.deepEqual(q2.options.map((o) => o.vrai), [false, true, false]);
  assert.equal(q2.corrigeDetecte, true);

  assert.equal(q3.format, "QIM");
  assert.deepEqual(q3.options.map((o) => o.vrai), [true, true, false, true, false]);

  assert.equal(q4.corrigeDetecte, false);
  assert.deepEqual(q4.options.map((o) => o.vrai), [false, false]);
  assert.ok(q4.avertissements.some((a) => a.includes("Aucun corrigé")));

  assert.equal(s1.format, "SCH");
  assert.equal(s1.imageNom, "isolateur-coupe.png");
  assert.equal(s1.numeroSchema, 1);
  assert.equal(s1.legendes.length, 3);
  assert.deepEqual(s1.legendes[0].repere, { x: 39, y: 26.5, cache: { x: 32, y: 24, w: 14, h: 5 } });
  assert.deepEqual(s1.legendes[1].repere, { x: 58, y: 19 });
  assert.equal(s1.legendes[2].attendu, "gant");
  assert.ok(s1.avertissements.some((a) => a.includes("sans coordonnées")));
});

test("le format par défaut s'applique sans mot-clé", () => {
  const r = analyserTexte("1. Énoncé\nA. x (V)\nB. y (F)", { formatDefaut: "QIM" });
  assert.equal(r.questions[0].format, "QIM");
});

test("un bloc à une seule proposition est ignoré, avec avertissement", () => {
  const r = analyserTexte("1. Énoncé\nA. seule", { formatDefaut: "QCM" });
  assert.equal(r.questions.length, 0);
  assert.ok(r.avertissements.length >= 1);
});

test("JSON : export du site et banque 3.0 du pipeline", () => {
  const site = JSON.stringify([
    { format: "QCM", enonce: "E", options: [{ texte: "a", vrai: true }, { texte: "b", vrai: false }], justification: "j" },
  ]);
  const r1 = analyserTexte(site, { formatDefaut: "QIM" });
  assert.equal(r1.questions.length, 1);
  assert.equal(r1.questions[0].format, "QCM");
  assert.deepEqual(r1.questions[0].options.map((o) => o.vrai), [true, false]);

  const pipeline = JSON.stringify({
    schema_version: "3.0",
    items: [
      {
        format: "QIM",
        enonce: "P",
        propositions: [
          { texte: "x", verdict: true, justification: "ok" },
          { texte: "y", verdict: false },
        ],
      },
    ],
  });
  const r2 = analyserTexte(pipeline, { formatDefaut: "QCM" });
  assert.equal(r2.questions[0].format, "QIM");
  assert.deepEqual(r2.questions[0].options.map((o) => o.vrai), [true, false]);
});

test("lireReference découpe « Source — Libellé — Date — URL »", () => {
  const r = lireReference("ANSM — BPP 2023 — 21/07/2023 — https://ansm.sante.fr/x — LD 1");
  assert.deepEqual(r, { source: "ANSM", libelle: "BPP 2023", date: "21/07/2023", url: "https://ansm.sante.fr/x", localisation: "LD 1" });
});

// ── Verdict en fin de proposition : un jeton séparé (défaut corrigé le 22/09/2026)

test("un mot finissant par f ou v n'est jamais lu comme un verdict", () => {
  const r = analyserTexte(
    "QIM 1. Contrôle.\nA. Le test de contamination est positif\nB. Le traitement est curatif\nC. Le filtre est neuf\nD. La hotte est en surpression\nRéponses : A C",
    { formatDefaut: "QIM" },
  );
  const [q] = r.questions;
  assert.deepEqual(
    q.options.map((o) => o.texte),
    ["Le test de contamination est positif", "Le traitement est curatif", "Le filtre est neuf", "La hotte est en surpression"],
    "aucune lettre finale amputée",
  );
  assert.deepEqual(q.options.map((o) => o.vrai), [true, false, true, false]);
});

test("sans marqueur ni ligne Réponses, une proposition reste sans verdict, et le dit", () => {
  const [q] = analyserTexte("QIM 1. x\nA. Le test est négatif\nB. Autre proposition (V)", { formatDefaut: "QIM" }).questions;
  assert.equal(q.options[0].texte, "Le test est négatif");
  assert.equal(q.corrigeDetecte, false);
  assert.match(q.avertissements.join(" "), /sans verdict/);
});

test("les marqueurs reconnus restent reconnus : (V), [F], Vrai, V isolé", () => {
  const [q] = analyserTexte("QIM 1. x\nA. Un (V)\nB. Deux [F]\nC. Trois Vrai\nD. Quatre F", { formatDefaut: "QIM" }).questions;
  assert.deepEqual(q.options.map((o) => [o.texte, o.vrai]), [["Un", true], ["Deux", false], ["Trois", true], ["Quatre", false]]);
});

// ── Lignes du prompt de génération

test("« Extrait X » sous sa proposition va dans la justification, jamais dans la proposition", () => {
  const [q] = analyserTexte(
    "QIM 1. Thème.\nA. Première\nExtrait A : « phrase une »\nB. Seconde\nExtrait B : « phrase deux »\nRéponses : A",
    { formatDefaut: "QIM" },
  ).questions;
  assert.deepEqual(q.options.map((o) => o.texte), ["Première", "Seconde"]);
  assert.equal(q.justification, "A : « phrase une » ; B : « phrase deux ».");
});

test("« Réponses vraies : aucune » et « Réponses vraies : A B » se lisent comme « Réponses : »", () => {
  const [aucune] = analyserTexte("QIM 1. x\nA. Un\nB. Deux\nRéponses vraies : aucune", { formatDefaut: "QIM" }).questions;
  assert.ok(aucune.corrigeDetecte);
  assert.equal(aucune.options.some((o) => o.vrai), false);
  const [deux] = analyserTexte("QIM 1. x\nA. Un\nB. Deux\nC. Trois\nRéponses vraies : A C", { formatDefaut: "QIM" }).questions;
  assert.deepEqual(deux.options.map((o) => o.vrai), [true, false, true]);
});

test("extrait sans proposition, proposition sans extrait : signalés au relecteur", () => {
  const [q] = analyserTexte(
    "QIM 1. x\nA. Un\nExtrait A : « a »\nB. Deux\nExtrait D : « d »\nRéponses : A",
    { formatDefaut: "QIM" },
  ).questions;
  const av = q.avertissements.join(" ");
  assert.match(av, /Extrait sans proposition : D/);
  assert.match(av, /Proposition B sans extrait/);
});

test("pièges et difficulté vont à la justification, après les extraits", () => {
  const [q] = analyserTexte(
    "QCM 1. x (plusieurs réponses possibles)\nA. Un\nExtrait A : « a »\nB. Deux\nExtrait B : « b »\nRéponses : A B\nPièges : aucun\nDifficulté : Avancé",
    { formatDefaut: "QCM" },
  ).questions;
  assert.equal(q.justification, "A : « a » ; B : « b ». Pièges : aucun. Difficulté : avancé.");
});
