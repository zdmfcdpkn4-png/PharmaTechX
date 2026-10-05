import { test } from "node:test";
import assert from "node:assert/strict";
import {
  aDesQuestions,
  accesLibre,
  documentDuProfil,
  fichierOuvert,
  motifFermeture,
  refusDuPoste,
  modulesDuCode,
  profilConnu,
  profilDeLaPage,
  profilImpose,
  programmeVise,
} from "../lib/profil-impose";

const poste = { role: "poste" as const, filiere: "chimiotherapie", niveau: "N2R" };

test("profil imposé : un code de poste reçoit le profil de son code", () => {
  assert.deepEqual(profilImpose(poste, true), { filiere: "chimiotherapie", niveau: "N2R" });
  // Un code sans filière ni niveau impose quand même : le socle, à tous les niveaux.
  assert.deepEqual(profilImpose({ role: "poste", filiere: null, niveau: null }, true), { filiere: null, niveau: null });
});

test("profil imposé : la gestion, le mode test et le site sans base choisissent leur profil", () => {
  assert.equal(profilImpose({ ...poste, role: "tuteur" }, true), null);
  assert.equal(profilImpose({ ...poste, role: "admin" }, true), null);
  assert.equal(profilImpose({ ...poste, essai: { role: "admin" } }, true), null, "mode test");
  assert.equal(profilImpose(poste, false), null, "sans base, le site est ouvert");
  assert.equal(profilImpose(null, true), null);
});

test("page de module : le profil de l'adresse pour qui choisit, celui du code pour un poste", () => {
  const adresse = { parcours: "maintien", filiere: "sterilisation", niveau: "N1a" };
  assert.deepEqual(profilDeLaPage(null, adresse), { parcours: "maintien", filiere: "sterilisation", niveau: "N1a" });
  // Le poste garde le parcours de l'adresse, jamais sa filière ni son niveau.
  assert.deepEqual(profilDeLaPage({ filiere: "chimiotherapie", niveau: "N2R" }, adresse), {
    parcours: "maintien",
    filiere: "chimiotherapie",
    niveau: "N2R",
  });
  assert.deepEqual(profilDeLaPage({ filiere: "chimiotherapie", niveau: "N2R" }, {}), {
    parcours: "integration",
    filiere: "chimiotherapie",
    niveau: "N2R",
  });
  // Un code sans niveau n'a pas de profil de page : l'adresse ne lui en prête pas un.
  assert.equal(profilDeLaPage({ filiere: "chimiotherapie", niveau: null }, adresse), null);
  assert.equal(profilDeLaPage({ filiere: null, niveau: "N2R" }, adresse), null);
});

test("programme à la carte : celui du code pour un poste, quelle que soit l'adresse", () => {
  assert.equal(programmeVise(true, 7, 3, false), 3, "un autre programme demandé est ignoré");
  assert.equal(programmeVise(true, 7, null, false), null, "sans programme au code, aucun");
  assert.equal(programmeVise(true, null, 3, true), 3, "un parcours demandé ne fait pas quitter le programme du code");
  // Qui choisit : l'adresse d'abord, sinon le code quand aucun parcours n'est demandé (question 50).
  assert.equal(programmeVise(false, 7, 3, false), 7);
  assert.equal(programmeVise(false, null, 3, false), 3);
  assert.equal(programmeVise(false, null, 3, true), null);
});

test("documents généraux : la règle de l'écran du programme", () => {
  const pourTous = { filieres: [], niveaux: [] };
  const chimioN2R = { filieres: ["chimiotherapie"], niveaux: ["N2R"] };
  assert.equal(documentDuProfil(pourTous, "", ""), true);
  assert.equal(documentDuProfil(chimioN2R, "chimiotherapie", "N2R"), true);
  assert.equal(documentDuProfil(chimioN2R, "chimiotherapie", ""), true, "niveau non précisé : tous les niveaux");
  assert.equal(documentDuProfil(chimioN2R, "chimiotherapie", "N1a"), false);
  assert.equal(documentDuProfil(chimioN2R, "sterilisation", "N2R"), false);
  assert.equal(documentDuProfil(chimioN2R, "", "N2R"), false, "sans filière, un document de filière n'est pas proposé");
});

// Question 101 (choix b) : un code de poste n'ouvre que les modules de son programme.
const m = (id: string, niveaux: string[] = []) => ({ id, niveaux });
const fiche = {
  troncCommun: [m("socle-tous"), m("socle-n1c", ["N1c"]), m("socle-n2", ["N2"])],
  parFiliere: {
    chimiotherapie: [m("chimio-tous"), m("chimio-n1c", ["N1c"]), m("chimio-n2", ["N2"])],
    sterilisation: [m("steri-tous")],
  },
};
const ids = (l: { id: string }[]) => l.map((x) => x.id);

test("programme du code : socle puis filière, au niveau du code", () => {
  assert.deepEqual(ids(modulesDuCode(fiche, { filiere: "chimiotherapie", niveau: "N1c" })), [
    "socle-tous",
    "socle-n1c",
    "chimio-tous",
    "chimio-n1c",
  ]);
  // Sans niveau : tous les niveaux ; sans filière : le socle seul.
  assert.deepEqual(ids(modulesDuCode(fiche, { filiere: "chimiotherapie", niveau: null })), [
    "socle-tous",
    "socle-n1c",
    "socle-n2",
    "chimio-tous",
    "chimio-n1c",
    "chimio-n2",
  ]);
  assert.deepEqual(ids(modulesDuCode(fiche, { filiere: null, niveau: "N2" })), ["socle-tous", "socle-n2"]);
  // Une filière que la fiche ne connaît pas n'ajoute rien.
  assert.deepEqual(ids(modulesDuCode(fiche, { filiere: "inconnue", niveau: "N2" })), ["socle-tous", "socle-n2"]);
});

