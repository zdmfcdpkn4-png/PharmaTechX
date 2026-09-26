import { test } from "node:test";
import assert from "node:assert/strict";
import {
  LIBELLES_NIVEAU_QUESTION,
  LIBELLES_PLAFOND,
  NOMS_NIVEAUX_DEFAUT,
  compteDeNiveau,
  libellesClassiques,
  libellesDe,
  nomDansPhrase,
  nomsEnDouble,
  normaliserNomsNiveaux,
  plafondCourt,
  plafondEnPhrase,
  sontLesNomsDefaut,
} from "../content/niveaux-questions";
import { libelleCible, type CibleScellee } from "../content/cible";
import { BAREME_DEFAUT, resumeBareme } from "../content/bareme";

const RENOMMES = { initial: "Base", intermediaire: "Reformulation", avance: "Expert" };

test("niveaux des questions : sans réglage, les noms d'origine (question 81)", () => {
  const n = normaliserNomsNiveaux(undefined);
  assert.deepEqual(n, NOMS_NIVEAUX_DEFAUT);
  assert.equal(sontLesNomsDefaut(n), true);
  assert.deepEqual(libellesDe(n), LIBELLES_NIVEAU_QUESTION);
});

test("un nom vidé reprend sa valeur d'origine ; les espaces se resserrent et la longueur est bornée", () => {
  const n = normaliserNomsNiveaux({
    initial: { libelle: "  Base   restitution ", definition: "" },
    intermediaire: { libelle: "" },
    avance: { libelle: "x".repeat(80), definition: 42 },
  });
  assert.equal(n.initial.libelle, "Base restitution");
  assert.equal(n.initial.definition, NOMS_NIVEAUX_DEFAUT.initial.definition);
  assert.equal(n.intermediaire.libelle, "Intermédiaire");
  assert.equal(n.avance.libelle.length, 40);
  assert.equal(n.avance.definition, NOMS_NIVEAUX_DEFAUT.avance.definition);
  assert.equal(sontLesNomsDefaut(n), false);
});

test("deux niveaux au même nom, casse et accents mis à part, sont refusés", () => {
  assert.equal(nomsEnDouble(RENOMMES), false);
  assert.equal(nomsEnDouble({ initial: "Avance", intermediaire: "Intermédiaire", avance: "avancé" }), true);
});

test("noms d'origine : les phrases gardent leur tournure", () => {
  assert.equal(libellesClassiques(LIBELLES_NIVEAU_QUESTION), true);
  assert.equal(plafondEnPhrase("intermediaire"), LIBELLES_PLAFOND.intermediaire);
  assert.equal(plafondCourt("initial"), "Initiales seulement");
  assert.equal(nomDansPhrase("avance"), "avancé");
  assert.equal(compteDeNiveau("initial", 4), "4 initiales");
  assert.equal(compteDeNiveau("intermediaire", 1), "1 intermédiaire");
  assert.equal(compteDeNiveau("a_preciser", 2), "2 sans niveau");
});

test("noms changés : chaque niveau cité par son nom, sans accord à deviner", () => {
  assert.equal(libellesClassiques(RENOMMES), false);
  assert.equal(plafondEnPhrase("initial", RENOMMES), "questions de niveau « Base » seulement");
  assert.equal(plafondEnPhrase("intermediaire", RENOMMES), "questions de niveau « Base » et « Reformulation »");
  assert.equal(plafondEnPhrase("avance", RENOMMES), "questions de tous niveaux");
  assert.equal(plafondCourt("intermediaire", RENOMMES), "« Base » et « Reformulation »");
  assert.equal(compteDeNiveau("avance", 3, RENOMMES), "3 de niveau « Expert »");
  // un seul nom changé suffit : toutes les phrases passent à la forme citée
  const un = { ...LIBELLES_NIVEAU_QUESTION, initial: "Base" };
  assert.equal(nomDansPhrase("intermediaire", un), "« Intermédiaire »");
});

test("rapport : il se relit avec les noms scellés, même renommés depuis", () => {
  const base: CibleScellee = {
    niveau: "N2",
    plafond: "intermediaire",
    parNiveau: { initial: 4, intermediaire: 6, avance: 0, a_preciser: 0 },
    obligatoires: 0,
    ecartees: [],
  };
  // résultat antérieur ou émis sous les noms d'origine : aucune copie, lecture d'origine
  assert.equal(
    libelleCible(base),
    "Niveau cible N2 : questions initiales et intermédiaires. Posées : 4 initiales, 6 intermédiaires.",
  );
  assert.equal(
    libelleCible({ ...base, noms: RENOMMES }),
    "Niveau cible N2 : questions de niveau « Base » et « Reformulation ». Posées : 4 de niveau « Base », 6 de niveau « Reformulation ».",
  );
});

test("barème en vigueur : les répartitions citent les noms en vigueur", () => {
  const lignes = resumeBareme(BAREME_DEFAUT, RENOMMES);
  assert.match(lignes.at(-1)!, /« Base » 43 %, « Reformulation » 57 %/);
  assert.match(resumeBareme(BAREME_DEFAUT).at(-1)!, /initial 43 %, intermédiaire 57 %/);
});
