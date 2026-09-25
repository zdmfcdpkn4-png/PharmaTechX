import { test } from "node:test";
import assert from "node:assert/strict";
import {
  changementDuModule,
  codesDeLaFiliere,
  estDansLaFiliere,
  memesElements,
  programmeParNiveau,
  reglageApres,
  repartir,
  saisieDepuisEnvoi,
  seuleFiliere,
  type ModuleRattache,
} from "../content/programme-filiere";

const chimio = (id: string, niveaux: string[] = ["N1c", "N2"]): ModuleRattache => ({
  id,
  affectation: "poste",
  postes: ["chimiotherapie"],
  niveaux,
});
const socle = (id: string): ModuleRattache => ({ id, affectation: "tronc-commun", postes: [], niveaux: ["N1a"] });
const prepa = (id: string): ModuleRattache => ({ id, affectation: "poste", postes: ["preparatoire"], niveaux: ["N1b"] });
const NIVEAUX_CHIMIO = ["N1c", "N2"];

test("répartition : au programme, autres filières, tronc commun à part (question 80)", () => {
  const r = repartir([chimio("a"), socle("b"), prepa("c"), { ...prepa("d"), postes: ["preparatoire", "chimiotherapie"] }], "chimiotherapie");
  assert.deepEqual(r.dans.map((m) => m.id), ["a", "d"]);
  assert.deepEqual(r.autres.map((m) => m.id), ["c"]);
  assert.deepEqual(r.troncCommun.map((m) => m.id), ["b"]);
});

test("seule filière : le socle ne compte pas comme une autre filière", () => {
  assert.equal(seuleFiliere(chimio("a"), "chimiotherapie"), true);
  assert.equal(seuleFiliere({ ...chimio("a"), postes: ["socle", "chimiotherapie"] }, "chimiotherapie"), true);
  assert.equal(seuleFiliere({ ...chimio("a"), postes: ["preparatoire", "chimiotherapie"] }, "chimiotherapie"), false);
  assert.equal(seuleFiliere(socle("b"), "socle"), false, "un module du tronc commun n'est pas « de poste »");
  assert.equal(estDansLaFiliere({ ...socle("b"), postes: ["socle"] }, "socle"), false);
});

test("ajouter un module : la filière et ses niveaux cochés s'ajoutent, le reste ne bouge pas", () => {
  const r = changementDuModule(prepa("c"), "chimiotherapie", NIVEAUX_CHIMIO, { dans: true, niveaux: ["N2"] });
  assert.deepEqual(r, { changement: { postes: ["preparatoire", "chimiotherapie"], niveaux: ["N1b", "N2"] } });
  const sansNiveau = changementDuModule(prepa("c"), "chimiotherapie", NIVEAUX_CHIMIO, { dans: true, niveaux: [] });
  assert.deepEqual(sansNiveau, { changement: { postes: ["preparatoire", "chimiotherapie"], niveaux: ["N1b"] } });
});

test("retirer un module : la filière et ses niveaux partent ; jamais sa dernière filière", () => {
  const deux = { ...chimio("d"), postes: ["preparatoire", "chimiotherapie"], niveaux: ["N1b", "N2"] };
  assert.deepEqual(changementDuModule(deux, "chimiotherapie", NIVEAUX_CHIMIO, { dans: false, niveaux: [] }), {
    changement: { postes: ["preparatoire"], niveaux: ["N1b"] },
  });
  assert.deepEqual(
    changementDuModule({ ...deux, niveaux: ["N2"] }, "chimiotherapie", NIVEAUX_CHIMIO, { dans: false, niveaux: [] }),
    { changement: { postes: ["preparatoire"], niveaux: ["N2"] } },
    "sans autre niveau, il garde ceux de la filière plutôt que de n'en avoir aucun",
  );
  assert.deepEqual(changementDuModule(chimio("a"), "chimiotherapie", NIVEAUX_CHIMIO, { dans: false, niveaux: [] }), {
    refus: "derniere-filiere",
  });
  assert.deepEqual(
    changementDuModule({ ...chimio("a"), postes: ["socle", "chimiotherapie"] }, "chimiotherapie", NIVEAUX_CHIMIO, { dans: false, niveaux: [] }),
    { refus: "derniere-filiere" },
    "le retirer le ferait passer au tronc commun",
  );
});

test("un module du tronc commun ne se coche pas depuis une filière", () => {
  assert.deepEqual(changementDuModule(socle("b"), "chimiotherapie", NIVEAUX_CHIMIO, { dans: true, niveaux: ["N2"] }), {
    refus: "tronc-commun",
  });
  assert.deepEqual(changementDuModule(socle("b"), "chimiotherapie", NIVEAUX_CHIMIO, { dans: false, niveaux: ["N2"] }), {
    changement: null,
  });
});

