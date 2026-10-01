import { test } from "node:test";
import assert from "node:assert/strict";
import { xmlEnTexte } from "../lib/docx";
import { analyserTexte } from "../lib/import-questions";

test("un saut de ligne dans un paragraphe Word (Maj + Entrée) commence une ligne", () => {
  // Une question entière dans un seul paragraphe, comme dans une banque fournie le 01/10/2026.
  const xml =
    "<w:document><w:body>" +
    "<w:p><w:r><w:t>QIM 1. Indiquez si les propositions suivantes sont vraies ou fausses.</w:t></w:r>" +
    "<w:r><w:br/><w:t>A. x</w:t></w:r><w:r><w:br/><w:t>B. y</w:t></w:r><w:r><w:cr/><w:t>Réponses : A</w:t></w:r></w:p>" +
    '<w:p><w:r><w:t xml:space="preserve">Niveau : initial</w:t><w:tab/><w:t>&amp; suite</w:t></w:r></w:p>' +
    "</w:body></w:document>";
  const texte = xmlEnTexte(xml);
  assert.equal(
    texte,
    "QIM 1. Indiquez si les propositions suivantes sont vraies ou fausses.\nA. x\nB. y\nRéponses : A\nNiveau : initial\t& suite",
  );
  const r = analyserTexte(texte, { formatDefaut: "QCM" });
  assert.equal(r.questions.length, 1, "la question n'est plus ignorée");
  assert.deepEqual(r.questions[0].options.map((o) => o.vrai), [true, false]);
});
