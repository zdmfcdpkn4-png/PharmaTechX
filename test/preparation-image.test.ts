import test from "node:test";
import assert from "node:assert/strict";
import {
  aReencoder,
  bilanPreparation,
  COTE_MAX,
  dimensionsReduites,
  IMAGE_MAX_OCTETS,
  nomJpeg,
} from "../content/preparation-image";

/*
 * Préparation d'une image avant l'envoi (23/09/2026, reprise du quiz de
 * Flore) : ce qui décide, sans navigateur. Le ré-encodage lui-même est vérifié
 * par la chaîne de bout en bout.
 */

test("une photo de téléphone est ramenée à 2 000 px de côté, proportions gardées", () => {
  assert.deepEqual(dimensionsReduites(4032, 3024), { w: 2000, h: 1500 });
  assert.deepEqual(dimensionsReduites(3024, 4032), { w: 1500, h: 2000 });
  assert.deepEqual(dimensionsReduites(800, 600), { w: 800, h: 600 }, "jamais agrandie");
  assert.deepEqual(dimensionsReduites(10000, 3), { w: 2000, h: 1 }, "un côté ne tombe jamais à zéro");
  assert.equal(COTE_MAX, 2000);
});

test("une photo est toujours ré-encodée ; un PNG, seulement hors limites", () => {
  assert.equal(aReencoder("image/jpeg", 300_000, 1200, 900), true, "métadonnées (lieu, appareil, date) retirées");
  assert.equal(aReencoder("image/heic", 3_000_000, 4032, 3024), true);
  assert.equal(aReencoder("image/png", 300_000, 1200, 900), false, "un schéma au trait garde ses traits");
  assert.equal(aReencoder("image/png", IMAGE_MAX_OCTETS + 1, 1200, 900), true);
  assert.equal(aReencoder("image/png", 300_000, 2400, 900), true);
});

test("le fichier ré-encodé garde son nom, en .jpg : l'appariement ignore l'extension", () => {
  assert.equal(nomJpeg("sas-habillage.HEIC"), "sas-habillage.jpg");
  assert.equal(nomJpeg("IMG_0042.jpeg"), "IMG_0042.jpg");
  assert.equal(nomJpeg("sans-extension"), "sans-extension.jpg");
  assert.equal(nomJpeg(".png"), "image.jpg");
});

test("le bilan dit ce qui a été fait, en clair", () => {
  assert.equal(bilanPreparation([]), "");
  assert.equal(bilanPreparation([{ reencodee: false, avant: 100, apres: 100 }]), "1 image prête.");
  const b = bilanPreparation([
    { reencodee: true, avant: 4 * 1024 * 1024, apres: 1024 * 1024 },
    { reencodee: false, avant: 200_000, apres: 200_000 },
  ]);
  assert.equal(b, "2 images prêtes — 1 réduite (4 Mo → 1 Mo), métadonnées retirées.");
});