test("niveaux d'un module resté : ceux de la filière suivent les cases, les autres gardent leur place", () => {
  const m = { ...chimio("a"), niveaux: ["N3", "N2"] };
  assert.deepEqual(changementDuModule(m, "chimiotherapie", NIVEAUX_CHIMIO, { dans: true, niveaux: ["N2", "N1c"] }), {
    changement: { postes: ["chimiotherapie"], niveaux: ["N3", "N1c", "N2"] },
  });
  assert.deepEqual(changementDuModule(m, "chimiotherapie", NIVEAUX_CHIMIO, { dans: true, niveaux: ["N2"] }), { changement: null });
  assert.deepEqual(
    changementDuModule(chimio("a"), "chimiotherapie", NIVEAUX_CHIMIO, { dans: true, niveaux: ["N2", "N9"] }),
    { changement: { postes: ["chimiotherapie"], niveaux: ["N2"] } },
    "un code étranger à la filière est ignoré",
  );
  assert.deepEqual(changementDuModule(chimio("a"), "chimiotherapie", NIVEAUX_CHIMIO, { dans: true, niveaux: [] }), {
    refus: "aucun-niveau",
  });
});

test("un module hors de la filière et laissé hors : ses cases de niveau n'ont pas d'effet", () => {
  assert.deepEqual(changementDuModule(prepa("c"), "chimiotherapie", NIVEAUX_CHIMIO, { dans: false, niveaux: ["N2"] }), {
    changement: null,
  });
});

test("réglage d'un module du code : égal à la fiche, il retombe sur elle ; seuil et parcours gardés", () => {
  const fiche = { postes: ["chimiotherapie"], niveaux: ["N1c", "N2"] };
  assert.deepEqual(reglageApres(undefined, fiche, { postes: ["chimiotherapie"], niveaux: ["N2", "N1c"] }), {
    seuil: null,
    parcours: null,
    filieres: null,
    niveaux: null,
  });
  assert.deepEqual(
    reglageApres({ seuil: 90, parcours: ["maintien"], filieres: null, niveaux: null }, fiche, {
      postes: ["chimiotherapie", "sterilisation"],
      niveaux: ["N1c", "N2", "S1"],
    }),
    { seuil: 90, parcours: ["maintien"], filieres: ["chimiotherapie", "sterilisation"], niveaux: ["N1c", "N2", "S1"] },
  );
  assert.equal(memesElements(["a", "b"], ["b", "a", "a"]), true);
  assert.equal(memesElements(["a"], ["a", "b"]), false);
});

test("envoi du formulaire : seules les cases changées comptent, un autre onglet n'est pas défait", () => {
  // Affiché hors de la filière, laissé tel quel, mais ajouté entre-temps ailleurs : il y reste.
  const ajouteAilleurs = { ...prepa("c"), postes: ["preparatoire", "chimiotherapie"], niveaux: ["N1b", "N2"] };
  assert.deepEqual(
    saisieDepuisEnvoi(ajouteAilleurs, "chimiotherapie", NIVEAUX_CHIMIO, { dansAffiche: false, dansVoulu: false, niveauxAffiches: [], niveauxVoulus: [] }),
    { dans: true, niveaux: ["N2"] },
  );
  assert.deepEqual(
    changementDuModule(ajouteAilleurs, "chimiotherapie", NIVEAUX_CHIMIO, { dans: true, niveaux: ["N2"] }),
    { changement: null },
    "rien n'est réécrit",
  );
  // Case décochée : c'est un retrait voulu.
  assert.deepEqual(
    saisieDepuisEnvoi(chimio("a"), "chimiotherapie", NIVEAUX_CHIMIO, { dansAffiche: true, dansVoulu: false, niveauxAffiches: ["N1c", "N2"], niveauxVoulus: ["N1c", "N2"] }).dans,
    false,
  );
  // Niveaux : N2 coché à l'écran s'ajoute à ce que le module porte au moment de l'enregistrement.
  assert.deepEqual(
    saisieDepuisEnvoi({ ...chimio("a"), niveaux: ["N1c"] }, "chimiotherapie", NIVEAUX_CHIMIO, {
      dansAffiche: true,
      dansVoulu: true,
      niveauxAffiches: [],
      niveauxVoulus: ["N2"],
    }).niveaux,
    ["N1c", "N2"],
  );
  // Décoché à l'écran : retiré, le reste suit l'état du moment.
  assert.deepEqual(
    saisieDepuisEnvoi(chimio("a"), "chimiotherapie", NIVEAUX_CHIMIO, {
      dansAffiche: true,
      dansVoulu: true,
      niveauxAffiches: ["N2"],
      niveauxVoulus: [],
    }).niveaux,
    ["N1c"],
  );
});

test("niveaux d'une filière : ceux qui la déclarent, dans l'ordre du référentiel", () => {
  const referentiel = [
    { code: "N1a", filiere: "socle" },
    { code: "N1c", filiere: "chimiotherapie" },
    { code: "S1", filiere: "sterilisation" },
    { code: "N2", filiere: "chimiotherapie" },
  ];
  assert.deepEqual(codesDeLaFiliere(referentiel, "chimiotherapie"), ["N1c", "N2"]);
  assert.deepEqual(codesDeLaFiliere(referentiel, "inconnue"), []);
});

test("programme par niveau cible : filière et tronc commun, comme un profil le voit", () => {
  const r = programmeParNiveau([chimio("a"), chimio("b", ["N2"])], [socle("c"), { ...socle("d"), niveaux: ["N1a", "N2"] }], NIVEAUX_CHIMIO);
  assert.deepEqual(r, [
    { niveau: "N1c", filiere: 1, troncCommun: 0 },
    { niveau: "N2", filiere: 2, troncCommun: 1 },
  ]);
});
