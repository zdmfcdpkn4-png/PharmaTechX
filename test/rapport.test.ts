import { test } from "node:test";
import assert from "node:assert/strict";
import { construireRapport, nomFichierRapport, type ResultatRapport } from "../lib/rapport";

const resultat: ResultatRapport = {
  moduleId: "comportement-zac",
  moduleTitre: "Comportement et habillage en ZAC",
  critereId: "B1-01",
  seuilReussite: 80,
  pointsObtenus: 7.5,
  pointsTotal: 9,
  score: 83,
  echecEliminatoire: false,
  reussi: true,
  horodatage: "18 septembre 2026 à 14:02",
  horodatageIso: "2026-09-18T12:02:00.000Z",
  tirage: "Habilitation · 9 questions",
  jeton: "x",
  tentative: 1,
  detail: [
    {
      questionId: "q1", enonce: "Énoncé <b>", type: "QCM", situation: null, note: 1, discordances: 0, nonJugees: 0,
      correct: true, eliminatoire: true, choixApprenant: ["B"], reponsesAttendues: ["B"], justification: "Parce que.", sources: ["ANSM — BPP"],
    },
    {
      questionId: "q2", enonce: "Schéma", type: "SCH", situation: null, note: 0.5, discordances: 1, nonJugees: 0,
      correct: false, eliminatoire: false, choixApprenant: ["1 → sas"], reponsesAttendues: ["1 → sas de transfert"], justification: "", sources: [],
      legendes: [{ numero: 1, reponse: "sas", attendu: "sas de transfert", verdict: "fausse" }],
    },
  ],
};

test("le rapport A4 porte verdict, visas, synthèse, détail et échappe le HTML", () => {
  const html = construireRapport({ nom: "A. Test", qualite: "Préparateur", parcours: "Intégration" }, [resultat], {
    numero: "RAP-2026-0001",
    empreinte: "abcdef0123456789",
    visas: [{ qualite: "apprenant", nom: "A. Test", date: "18/09/2026" }],
    conservation: "nominative",
  });
  assert.ok(html.includes("Critère acquis pour cette évaluation"));
  assert.ok(html.includes("RAP-2026-0001"));
  assert.ok(html.includes("Énoncé &lt;b&gt;"));
  assert.ok(!html.includes("Énoncé <b>"));
  assert.ok(html.includes("visa électronique"));
  assert.ok(html.includes("Pharmacien responsable"));
  assert.ok(html.includes("Ce rapport ne vaut pas habilitation"));
  assert.ok(html.includes("sas de transfert"));
  assert.ok(html.includes("7,5 / 9 points"));
  assert.ok(html.includes("[à préciser]"));
});

test("sans conservation, l'identification se complète à la main", () => {
  const html = construireRapport({ nom: "", qualite: "", parcours: "" }, [resultat]);
  assert.ok(html.includes("à renseigner par l'apprenant"));
  assert.ok(html.includes("Aucun résultat n'est conservé"));
});

test("nom de fichier sûr", () => {
  assert.match(nomFichierRapport("Éloïse D'Été", "RAP-2026-0002"), /^rapport-evaluation-rap-2026-0002-eloise-d-ete-\d{4}-\d{2}-\d{2}\.html$/);
});
