import { BAREME_DEFAUT } from "../content/bareme";
import { test } from "node:test";
import assert from "node:assert/strict";
import { COLONNES_REGISTRE, champCsv, csv, csvRegistre, jsonArchive, ligneRegistre } from "../lib/registre";
import type { RapportComplet } from "../lib/rapports";
import type { ResultatEvaluation } from "../app/api/evaluation/route";

function resultat(notes: number[]): ResultatEvaluation {
  const detail = notes.map((note, i) => ({
    questionId: `q${i + 1}`,
    enonce: `Question ${i + 1}`,
    type: "QCM" as const,
    situation: null,
    note,
    discordances: note === 1 ? 0 : 1,
    nonJugees: 0,
    correct: note === 1,
    eliminatoire: false,
    reservee: false,
    choixApprenant: ["A"],
    reponsesAttendues: ["B"],
    justification: "",
    sources: [],
  }));
  const obtenus = notes.reduce((s, n) => s + n, 0);
  return {
    moduleId: "critere-b1-02",
    moduleTitre: "Module « test »",
    critereId: "B1-02",
    seuilReussite: 80,
    pointsObtenus: obtenus,
    pointsTotal: notes.length,
    score: Math.round((obtenus / notes.length) * 100),
    echecEliminatoire: false,
    reussi: false,
    verdict: "indetermine",
    bande: 10,
    bandeBasse: 70,
    bandeHaute: 89,
    concluant: true,
    minQuestions: 10,
    bareme: BAREME_DEFAUT,
    detail,
    horodatage: "18 septembre 2026 à 14:02",
    horodatageIso: "2026-09-18T12:02:00.000Z",
    tirage: "Complet · 10 questions",
    jeton: "x",
  };
}

const rapport: RapportComplet = {
  id: "abc",
  numero: "RAP-2026-0007",
  module_id: "critere-b1-02",
  module_titre: "Module « test »",
  critere_id: "B1-02",
  agent_id: 7,
  agent_identifiant: "AG-007",
  tirage: "Complet · 10 questions",
  resultat: resultat([1, 1, 1, 1, 1, 1, 1, 1, 0, 0]),
  empreinte: "ff00",
  statut: "clos",
  emis_le: "2026-09-18T12:02:00.000Z",
  annule_motif: null,
  annule_le: null,
  arbitrage: {
    verdict: "acquis",
    motif: "Bonne maîtrise en situation",
    role_session: "tuteur",
    libelle_session: "Tuteur test",
    le: "2026-09-18T13:00:00.000Z",
    score: 80,
    verdictBrut: "indetermine",
  },
  exclusions: [],
  visas: [
    { id: 1, rapport_id: "abc", qualite: "apprenant", role_session: "poste", libelle_session: "", commentaire: "", empreinte: "ff00", signe_le: "2026-09-18T12:02:00.000Z", signature_id: null },
    { id: 2, rapport_id: "abc", qualite: "tuteur", role_session: "tuteur", libelle_session: "Tuteur test", commentaire: "", empreinte: "ff00", signe_le: "2026-09-18T13:05:00.000Z", signature_id: null },
    { id: 3, rapport_id: "abc", qualite: "pharmacien", role_session: "admin", libelle_session: "Administrateur initial", commentaire: "", empreinte: "ff00", signe_le: "2026-09-18T14:00:00.000Z", signature_id: "sig1" },
  ],
};

test("champ CSV : point-virgule, guillemets et retours protégés, virgule décimale", () => {
  assert.equal(champCsv("Dupont; Marie"), '"Dupont; Marie"');
  assert.equal(champCsv('dit "oui"'), '"dit ""oui"""');
  assert.equal(champCsv("a\nb"), '"a\nb"');
  assert.equal(champCsv("a\tb"), '"a\tb"', "une tabulation met la cellule entre guillemets");
  assert.equal(champCsv(7.5), "7,5");
  assert.equal(champCsv(null), "");
});