test("programme du code : un module présent deux fois n'y paraît qu'une fois", () => {
  const double = { troncCommun: [m("a")], parFiliere: { f: [m("a"), m("b")] } };
  assert.deepEqual(ids(modulesDuCode(double, { filiere: "f", niveau: null })), ["a", "b"]);
});

test("profil du code ramené au référentiel servi", () => {
  assert.deepEqual(profilConnu({ filiere: "chimiotherapie", niveau: "N1c" }, ["chimiotherapie"], ["N1c"]), {
    filiere: "chimiotherapie",
    niveau: "N1c",
  });
  assert.deepEqual(profilConnu({ filiere: "retiree", niveau: "N9" }, ["chimiotherapie"], ["N1c"]), { filiere: null, niveau: null });
});

test("fichier servi à un code de poste : un document validé de son programme", () => {
  const ouverts = new Set(["chimio-n1c"]);
  const profil = { filiere: "chimiotherapie", niveau: "N1c" };
  const doc = (o: Partial<{ module_id: string | null; filieres: string[]; niveaux: string[]; statut: string }>) => ({
    module_id: null,
    filieres: [],
    niveaux: [],
    statut: "valide",
    ...o,
  });
  assert.equal(fichierOuvert([doc({ module_id: "chimio-n1c" })], ouverts, profil), true, "document d'un module ouvert");
  assert.equal(fichierOuvert([doc({ module_id: "chimio-n2" })], ouverts, profil), false, "document d'un module fermé");
  assert.equal(fichierOuvert([doc({ module_id: "chimio-n1c", statut: "a_verifier" })], ouverts, profil), false, "fiche à vérifier");
  assert.equal(fichierOuvert([doc({})], ouverts, profil), true, "document général pour tous");
  assert.equal(fichierOuvert([doc({ filieres: ["sterilisation"] })], ouverts, profil), false, "document général d'une autre filière");
  assert.equal(fichierOuvert([doc({ filieres: ["chimiotherapie"], niveaux: ["N2"] })], ouverts, profil), false, "d'un autre niveau");
  assert.equal(fichierOuvert([], ouverts, profil), false, "fichier qu'aucun document ne porte");
  // Un fichier porté par deux documents est servi si l'un des deux est ouvert.
  assert.equal(fichierOuvert([doc({ module_id: "chimio-n2" }), doc({ module_id: "chimio-n1c" })], ouverts, profil), true);
});

test("accès libre aux modules sans question : le tutorat et l'administration seuls", () => {
  assert.equal(accesLibre({ role: "tuteur" }), true);
  assert.equal(accesLibre({ role: "admin" }), true);
  assert.equal(accesLibre({ role: "poste" }), false, "code de poste, et mode test (session de rôle poste)");
  assert.equal(accesLibre(null), false, "site sans base : le visiteur est un apprenant");
});

test("un module a des questions : celles du code, des mises en situation, ou validées en banque", () => {
  const m = (o: Partial<{ id: string; questions: unknown[]; misesEnSituation: { questions: unknown[] }[] }>) => ({
    id: "mod",
    questions: [],
    misesEnSituation: [],
    ...o,
  });
  assert.equal(aDesQuestions(m({}), {}), false);
  assert.equal(aDesQuestions(m({ questions: [1] }), {}), true, "question du code");
  assert.equal(aDesQuestions(m({ misesEnSituation: [{ questions: [1] }] }), {}), true, "mise en situation");
  assert.equal(aDesQuestions(m({ misesEnSituation: [{ questions: [] }] }), {}), false, "mise en situation vide");
  assert.equal(aDesQuestions(m({}), { mod: 2 }), true, "questions validées en banque");
  assert.equal(aDesQuestions(m({}), { autre: 2, mod: 0 }), false, "celles d'un autre module ne comptent pas");
});

test("motif de fermeture : programme d'abord, puis questions ; rien pour la gestion", () => {
  assert.equal(motifFermeture({ libre: false, auProgramme: true, nbQuestions: 3 }), null);
  assert.equal(motifFermeture({ libre: false, auProgramme: true, nbQuestions: 0 }), "sans-question");
  assert.equal(motifFermeture({ libre: false, auProgramme: false, nbQuestions: 0 }), "hors-programme", "le programme d'abord");
  assert.equal(motifFermeture({ libre: false, auProgramme: false, nbQuestions: 5 }), "hors-programme");
  assert.equal(motifFermeture({ libre: true, auProgramme: true, nbQuestions: 0 }), null, "tutorat et administration");
});

test("refus d'une route pour un code de poste : hors programme, ou sans question", () => {
  const p = { auProgramme: new Set(["a", "b"]), ouverts: new Set(["a"]) };
  assert.equal(refusDuPoste(p, "a"), null);
  assert.equal(refusDuPoste(p, "b"), "sans-question");
  assert.equal(refusDuPoste(p, "z"), "hors-programme");
});
