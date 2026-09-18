import { BAREME_DEFAUT } from "../content/bareme";
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
  bareme: BAREME_DEFAUT,
  horodatage: "18 septembre 2026 à 14:02",
  horodatageIso: "2026-09-18T12:02:00.000Z",
  tirage: "Habilitation · 9 questions",
  jeton: "x",
  tentative: 1,
  detail: [
    {
      questionId: "q1", enonce: "Énoncé <b>", type: "QCM", situation: null, note: 1, discordances: 0, nonJugees: 0,
      correct: true, eliminatoire: true, reservee: false, choixApprenant: ["B"], reponsesAttendues: ["B"], justification: "Parce que.", sources: ["ANSM — BPP"],
    },
    {
      questionId: "q2", enonce: "Schéma", type: "SCH", situation: null, note: 0.5, discordances: 1, nonJugees: 0,
      correct: false, eliminatoire: false, reservee: false, choixApprenant: ["1 → sas"], reponsesAttendues: ["1 → sas de transfert"], justification: "", sources: [],
      legendes: [{ numero: 1, reponse: "sas", attendu: "sas de transfert", verdict: "fausse" }],
    },
  ],
};

test("le rapport A4 porte verdict, visas, synthèse, détail et échappe le HTML", () => {
  const html = construireRapport({ identifiant: "AG-007", nom: "A. Test", qualite: "Préparateur", parcours: "Intégration" }, [resultat], {
    numero: "RAP-2026-0001",
    empreinte: "abcdef0123456789",
    visas: [{ qualite: "apprenant", signataire: "AG-007", date: "18/09/2026" }],
    conservation: "pseudonyme",
    miseEnService: "2026-10-01",
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
  // Statut du dispositif : document qualité, procédure à compléter, horodatage serveur explicite.
  assert.ok(html.includes("Document qualité — preuve de l'étape 2"));
  assert.ok(html.includes("en service depuis le 01/10/2026"));
  assert.ok(!html.includes("Phase d'essai"));
  assert.ok(html.includes("procédure [à compléter]"));
  assert.ok(html.includes("horloge du serveur, 2026-09-18T12:02:00.000Z"));
  assert.ok(!html.includes("[à préciser]"));
  // Conservation pseudonyme : l'identifiant est le seul rattachement, le nom est hors sceau.
  assert.ok(html.includes("Identifiant d'agent"));
  assert.ok(html.includes("AG-007"));
  assert.ok(html.includes("porté à l'édition, hors sceau, non enregistré"));
  assert.ok(html.includes("sous l'identifiant d'agent AG-007, sans nom"));
});

test("édition pseudonyme sans nom : identification à compléter d'après la correspondance", () => {
  const html = construireRapport({ identifiant: "AG-007", nom: "", qualite: "", parcours: "" }, [resultat], {
    numero: "RAP-2026-0001",
    conservation: "pseudonyme",
  });
  assert.ok(html.includes("à compléter à la main, d'après la correspondance tenue par le pharmacien responsable"));
  assert.ok(!html.includes("porté à l'édition"));
});

test("sans conservation, l'identification se complète à la main et la décision se recalcule du résultat", () => {
  const html = construireRapport({ nom: "", qualite: "", parcours: "" }, [resultat]);
  assert.ok(html.includes("à renseigner par l'apprenant"));
  assert.ok(html.includes("Preuve sur signatures manuscrites") && html.includes("aucun résultat n'est conservé"));
  // Deux questions sur neuf requises : non concluant, recalculé sans exclusion.
  assert.ok(html.includes("Évaluation non concluante"));
  assert.ok(html.includes("Tirage non concluant : 9 questions requises."));
});

test("verdict arbitré, question exclue et signature incrustée", () => {
  const html = construireRapport({ nom: "A. Test", qualite: "", parcours: "" }, [resultat], {
    numero: "RAP-2026-0002",
    empreinte: "abcdef0123456789",
    visas: [
      { qualite: "apprenant", signataire: "AG-007", date: "18/09/2026" },
      { qualite: "tuteur", signataire: "Tuteur test", date: "18/09/2026" },
      { qualite: "pharmacien", signataire: "Administrateur initial", date: "19/09/2026", signatureDataUri: "data:image/png;base64,AAAA" },
    ],
    conservation: "pseudonyme",
    decision: {
      decision: {
        nbQuestions: 1, nbExclues: 1, pointsObtenus: 1, pointsTotal: 1, score: 100, seuil: 80, bande: 100,
        bandeBasse: 0, bandeHaute: 100, echecEliminatoire: false, concluant: true, minQuestions: 1, verdictBrut: "indetermine",
      },
      verdictFinal: "acquis",
      arbitrage: { verdict: "acquis", motif: "Maîtrise constatée <au poste>", par: "Tuteur test", date: "18/09/2026" },
      exclusions: [{ questionId: "q2", motif: "question retirée de la banque après signalement" }],
    },
  });
  assert.ok(html.includes("Arbitrage du tuteur : <strong>acquis</strong>"));
  assert.ok(html.includes("Maîtrise constatée &lt;au poste&gt;"));
  assert.ok(html.includes("Verdict brut : indéterminé"));
  assert.ok(html.includes("1 question exclue du calcul"));
  assert.ok(html.includes('class="exclue"'));
  assert.ok(html.includes('<img class="signature" src="data:image/png;base64,AAAA"'));
  assert.ok(html.includes("(Tuteur test, 18/09/2026)"));
  assert.ok(html.includes("Signature — Administrateur initial"));
});

test("la référence de la procédure interne remplace le marqueur quand elle est renseignée", () => {
  const html = construireRapport({ nom: "", qualite: "", parcours: "" }, [resultat], {
    procedure: "PHAR-PR-012 — Habilitation du personnel <v3>",
  });
  assert.ok(html.includes("procédure PHAR-PR-012 — Habilitation du personnel &lt;v3&gt;"));
  assert.ok(!html.includes("[à compléter]"));
  assert.ok(html.includes("Preuve sur signatures manuscrites"));
  // Sans date de mise en service : phase d'essai, bandeau en tête et pied de page.
  assert.ok(html.includes('<div class="essai">Phase d\'essai : ce rapport ne vaut pas preuve.'));
  assert.ok(html.includes("Phase d'essai — ne vaut pas preuve"));
  assert.ok(!html.includes("Document qualité"));
});

test("nom de fichier sûr", () => {
  assert.match(nomFichierRapport("Éloïse D'Été", "RAP-2026-0002"), /^rapport-evaluation-rap-2026-0002-eloise-d-ete-\d{4}-\d{2}-\d{2}\.html$/);
});

test("un retrait postérieur à la décision est signalé sur le rapport, sans changer le score (question 19)", () => {
  const html = construireRapport({ identifiant: "AG-007", nom: "", qualite: "", parcours: "" }, [resultat], {
    numero: "RAP-2026-0003",
    conservation: "pseudonyme",
    decision: {
      decision: {
        nbQuestions: 2, nbExclues: 0, pointsObtenus: 1.5, pointsTotal: 2, score: 75, seuil: 80, bande: 50,
        bandeBasse: 30, bandeHaute: 100, echecEliminatoire: false, concluant: true, minQuestions: 1, verdictBrut: "indetermine",
      },
      verdictFinal: "indetermine",
      arbitrage: null,
      exclusions: [],
      retraitsPosterieurs: [{ questionId: "q2", date: "19/09/2026" }],
      decisionSiExclues: { score: 100, verdictBrut: "acquis" },
    },
  });
  assert.ok(html.includes("Retrait postérieur à la décision : question n° 2 (retirée de la banque le 19/09/2026)"));
  assert.ok(html.includes("score et verdict inchangés"));
  assert.ok(html.includes("le score serait de 100 % (verdict brut acquis)"));
  assert.ok(html.includes("retirée de la banque après la décision"));
  assert.ok(!html.includes('class="exclue"'), "la question retirée après la décision n'est pas exclue du calcul");
});

test("les logos incorporés remplacent les adresses ; sans eux, l'adresse du site sert (question 20)", () => {
  const avec = construireRapport({ nom: "", qualite: "", parcours: "" }, [resultat], {
    logos: { hdv: "data:image/png;base64,HDV", pharmaco: "data:image/png;base64,PH" },
  });
  assert.ok(avec.includes('<img class="hdv" src="data:image/png;base64,HDV"'));
  assert.ok(avec.includes('<img class="pharmaco" src="data:image/png;base64,PH"'));
  const sans = construireRapport({ nom: "", qualite: "", parcours: "" }, [resultat], { baseUrl: "https://site" });
  assert.ok(sans.includes('src="https://site/hdv.png"') && sans.includes('src="https://site/pharmaco-web.png"'));
});
