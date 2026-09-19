import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readdirSync } from "node:fs";
import {
  ILLUSTRATIONS,
  NOMS_ILLUSTRATION,
  NOMS_PICTOGRAMME,
  SANS_BADGE,
  badgeEffectif,
  badgeSuggere,
} from "../content/badges";

test("chaque illustration a son fichier, et chaque fichier son entrée", () => {
  for (const n of NOMS_ILLUSTRATION) {
    assert.ok(existsSync(`public/badges/${ILLUSTRATIONS[n].fichier}`), `fichier manquant : ${n}`);
    assert.match(ILLUSTRATIONS[n].fichier, /^[a-z0-9-]+\.webp$/, n);
    assert.ok(ILLUSTRATIONS[n].libelle.length > 2, n);
  }
  // un fichier orphelin dans public/badges resterait invisible : c'est une
  // erreur de dépôt, pas un choix
  const fichiers = readdirSync("public/badges").filter((f) => f.endsWith(".webp"));
  const declares = new Set(NOMS_ILLUSTRATION.map((n) => ILLUSTRATIONS[n].fichier));
  for (const f of fichiers) assert.ok(declares.has(f), `fichier non déclaré : ${f}`);
  assert.equal(fichiers.length, NOMS_ILLUSTRATION.length);
});

test("les deux familles ne partagent aucun identifiant", () => {
  // Une collision ferait taire silencieusement l'un des deux dessins : la
  // banque complète est un seul objet, la seconde entrée écraserait la première.
  const picto = new Set<string>(NOMS_PICTOGRAMME);
  for (const n of NOMS_ILLUSTRATION) assert.ok(!picto.has(n), `identifiant déjà pris : ${n}`);
  assert.equal(new Set([...NOMS_PICTOGRAMME, ...NOMS_ILLUSTRATION]).size, NOMS_PICTOGRAMME.length + NOMS_ILLUSTRATION.length);
});

test("aucun identifiant ne vaut le marqueur « aucun »", () => {
  assert.ok(!NOMS_ILLUSTRATION.includes(SANS_BADGE));
  assert.ok(!(NOMS_PICTOGRAMME as readonly string[]).includes(SANS_BADGE));
});

test("proposition d'après le titre : le plus spécifique l'emporte", () => {
  assert.equal(badgeSuggere("Qualification de l'autoclave"), "autoclave");
  assert.equal(badgeSuggere("Stérilisation en place (SIP) de la cuve"), "sterilisation-sip");
  assert.equal(badgeSuggere("Comportement en ZAC"), "zone-sterile");
  assert.equal(badgeSuggere("Protection de l'opérateur — cytotoxiques"), "habillage-sterile");
  assert.equal(badgeSuggere("Préparation des chimiothérapies en isolateur"), "preparation-isolateur");
  assert.equal(badgeSuggere("Élimination des déchets cytotoxiques"), "dechets-chimiques");
  assert.equal(badgeSuggere("Pesée gravimétrique des matières premières"), "matieres-premieres");
  assert.equal(badgeSuggere("Contrôle de la chaîne du froid"), "chaine-du-froid");
  // accents et casse indifférents
  assert.equal(badgeSuggere("ETIQUETAGE DES PREPARATIONS"), "etiquetage");
  assert.equal(badgeSuggere("Étiquetage des préparations"), "etiquetage");
  // l'objectif complète le titre
  assert.equal(badgeSuggere("Module 4", "Savoir réaliser un essai de stérilité."), "sterilite-microbiologique");
});

test("rien n'est proposé quand aucun mot ne correspond", () => {
  assert.equal(badgeSuggere("Module 12"), undefined);
  assert.equal(badgeSuggere(""), undefined);
});

test("toute proposition désigne une illustration existante", () => {
  const titres = [
    "autoclave", "stérilisation SIP", "eau PPI", "déchets", "chromatographie", "dossier de lot",
    "étiquetage", "chaîne du froid", "transport", "stockage", "nettoyage CIP", "habillage",
    "particules", "ISO 5", "gélose", "stérilité", "hotte", "pesée", "isolateur", "ZAC",
  ];
  for (const t of titres) {
    const b = badgeSuggere(t);
    assert.ok(b && NOMS_ILLUSTRATION.includes(b), `${t} -> ${b}`);
  }
});

test("badgeEffectif : choix enregistré, refus explicite, proposition", () => {
  assert.equal(badgeEffectif("autoclave", "Comportement en ZAC"), "autoclave", "le choix prime sur la proposition");
  assert.equal(badgeEffectif(SANS_BADGE, "Comportement en ZAC"), undefined, "refus explicite");
  assert.equal(badgeEffectif("", "Comportement en ZAC"), "zone-sterile", "jamais renseigné : proposition");
  assert.equal(badgeEffectif(null, "Comportement en ZAC"), "zone-sterile");
  assert.equal(badgeEffectif(undefined, "Module 12"), undefined);
  assert.equal(badgeEffectif("  ", "Module 12"), undefined);
});
