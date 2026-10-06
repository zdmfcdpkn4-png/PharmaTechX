import { test } from "node:test";
import assert from "node:assert/strict";
import { imageDeLaLigne } from "../content/image-question";

// ── Image d'une question lue en base (06/10/2026) : elle part avec la question quel que soit son format.

test("imageDeLaLigne : une question illustrée garde son image, son format n'y est pour rien", () => {
  assert.deepEqual(
    imageDeLaLigne({ image_id: "imgEssai12345", image_largeur: 424, image_hauteur: 193, image_alt: "réglette graduée d'un manomètre" }),
    { id: "imgEssai12345", url: "/api/images/imgEssai12345", largeur: 424, hauteur: 193, alt: "réglette graduée d'un manomètre" },
  );
});

test("imageDeLaLigne : sans image en base, pas d'image", () => {
  assert.equal(imageDeLaLigne({ image_id: null, image_largeur: null, image_hauteur: null, image_alt: null }), undefined);
});

test("imageDeLaLigne : dimensions et description absentes valent 0 et vide, l'image s'affiche quand même", () => {
  assert.deepEqual(imageDeLaLigne({ image_id: "imgEssai67890", image_largeur: null, image_hauteur: null, image_alt: null }), {
    id: "imgEssai67890",
    url: "/api/images/imgEssai67890",
    largeur: 0,
    hauteur: 0,
    alt: "",
  });
});
