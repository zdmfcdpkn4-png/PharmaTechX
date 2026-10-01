import { test } from "node:test";
import assert from "node:assert/strict";
import { lireDocx, lireOctets, relationsImages, xmlEnTexte } from "../lib/docx";
import { analyserTexte } from "../lib/import-questions";
import { zip } from "../lib/zip";

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

// ─────────────────────────────────────────── images collées (question 84, choix a)

const PNG_A = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const PNG_REPLI = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 9, 9, 9]);
const JPEG_B = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 4, 5, 6]);
const PNG_C = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 7, 8]);

const p = (...runs: string[]) => `<w:p>${runs.join("")}</w:p>`;
const t = (texte: string) => `<w:r><w:t xml:space="preserve">${texte}</w:t></w:r>`;
const dessin = (rId: string) =>
  `<w:r><w:drawing><wp:inline><wp:extent cx="1" cy="1"/><a:graphic><a:graphicData><pic:pic><pic:blipFill><a:blip r:embed="${rId}"/></pic:blipFill></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;

/** Un .docx d'essai : trois questions, cinq dessins, une version de repli, un graphique. */
function docxDEssai(): Buffer {
  const document =
    "<w:document><w:body>" +
    p(t("QCM 1. Lesquelles ? (plusieurs réponses possibles)")) +
    // Image et sa version de repli pour les lecteurs anciens : une seule image.
    p(
      `<w:r><mc:AlternateContent><mc:Choice Requires="wps">${dessin("rId4").replace(/^<w:r>|<\/w:r>$/g, "")}</mc:Choice>` +
        `<mc:Fallback><w:pict><v:shape><v:imagedata r:id="rId5"/></v:shape></w:pict></mc:Fallback></mc:AlternateContent></w:r>`,
      t("Description de l'image : un sas, vu de face."),
    ) +
    p(t("A. x")) +
    p(t("B. y")) +
    p(t("Réponses : A")) +
    p(t("QCM 2. Laquelle ?")) +
    // « Image : » seule, puis deux images dans le même paragraphe.
    p(t("Image : "), dessin("rId6"), t(" "), dessin("rId7")) +
    p(t("A. x")) +
    p(t("B. y")) +
    p(t("Réponses : B")) +
    // Un graphique : un dessin sans image.
    p(`<w:r><w:drawing><c:chart r:id="rId9"/></w:drawing></w:r>`) +
    // Image au format VML, la même que la seconde de la question 2.
    p(t("QCM 3. Encore ?"), `<w:r><w:pict><v:shape><v:imagedata r:id="rId7"/></v:shape></w:pict></w:r>`) +
    p(t("A. x")) +
    p(t("B. y")) +
    p(t("Réponses : A")) +
    "</w:body></w:document>";
  const relations =
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image1.png"/>' +
    '<Relationship Id="rId5" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image2.png"/>' +
    '<Relationship Id="rId6" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image3.jpeg"/>' +
    '<Relationship Id="rId7" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image4.png"/>' +
    '<Relationship Id="rId8" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="https://exemple.org/x.png" TargetMode="External"/>' +
    '<Relationship Id="rId9" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="charts/chart1.xml"/>' +
    "</Relationships>";
  return zip([
    { nom: "word/document.xml", contenu: document },
    { nom: "word/_rels/document.xml.rels", contenu: relations },
    { nom: "word/media/image1.png", contenu: PNG_A },
    { nom: "word/media/image2.png", contenu: PNG_REPLI },
    { nom: "word/media/image3.jpeg", contenu: JPEG_B },
    { nom: "word/media/image4.png", contenu: PNG_C },
  ]);
}

test("relations : les images du document, sans les liens externes ni les graphiques", () => {
  const r = relationsImages(
    '<Relationship Id="rId4" Type="http://x/relationships/image" Target="media/image1.png"/>' +
      '<Relationship Target="/word/media/image9.gif" Id="rId5" Type="http://x/relationships/image"/>' +
      '<Relationship Id="rId8" Type="http://x/relationships/image" Target="https://exemple.org/x.png" TargetMode="External"/>' +
      '<Relationship Id="rId9" Type="http://x/relationships/chart" Target="charts/chart1.xml"/>',
  );
  assert.deepEqual([...r], [
    ["rId4", "word/media/image1.png"],
    ["rId5", "word/media/image9.gif"],
  ]);
});

test("images collées : une ligne « Image : » à leur place, la version de repli écartée", () => {
  const docx = docxDEssai();
  const { texte, images } = lireDocx(docx);
  assert.deepEqual(images, [
    { nom: "image-collee-1.png", chemin: "word/media/image1.png" },
    { nom: "image-collee-2.jpeg", chemin: "word/media/image3.jpeg" },
    { nom: "image-collee-3.png", chemin: "word/media/image4.png" },
    { nom: "image-collee-4.png", chemin: "word/media/image4.png" },
  ]);
  assert.match(texte, /^QCM 1\. Lesquelles \? \(plusieurs réponses possibles\)\nImage : image-collee-1\.png\nDescription de l'image : un sas, vu de face\.\n/);
  assert.match(texte, /Image :\s*\nImage : image-collee-2\.jpeg\n\s*\nImage : image-collee-3\.png/);
  assert.ok(!texte.includes("image2.png"), "la version de repli n'est pas comptée");
  assert.deepEqual(lireOctets(docx, "word/media/image3.jpeg"), JPEG_B, "les octets de l'image se relisent");
});

test("images collées lues par l'analyseur : la première de chaque question, les autres signalées", () => {
  const { texte } = lireDocx(docxDEssai());
  const r = analyserTexte(texte, { formatDefaut: "QCM" });
  assert.deepEqual(r.questions.map((q) => q.imageNom), ["image-collee-1.png", "image-collee-2.jpeg", "image-collee-4.png"]);
  assert.equal(r.questions[0].imageAlt, "un sas, vu de face.");
  assert.deepEqual(r.questions[0].avertissements, []);
  assert.deepEqual(r.questions[1].avertissements, [
    "Une question ne porte qu'une image : « image-collee-2.jpeg » est gardée, « image-collee-3.png » écartée. Pour les montrer ensemble, assemblez-les en une seule image avant le dépôt.",
  ]);
  assert.equal(r.questions[1].enonce, "Laquelle ?", "la ligne « Image : » seule ne se colle pas à l'énoncé");
  assert.deepEqual(r.avertissements, []);
});
