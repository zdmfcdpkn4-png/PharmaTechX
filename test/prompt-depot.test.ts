import test from "node:test";
import assert from "node:assert/strict";
import { EXEMPLE_DEPOT, PROMPT_DEPOT } from "../content/prompt-depot";
import { analyserTexte } from "../lib/import-questions";

/*
 * Le prompt décrit un format ; l'analyseur en lit un autre s'ils divergent.
 * On passe donc l'exemple du prompt dans l'analyseur réel : toute dérive de
 * l'un par rapport à l'autre tombe ici.
 */
test("l'exemple du prompt est lu par l'analyseur du dépôt", () => {
  const r = analyserTexte(EXEMPLE_DEPOT, { formatDefaut: "QCM" });
  assert.deepEqual(
    r.questions.map((q) => q.format),
    ["QCM", "QIM", "QCM", "SCH", "ORD", "TAT"],
    "six questions, dans l'ordre de l'exemple",
  );

  const [qcm, qim, illustre, schema, sequence, trous] = r.questions;

  assert.equal(qcm.options.length, 4);
  assert.deepEqual(
    qcm.options.filter((o) => o.vrai).map((o) => o.id),
    ["a", "c"],
    "le corrigé « Réponses : A C » est lu",
  );
  assert.ok(qcm.corrigeDetecte, "corrigé complet");
  assert.ok(qcm.eliminatoire, "« Éliminatoire : oui » est lu");
  assert.ok(qcm.reservee, "« Réservée à l'évaluation : oui » est lu");
  assert.equal(qcm.refs.length, 1, "une source lue");
  assert.match(qcm.justification, /après la correction/);

  assert.equal(qim.options.length, 3);
  assert.deepEqual(qim.options.map((o) => o.vrai), [true, false, true]);

  assert.equal(illustre.imageNom, "sas-habillage.jpg", "l'illustration d'un QCM est lue");
  assert.equal(illustre.options.length, 3);

  assert.equal(schema.legendes.length, 2);
  assert.equal(schema.imageNom, "isolateur-coupe.png");
  assert.equal(schema.legendes[1].attendu, "filtre HEPA | filtre terminal");

  assert.deepEqual(
    sequence.options.map((o) => o.texte),
    ["Hygiène des mains", "Surchaussures", "Combinaison"],
    "les étapes sont lues dans l'ordre juste",
  );
  assert.ok(sequence.options.every((o) => o.vrai), "toutes les étapes comptent, c'est l'ordre qui est jugé");

  assert.equal(trous.enonce.includes("{1}"), true, "les marques de trou restent dans l'énoncé");
  assert.deepEqual(
    trous.options.filter((o) => o.vrai).map((o) => o.texte),
    ["transfert", "zone à atmosphère contrôlée"],
    "les vignettes attendues suivent l'ordre des trous",
  );
  assert.deepEqual(
    trous.options.filter((o) => !o.vrai).map((o) => o.texte),
    ["couloir", "décontamination"],
    "les leurres viennent ensuite",
  );

  assert.equal(r.avertissements.length, 0, "aucun avertissement sur l'exemple de référence");
});

test("le prompt porte l'exemple et interdit d'inventer", () => {
  assert.ok(PROMPT_DEPOT.includes(EXEMPLE_DEPOT), "l'exemple est repris dans le prompt");
  assert.match(PROMPT_DEPOT, /N'invente rien/);
  assert.match(PROMPT_DEPOT, /\[à vérifier\]/);
  assert.match(PROMPT_DEPOT, /TEXTE SOURCE/);
});

// ─────────────────────────── Prompt de génération à partir d'un document

import { EXEMPLE_GENERATION, promptGeneration } from "../content/prompt-depot";

for (const type of ["QIM", "QCM"] as const) {
  test(`génération ${type} : l'exemple du prompt est lu sans avertissement`, () => {
    const r = analyserTexte(EXEMPLE_GENERATION[type], { formatDefaut: type });
    assert.equal(r.questions.length, 2);
    assert.deepEqual(r.avertissements, []);
    for (const q of r.questions) {
      assert.equal(q.format, type);
      assert.equal(q.options.length, 5, "cinq propositions, A à E");
      assert.ok(q.corrigeDetecte, "corrigé lu sur la ligne Réponses");
      assert.deepEqual(q.avertissements, [], `aucun avertissement : ${q.enonce.slice(0, 40)}`);
      assert.equal(
        q.options.some((o) => /Extrait|«/.test(o.texte)),
        false,
        "aucun extrait n'est collé au texte d'une proposition",
      );
      assert.match(q.justification, /^A : « .+ » ; B : « .+ » ; C : « .+ » ; D : « .+ » ; E : « .+ »\./, "extraits dans l'ordre des lettres");
      assert.match(q.justification, /Pièges : .+\. Difficulté : (base|intermédiaire|avancé)\.$/);
      assert.equal(q.refs.length, 1, "source lue");
    }
  });

  test(`génération ${type} : le prompt porte la répartition du modèle et les règles du site`, () => {
    const p = promptGeneration(type);
    assert.ok(p.includes(`écris 10 questions de type ${type}`));
    assert.ok(p.includes("environ 3, 4 et 3"), "trois niveaux de difficulté");
    assert.ok(p.includes("N'invente rien"));
    assert.ok(p.includes("Réponses : aucune"));
    assert.ok(p.includes("N'écris ni « (V) » ni « (F) »"));
    assert.ok(p.includes("N'écris ni « Éliminatoire » ni « Réservée à l'évaluation »"));
    assert.ok(p.includes(EXEMPLE_GENERATION[type]), "l'exemple testé est celui du prompt");
  });
}

test("génération QIM : une question sans aucune vraie se lit « Réponses : aucune »", () => {
  const [, seconde] = analyserTexte(EXEMPLE_GENERATION.QIM, { formatDefaut: "QIM" }).questions;
  assert.equal(seconde.options.some((o) => o.vrai), false);
  assert.ok(seconde.corrigeDetecte);
});

test("génération QCM : tout énoncé porte « plusieurs », sinon le site afficherait des boutons radio", () => {
  for (const q of analyserTexte(EXEMPLE_GENERATION.QCM, { formatDefaut: "QCM" }).questions) {
    assert.match(q.enonce, /plusieurs réponses possibles/);
  }
  assert.ok(promptGeneration("QCM").includes("figure sur TOUTES les questions"));
});

test("génération QCM : « lesquelles sont fausses ? » — les lettres à cocher sont les fausses", () => {
  const [, fausses] = analyserTexte(EXEMPLE_GENERATION.QCM, { formatDefaut: "QCM" }).questions;
  assert.match(fausses.enonce, /lesquelles sont fausses/);
  assert.deepEqual(fausses.options.filter((o) => o.vrai).map((o) => o.id), ["a", "c"]);
  assert.match(fausses.justification, /Pièges : A valeur modifiée, C restriction\./);
});