test("champ CSV : un texte qui commence comme une formule est neutralisé (question 79, OWASP)", () => {
  // Parade de l'OWASP qui résiste à Excel : une tabulation en tête, cellule entre guillemets.
  assert.equal(champCsv("=SOMME(A1)"), '"\t=SOMME(A1)"');
  assert.equal(champCsv("+33 6"), '"\t+33 6"');
  assert.equal(champCsv("- point revu en compagnonnage"), '"\t- point revu en compagnonnage"');
  assert.equal(champCsv("@lien"), '"\t@lien"');
  assert.equal(champCsv("＝1+2"), '"\t＝1+2"', "variante pleine chasse");
  assert.equal(champCsv(" \n=1+2"), '"\t \n=1+2"', "après des blancs de tête");
  assert.equal(champCsv('=LIEN("x";"y")'), '"\t=LIEN(""x"";""y"")"', "guillemets doublés");
  assert.equal(champCsv("Seuil = 80 %"), "Seuil = 80 %", "un signe égal au milieu ne gêne pas");
  assert.equal(champCsv("RAP-2026-0001"), "RAP-2026-0001");
  assert.equal(champCsv(-1.5), "-1,5", "un nombre négatif reste un nombre");
  assert.equal(csv(["A"], [{ A: "=1+2" }]), '\uFEFFA\r\n"\t=1+2"\r\n', "tout tableur en profite");
});

test("csv : marque d'ordre, entête, CRLF", () => {
  const texte = csv(["a", "b"], [{ a: 1, b: "x" }]);
  assert.equal(texte, "﻿a;b\r\n1;x\r\n");
});

test("ligne de registre : agent par identifiant, verdict brut à côté du verdict arbitré, profils des visas", () => {
  const l = ligneRegistre(rapport);
  assert.equal(l.numero, "RAP-2026-0007");
  assert.equal(l.agent, "AG-007");
  assert.equal(l.verdict_brut, "indéterminé");
  assert.equal(l.verdict_final, "acquis");
  assert.equal(l.arbitrage_profil, "Tuteur test");
  assert.equal(l.visa_pharmacien_profil, "Administrateur initial");
  assert.equal(l.score, 80);
  assert.equal(l.bande_basse, 70);
  const texte = csvRegistre([rapport]);
  const lignes = texte.split("\r\n");
  assert.equal(lignes[0], "﻿" + COLONNES_REGISTRE.join(";"));
  assert.ok(lignes[1].startsWith("RAP-2026-0007;clos;"));
  assert.ok(lignes[1].includes(";AG-007;B1-02;"));
  assert.ok(!COLONNES_REGISTRE.some((c) => c.includes("nom")));
});

test("json d'archive : décision, arbitrage, visas, résultat complet ; nom hors sceau seulement à l'édition", () => {
  const j = JSON.parse(jsonArchive(rapport));
  assert.equal(j.format, "formation-pharmacotechnie/rapport/2");
  assert.equal(j.numero, "RAP-2026-0007");
  assert.equal(j.agent.identifiant, "AG-007");
  assert.equal(j.edition, null);
  assert.equal(j.decision.verdictBrut, "indetermine");
  assert.equal(j.decision.verdictFinal, "acquis");
  assert.equal(j.visas.length, 3);
  assert.equal(j.visas[2].signature_incrustee, true);
  assert.equal("nom" in j.visas[2], false);
  assert.equal(j.resultat.detail.length, 10);
  const e = JSON.parse(jsonArchive(rapport, { nom: "Dupont; Marie", qualite: "Préparatrice", le: new Date("2026-09-19T08:00:00Z") }));
  assert.deepEqual(e.edition, { nom: "Dupont; Marie", qualite: "Préparatrice", le: "2026-09-19T08:00:00.000Z", hors_sceau: true });
  assert.equal(e.empreinte, "ff00");
});
