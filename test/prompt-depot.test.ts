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
    ["QCM", "QIM", "QCM", "SCH"],
    "quatre questions, dans l'ordre de l'exemple",
  );

  const [qcm, qim, illustre, schema] = r.questions;

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

  assert.equal(r.avertissements.length, 0, "aucun avertissement sur l'exemple de référence");
});

test("le prompt porte l'exemple et interdit d'inventer", () => {
  assert.ok(PROMPT_DEPOT.includes(EXEMPLE_DEPOT), "l'exemple est repris dans le prompt");
  assert.match(PROMPT_DEPOT, /N'invente rien/);
  assert.match(PROMPT_DEPOT, /\[à vérifier\]/);
  assert.match(PROMPT_DEPOT, /TEXTE SOURCE/);
});
