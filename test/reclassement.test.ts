import { test } from "node:test";
import assert from "node:assert/strict";
import {
  annonceReclassement,
  bilanReclassement,
  lireIdentifiantsQuestions,
  planReclassement,
  type QuestionAClasser,
} from "../content/reclassement";

const QUESTIONS: QuestionAClasser[] = [
  { id: "q-a", module_id: "mod-m3", statut: "a_verifier" },
  { id: "q-b", module_id: "mod-m3", statut: "valide" },
  { id: "q-c", module_id: "mod-m2", statut: "a_verifier" },
  { id: "q-d", module_id: "mod-m4", statut: "retire" },
];

test("identifiants du formulaire : valides, sans doublon, bornés", () => {
  assert.deepEqual(lireIdentifiantsQuestions(["q-a", " q-b ", "q-a", "", "q a", "x'; --", 3, null]), ["q-a", "q-b"]);
  assert.equal(lireIdentifiantsQuestions(Array.from({ length: 900 }, (_, i) => `q-${i}`)).length, 500);
  assert.deepEqual(lireIdentifiantsQuestions(["q-1", "q-2", "q-3"], 2), ["q-1", "q-2"]);
});

test("plan : déjà dans le module, validées qui repassent à vérifier, inconnues", () => {
  const plan = planReclassement(["q-a", "q-b", "q-c", "q-d", "q-x", "q-a"], QUESTIONS, "mod-m2");
  assert.deepEqual(plan.aClasser, ["q-a", "q-b", "q-d"]);
  assert.deepEqual(plan.deja, ["q-c"]);
  assert.deepEqual(plan.validees, ["q-b"], "seule une question validée qui change de module repasse à vérifier");
  assert.deepEqual(plan.inconnues, ["q-x"]);
  const sansChangement = planReclassement(["q-a", "q-b"], QUESTIONS, "mod-m3");
  assert.deepEqual(sansChangement.aClasser, []);
  assert.deepEqual(sansChangement.validees, [], "une validée déjà dans le module ne repasse pas à vérifier");
});

test("annonce avant d'appliquer : nombre, déjà en place, validées, auteur courant", () => {
  const plan = planReclassement(["q-a", "q-b", "q-c"], QUESTIONS, "mod-m2");
  assert.equal(
    annonceReclassement(plan, "Pool de manipulation - (Module 2)"),
    "Classer 2 questions dans « Pool de manipulation - (Module 2) ». 1 y est déjà et ne bouge pas. 1 validée repassera « à vérifier ». Vous deviendrez l'auteur courant des questions déplacées.",
  );
  assert.equal(
    annonceReclassement(planReclassement(["q-a"], QUESTIONS, "mod-m6"), "Module 6"),
    "Classer 1 question dans « Module 6 ». Vous deviendrez l'auteur courant de la question déplacée.",
  );
  assert.equal(
    annonceReclassement(planReclassement(["q-a", "q-b"], QUESTIONS, "mod-m3"), "Module 3"),
    "Rien à classer : les questions choisies sont déjà dans « Module 3 ».",
  );
});

test("bilan au retour sur la banque", () => {
  assert.equal(bilanReclassement(9, 0, "Module 2"), "9 questions classées dans « Module 2 ».");
  assert.equal(bilanReclassement(1, 1, "Module 6"), "1 question classée dans « Module 6 ». 1 validée repasse « à vérifier ».");
  assert.equal(bilanReclassement(13, 2, "Module 6"), "13 questions classées dans « Module 6 ». 2 validées repassent « à vérifier ».");
  assert.equal(bilanReclassement(0, 0, "Module 3"), "Aucune question déplacée : celles choisies étaient déjà dans « Module 3 ».");
});
