import { test } from "node:test";
import assert from "node:assert/strict";
import {
  blocsDeLaQuestion,
  etiquettesProfil,
  libelleProfils,
  lireBlocs,
  lireIdentifiants,
  modulesDeLaQuestion,
  poseeAuProfil,
  type ModuleDeRattachement,
  type QuestionRattachee,
} from "../content/rattachement-question";
import { libelleCible, type CibleScellee } from "../content/cible";

/** Question 74 (choix c) : une question dans plusieurs modules, et ses étiquettes. */

const modules = new Map<string, ModuleDeRattachement>(
  [
    { id: "socle-1", bloc: 1, postes: [], niveaux: ["N1a"] },
    { id: "chimio-4", bloc: 4, postes: ["chimiotherapie"], niveaux: ["N1c", "N2"] },
    { id: "prep-6", bloc: 6, postes: ["preparatoire"], niveaux: ["N1b"] },
    { id: "sans-bloc", bloc: null, postes: [], niveaux: [] },
  ].map((m) => [m.id, m]),
);

const question = (extra: Partial<QuestionRattachee> = {}): QuestionRattachee => ({
  module_id: "chimio-4",
  aussi_dans: [],
  blocs: [],
  profil_filieres: [],
  profil_niveaux: [],
  ...extra,
});

test("lecture des étiquettes : blocs entiers de 1 à 99, identifiants distincts, le reste ignoré", () => {
  assert.deepEqual(lireBlocs([3, "1", 3, 0, 100, 2.5, "x", null]), [1, 3]);
  assert.deepEqual(lireBlocs("1,2"), []);
  assert.deepEqual(lireIdentifiants(["chimiotherapie", " chimiotherapie ", "", 4, "x".repeat(81)]), ["chimiotherapie"]);
  assert.deepEqual(lireIdentifiants(null), []);
});

test("modules de la question : l'origine d'abord, sans doublon", () => {
  assert.deepEqual(modulesDeLaQuestion(question({ aussi_dans: ["socle-1", "chimio-4"] })), ["chimio-4", "socle-1"]);
});

test("blocs : ceux des modules, origine et rattachements, et ceux des étiquettes", () => {
  assert.deepEqual(blocsDeLaQuestion(question(), modules), [4]);
  assert.deepEqual(blocsDeLaQuestion(question({ aussi_dans: ["socle-1"] }), modules), [1, 4]);
  assert.deepEqual(blocsDeLaQuestion(question({ aussi_dans: ["sans-bloc"], blocs: [7, 4] }), modules), [4, 7]);
  assert.deepEqual(blocsDeLaQuestion(question({ module_id: "inconnu", blocs: [2] }), modules), [2]);
});

test("profil : posée si un de ses modules couvre le profil et si ses étiquettes l'admettent", () => {
  const q = question({ aussi_dans: ["prep-6"] });
  assert.equal(poseeAuProfil(q, { filiere: "chimiotherapie", niveau: "N2" }, modules), true);
  assert.equal(poseeAuProfil(q, { filiere: "preparatoire", niveau: "N1b" }, modules), true, "par son rattachement");
  assert.equal(poseeAuProfil(q, { filiere: "encadrement", niveau: "N3" }, modules), false);
  // Les étiquettes restreignent : la même question réservée au préparatoire.
  const etiquetee = { ...q, profil_filieres: ["preparatoire"] };
  assert.equal(poseeAuProfil(etiquetee, { filiere: "chimiotherapie", niveau: "N2" }, modules), false);
  assert.equal(poseeAuProfil(etiquetee, { filiere: "preparatoire", niveau: null }, modules), true, "niveau non filtré");
  // Tronc commun : toutes les filières, au niveau du module.
  const socle = question({ module_id: "socle-1" });
  assert.equal(poseeAuProfil(socle, { filiere: "encadrement", niveau: "N1a" }, modules), true);
  assert.equal(poseeAuProfil(socle, { filiere: "encadrement", niveau: "N3" }, modules), false);
  assert.equal(poseeAuProfil(socle, { filiere: null, niveau: null }, modules), true);
});

test("étiquettes de profil : aucune → null ; libellé en clair", () => {
  assert.equal(etiquettesProfil(question()), null);
  const e = etiquettesProfil(question({ profil_filieres: ["chimiotherapie", "x"], profil_niveaux: [] }));
  assert.deepEqual(e, { filieres: ["chimiotherapie", "x"], niveaux: [] });
  assert.equal(
    libelleProfils(e, [{ id: "chimiotherapie", libelle: "Parcours Chimiothérapie" }]),
    "Parcours Chimiothérapie, x · tous niveaux",
  );
  assert.equal(libelleProfils({ filieres: [], niveaux: ["N1c", "N2"] }, []), "toutes filières · N1c, N2");
  assert.equal(libelleProfils(null, []), "");
});

test("rapport : les questions étiquetées pour d'autres profils sont dites, pas autrement", () => {
  const base: CibleScellee = {
    niveau: "N2",
    plafond: "intermediaire",
    parNiveau: { initial: 2, intermediaire: 1, avance: 0, a_preciser: 0 },
    obligatoires: 0,
    ecartees: [],
  };
  assert.doesNotMatch(libelleCible(base), /profil/);
  assert.match(
    libelleCible({ ...base, horsProfil: 2, filiere: "Parcours Chimiothérapie" }),
    /2 questions étiquetées pour d'autres profils non tirées \(profil : Parcours Chimiothérapie, N2\)\.$/,
  );
  assert.match(libelleCible({ ...base, niveau: null, horsProfil: 1, filiere: null }), /\(profil : filière non précisée, niveau non précisé\)\.$/);
});
