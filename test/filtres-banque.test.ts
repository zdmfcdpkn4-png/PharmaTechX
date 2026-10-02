import { test } from "node:test";
import assert from "node:assert/strict";
import {
  lireTri,
  motsRecherche,
  normaliserRecherche,
  questionCorrespond,
  trierQuestions,
  type QuestionCherchable,
} from "../content/filtres-banque";

const Q: QuestionCherchable = {
  id: "q-AbC123",
  enonce: "Conduite à tenir en cas de bris de flacon sous isolateur ?",
  options: [
    { texte: "Alerter le pharmacien", justification: "Procédure de déversement accidentel." },
    { texte: "Continuer la préparation" },
  ],
  justification: "Voir la fiche réflexe « Bris de flacon ».",
  legendes: [],
};

test("recherche : sans casse ni accents, chaque mot quelque part dans la question", () => {
  assert.equal(normaliserRecherche("  Éthanol   À 70 %  "), "ethanol a 70 %");
  assert.deepEqual(motsRecherche("Bris  FLACON"), ["bris", "flacon"]);
  assert.equal(questionCorrespond(Q, motsRecherche("bris flacon")), true, "énoncé");
  assert.equal(questionCorrespond(Q, motsRecherche("deversement")), true, "justification d'une proposition, accents ignorés");
  assert.equal(questionCorrespond(Q, motsRecherche("fiche reflexe")), true, "justification de la question");
  assert.equal(questionCorrespond(Q, motsRecherche("q-abc123")), true, "identifiant, casse ignorée");
  assert.equal(questionCorrespond(Q, motsRecherche("bris hotte")), false, "tous les mots doivent y être");
  assert.equal(questionCorrespond(Q, []), true, "sans recherche, tout passe");
  const schema = { ...Q, enonce: "Légendez le sas.", options: [], justification: "", legendes: [{ attendu: "Surchaussures" }] };
  assert.equal(questionCorrespond(schema, motsRecherche("surchaussure")), true, "les mots attendus d'un schéma");
});

test("tri : l'ordre de dépôt par défaut, sinon dates ou énoncé, sans toucher à la liste", () => {
  const liste = [
    { id: "1", cree_le: "2026-10-01 21:44:00.12+00", edite_le: "2026-10-02 06:59:00+00", enonce: "Zone" },
    { id: "2", cree_le: "2026-10-01 21:44:00.5+00", edite_le: "2026-10-01 21:44:00.5+00", enonce: "étiquetage" },
    { id: "3", cree_le: "2026-09-30 08:00:00+00", edite_le: "2026-10-02 07:10:00+00", enonce: "Asepsie" },
  ];
  const ids = (l: { id: string }[]) => l.map((x) => x.id).join("");
  assert.equal(ids(trierQuestions(liste, "")), "123");
  assert.equal(ids(trierQuestions(liste, "recentes")), "213", "fractions de seconde comprises");
  assert.equal(ids(trierQuestions(liste, "modifiees")), "312");
  assert.equal(ids(trierQuestions(liste, "enonce")), "321", "sans casse ni accents");
  assert.equal(ids(liste), "123", "la liste reçue n'est pas réordonnée");
  assert.equal(lireTri("recentes"), "recentes");
  assert.equal(lireTri("n'importe"), "");
});
