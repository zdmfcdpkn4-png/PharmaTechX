import { test } from "node:test";
import assert from "node:assert/strict";
import {
  appliquerReglage,
  ecartsDeLaFiche,
  listeConnue,
  niveauxConnus,
  parcoursConnus,
  reglageVide,
} from "../content/reglages";
import type { Module } from "../content/types";

/** Critère tel que la fiche d'habilitation le donne. */
const fiche: Module = {
  id: "critere-b1-02",
  titre: "Préparer une chimiothérapie en isolateur",
  objectif: "Maîtriser le critère B1-02.",
  bloc: 2,
  affectation: "poste",
  critereId: "B1-02",
  postes: ["chimiotherapie"],
  niveaux: ["N1c", "N2"],
  parcours: ["integration", "maintien"],
  dureeMinutes: 0,
  redige: false,
  sections: [],
  ressources: [],
  questions: [],
  misesEnSituation: [],
  seuilReussite: 80,
  periodiciteMois: 24,
  bibliographie: [],
};

test("sans réglage, la fiche fait foi ; le seuil est celui du barème", () => {
  assert.deepEqual(appliquerReglage(fiche, undefined, 85), { ...fiche, seuilReussite: 85 });
  assert.equal(
    appliquerReglage(fiche, undefined, 70).seuilReussite,
    70,
    "le seuil écrit dans le fichier du module n'est qu'un point de départ",
  );
});

test("le réglage remplace filières, niveaux, parcours et seuil", () => {
  const r = appliquerReglage(
    fiche,
    { seuil: 70, filieres: ["preparatoire"], niveaux: ["N1a"], parcours: ["maintien"] },
    85,
  );
  assert.equal(r.seuilReussite, 70);
  assert.deepEqual(r.postes, ["preparatoire"]);
  assert.deepEqual(r.niveaux, ["N1a"]);
  assert.deepEqual(r.parcours, ["maintien"]);
  assert.equal(r.affectation, "poste");
  assert.equal(r.titre, fiche.titre, "le texte du critère n'est jamais touché");
});

test("l'affectation suit les filières : le socle seul remet au tronc commun", () => {
  assert.equal(appliquerReglage(fiche, { filieres: ["socle"] }, 80).affectation, "tronc-commun");
  assert.equal(appliquerReglage(fiche, { filieres: ["socle", "chimiotherapie"] }, 80).affectation, "poste");
  const sansListe = appliquerReglage({ ...fiche, affectation: "tronc-commun" }, { seuil: 70 }, 80);
  assert.equal(sansListe.affectation, "tronc-commun", "sans liste réglée, l'affectation de la fiche est gardée");
});

test("une liste vide ou inconnue revient à la fiche", () => {
  const r = appliquerReglage(fiche, { filieres: null, niveaux: null, parcours: null, seuil: null }, 80);
  assert.deepEqual(r.postes, fiche.postes);
  assert.deepEqual(r.niveaux, fiche.niveaux);
  assert.deepEqual(r.parcours, fiche.parcours);
  assert.equal(r.seuilReussite, 80);
  assert.equal(listeConnue(["chimiotherapie", "inconnue"], ["chimiotherapie", "socle"])?.length, 1);
  assert.equal(listeConnue(["inconnue"], ["socle"]), null, "aucune valeur connue : la fiche");
  assert.equal(listeConnue("chimiotherapie", ["chimiotherapie"]), null, "une chaîne n'est pas une liste");
  assert.deepEqual(listeConnue(["socle", "socle"], ["socle"]), ["socle"], "dédoublonné");
  assert.deepEqual(parcoursConnus(["maintien", "autre"]), ["maintien"]);
  assert.equal(parcoursConnus([]), null);
  assert.deepEqual(niveauxConnus(["N2"], ["N1a", "N2"]), ["N2"]);
});

test("un réglage sans écart ne s'enregistre pas", () => {
  assert.equal(reglageVide({}), true);
  assert.equal(reglageVide({ seuil: null, filieres: null, niveaux: null, parcours: null }), true);
  assert.equal(reglageVide({ seuil: 70 }), false);
  assert.equal(reglageVide({ parcours: ["maintien"] }), false);
});

test("les écarts à la fiche sont nommés, et seulement les vrais écarts", () => {
  assert.deepEqual(ecartsDeLaFiche(fiche, undefined), []);
  assert.deepEqual(
    ecartsDeLaFiche(fiche, { filieres: ["chimiotherapie"], niveaux: ["N1c", "N2"], parcours: ["integration", "maintien"] }),
    [],
    "mêmes valeurs que la fiche : aucun écart",
  );
  const e = ecartsDeLaFiche(fiche, { seuil: 70, parcours: ["maintien"] });
  assert.equal(e.length, 2);
  assert.match(e[0], /70 %/);
  assert.match(e[1], /maintien/);
});
