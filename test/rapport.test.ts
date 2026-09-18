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
  verdict: "acquis",
  bande: 11.1,
  bandeBasse: 69,
  bandeHaute: 91,
  concluant: true,
  minQuestions: 9,
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
    decision: {
      decision: {
        nbQuestions: 2, nbExclues: 0, pointsObtenus: 1.5, pointsTotal: 2, score: 75, seuil: 80, bande: 50,
        bandeBasse: 30, bandeHaute: 100, echecEliminatoire: false, concluant: true, minQuestions: 2, verdictBrut: "acquis",
      },
      verdictFinal: "acquis",
    },
  });
  assert.ok(html.includes("Critère acquis pour cette évaluation"));
  assert.ok(html.includes("Bande de garde : 30 à 100 %"));
  assert.ok(html.includes("RAP-2026-0001"));
  assert.ok(html.includes("Énoncé &lt;b&gt;"));
  assert.ok(!html.includes("Énoncé <b>"));
  assert.ok(html.includes("visa électronique"));
  assert.ok(html.includes("Pharmacien responsable"));
  assert.ok(html.includes("Ce rapport ne vaut pas habilitation"));
  assert.ok(html.includes("sas de transfert"));
  assert.ok(html.includes("1,5 / 2 points"));
  assert.ok(html.includes("[à préciser]"));
});

test("sans conservation, l'identification se complète à la main et la décision se recalcule du résultat", () => {
  const html = construireRapport({ nom: "", qualite: "", parcours: "" }, [resultat]);
  assert.ok(html.includes("à renseigner par l'apprenant"));
  assert.ok(html.includes("Aucun résultat n'est conservé"));
  // Deux questions sur neuf requises : non concluant, recalculé sans exclusion.
  assert.ok(html.includes("Évaluation non concluante"));
  assert.ok(html.includes("Tirage non concluant : 9 questions requises."));
});

test("verdict arbitré, question exclue et signature incrustée", () => {
  const html = construireRapport({ nom: "A. Test", qualite: "", parcours: "" }, [resultat], {
    numero: "RAP-2026-0002",
    empreinte: "abcdef0123456789",
    visas: [
      { qualite: "apprenant", nom: "A. Test", date: "18/09/2026" },
      { qualite: "tuteur", nom: "T. Tuteur", date: "18/09/2026" },
      { qualite: "pharmacien", nom: "P. Pharma", date: "19/09/2026", signatureDataUri: "data:image/png;base64,AAAA" },
    ],
    conservation: "nominative",
    decision: {
      decision: {
        nbQuestions: 1, nbExclues: 1, pointsObtenus: 1, pointsTotal: 1, score: 100, seuil: 80, bande: 100,
        bandeBasse: 0, bandeHaute: 100, echecEliminatoire: false, concluant: true, minQuestions: 1, verdictBrut: "indetermine",
      },
      verdictFinal: "acquis",
      arbitrage: { verdict: "acquis", motif: "Maîtrise constatée <au poste>", nom: "T. Tuteur", date: "18/09/2026" },
      exclusions: [{ questionId: "q2", motif: "question retirée de la banque après signalement" }],
    },
  });
  assert.ok(html.includes("Arbitrage du tuteur : <strong>acquis</strong>"));
  assert.ok(html.includes("Maîtrise constatée &lt;au poste&gt;"));
  assert.ok(html.includes("Verdict brut : indéterminé"));
  assert.ok(html.includes("1 question exclue du calcul"));
  assert.ok(html.includes('class="exclue"'));
  assert.ok(html.includes('<img class="signature" src="data:image/png;base64,AAAA"'));
});

test("nom de fichier sûr", () => {
  assert.match(nomFichierRapport("Éloïse D'Été", "RAP-2026-0002"), /^rapport-evaluation-rap-2026-0002-eloise-d-ete-\d{4}-\d{2}-\d{2}\.html$/);
});
