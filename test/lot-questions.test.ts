import { test } from "node:test";
import assert from "node:assert/strict";
import {
  annonceAussiDans,
  annonceNiveau,
  annonceRetrait,
  annonceStatut,
  bilanLot,
  lireGeste,
  lireStatutLot,
  modulesAAjouter,
  planAussiDans,
  planNiveau,
  planRetrait,
  planStatut,
  type QuestionLot,
} from "../content/lot-questions";

// q-b et q-d ont pour auteur courant celui qui agit.
const Q: QuestionLot[] = [
  { id: "q-a", module_id: "m1", statut: "a_verifier", aussi_dans: [], niveau: null, moi: false },
  { id: "q-b", module_id: "m1", statut: "valide", aussi_dans: ["m2"], niveau: "initial", moi: true },
  { id: "q-c", module_id: "m2", statut: "valide", aussi_dans: [], niveau: "intermediaire", moi: false },
  { id: "q-d", module_id: "m3", statut: "retire", aussi_dans: ["m2", "m4"], niveau: "initial", moi: true },
];

test("lecture du geste et du statut demandés", () => {
  assert.equal(lireGeste("aussi"), "aussi");
  assert.equal(lireGeste("supprimer"), null, "la suppression en lot n'est pas un geste de la barre");
  assert.equal(lireGeste(undefined), null);
  assert.equal(lireStatutLot("valide"), "valide");
  assert.equal(lireStatutLot("brouillon"), null);
});

test("poser aussi dans : ni le module d'origine ni un module où elle l'est déjà", () => {
  assert.deepEqual(modulesAAjouter(Q[2], ["m2", "m4", "m4"]), ["m4"]);
  const plan = planAussiDans([...Q, Q[0]], ["m2", "m4"]);
  assert.deepEqual(plan.touchees, ["q-a", "q-b", "q-c"]);
  assert.equal(plan.ajouts, 4, "deux pour q-a, un pour q-b, un pour q-c ; une question cochée deux fois compte une fois");
  assert.deepEqual(plan.inchangees, ["q-d"]);
  assert.deepEqual(plan.revues, ["q-b", "q-c"], "les validées modifiées repassent à vérifier");
  assert.equal(
    annonceAussiDans(plan, ["B1-02 — Lavage des mains", "B4-02 — Préparation"]),
    "Poser 3 questions aussi dans 2 modules : 4 rattachements nouveaux. Chacune reste dans son module d'origine. 1 y est déjà posée : inchangée. 2 validées repasseront « à vérifier ». Vous deviendrez l'auteur courant des questions modifiées.",
  );
  assert.equal(
    annonceAussiDans(planAussiDans([Q[0]], ["m4"]), ["B4-02 — Préparation"]),
    "Poser 1 question aussi dans « B4-02 — Préparation » : 1 rattachement nouveau. Elle reste dans son module d'origine. Vous deviendrez l'auteur courant de la question modifiée.",
  );
  assert.equal(
    annonceAussiDans(planAussiDans([Q[3]], ["m2"]), ["B1-02 — Lavage des mains"]),
    "Rien à ajouter : la question choisie est déjà posée dans « B1-02 — Lavage des mains », ou c'est son module d'origine.",
  );
  assert.equal(annonceAussiDans(planAussiDans(Q, []), []), "Cochez au moins un module.");
});

test("retirer d'un module : le module d'origine ne se retire pas", () => {
  const plan = planRetrait(Q, "m2");
  assert.deepEqual(plan.touchees, ["q-b", "q-d"]);
  assert.deepEqual(plan.origine, ["q-c"]);
  assert.deepEqual(plan.inchangees, ["q-a"]);
  assert.deepEqual(plan.revues, ["q-b"], "une retirée reste retirée");
  assert.equal(
    annonceRetrait(plan, "B1-02 — Lavage"),
    "Retirer « B1-02 — Lavage » de 2 questions, qui y sont aussi posées. 1 n'y est pas posée. 1 l'a pour module d'origine : elle ne bouge pas ; pour l'en sortir, classez-la dans un autre module. 1 validée repassera « à vérifier ». Vous deviendrez l'auteur courant des questions modifiées.",
  );
  assert.equal(annonceRetrait(planRetrait([Q[0], Q[1]], "m4"), "B4-02"), "Rien à retirer de « B4-02 ». 2 n'y sont pas posées.");
});

test("niveau : « à préciser » est un niveau comme un autre", () => {
  const plan = planNiveau(Q, "initial");
  assert.deepEqual(plan.touchees, ["q-a", "q-c"]);
  assert.deepEqual(plan.inchangees, ["q-b", "q-d"]);
  assert.deepEqual(plan.revues, ["q-c"]);
  assert.equal(
    annonceNiveau(plan, "Initial"),
    "Mettre 2 questions au niveau « Initial ». 2 y sont déjà : inchangées. 1 validée repassera « à vérifier ». Vous deviendrez l'auteur courant des questions modifiées.",
  );
  const aPreciser = planNiveau(Q, null);
  assert.deepEqual(aPreciser.touchees, ["q-b", "q-c", "q-d"]);
  assert.deepEqual(aPreciser.inchangees, ["q-a"]);
  assert.equal(annonceNiveau(planNiveau([Q[1]], "initial"), "Initial"), "Rien à changer : la question choisie est déjà au niveau « Initial ».");
});

test("statut : quatre yeux question par question, sans changer l'auteur", () => {
  const tutorat = planStatut(Q, "valide", "tuteur");
  assert.deepEqual(tutorat.touchees, ["q-a"]);
  assert.deepEqual(tutorat.refusees, ["q-d"], "au tutorat, l'auteur courant ne valide pas");
  assert.deepEqual(tutorat.inchangees, ["q-b", "q-c"]);
  assert.deepEqual(tutorat.revues, [], "valider n'est pas modifier");
  assert.equal(
    annonceStatut(tutorat, "valide"),
    "Valider 1 question : elle entrera dans les tirages. 2 le sont déjà : inchangées. 1 refusée : vous en êtes l'auteur courant, un autre code doit la valider (règle des quatre yeux).",
  );
  const admin = planStatut(Q, "valide", "admin");
  assert.deepEqual(admin.touchees, ["q-a", "q-d"]);
  assert.deepEqual(admin.parAuteur, ["q-d"], "l'administration valide aussi les siennes, tracé");
  assert.deepEqual(admin.refusees, []);
  assert.equal(
    annonceStatut(admin, "valide"),
    "Valider 2 questions : elles entreront dans les tirages. Vous êtes l'auteur courant de l'une d'elles : validation tracée « validée par son auteur ». 2 le sont déjà : inchangées.",
  );
  assert.equal(
    annonceStatut(planStatut([Q[3]], "valide", "tuteur"), "valide"),
    "Rien à valider. 1 refusée : vous en êtes l'auteur courant, un autre code doit la valider (règle des quatre yeux).",
  );
  assert.equal(annonceStatut(planStatut([Q[1]], "valide", "admin"), "valide"), "Rien à valider : la question choisie l'est déjà.");
  const aVerifier = planStatut(Q, "a_verifier", "tuteur");
  assert.deepEqual(aVerifier.touchees, ["q-b", "q-c", "q-d"]);
  assert.deepEqual(aVerifier.revues, ["q-b", "q-c"]);
  assert.equal(
    annonceStatut(aVerifier, "a_verifier"),
    "Remettre 3 questions « à vérifier ». 2 validées sortent des tirages jusqu'à leur revalidation. 1 l'est déjà : inchangée.",
  );
  assert.equal(
    annonceStatut(planStatut(Q, "retire", "tuteur"), "retire"),
    "Retirer 3 questions : elles ne seront plus posées, l'historique les garde. 1 l'est déjà : inchangée.",
  );
  assert.equal(annonceStatut(planStatut([Q[3]], "retire", "admin"), "retire"), "Rien à changer : la question choisie est déjà retirée.");
});

test("bilan au retour sur la banque", () => {
  assert.equal(bilanLot({ geste: "classer", nb: 9, revues: 0 }, "Module 2"), "9 questions classées dans « Module 2 ».");
  assert.equal(
    bilanLot({ geste: "aussi", nb: 3, revues: 2, mods: 2, ajouts: 4 }, ""),
    "3 questions posées aussi dans 2 modules (4 rattachements ajoutés). 2 validées repassent « à vérifier ».",
  );
  assert.equal(
    bilanLot({ geste: "retirer", nb: 2, revues: 1 }, "B1-02 — Lavage"),
    "« B1-02 — Lavage » retiré de 2 questions. 1 validée repasse « à vérifier ».",
  );
  assert.equal(bilanLot({ geste: "niveau", nb: 2, revues: 0 }, "Initial"), "2 questions mises au niveau « Initial ».");
  assert.equal(
    bilanLot({ geste: "statut", statut: "valide", nb: 2, revues: 0, auteur: 1, refus: 1 }, ""),
    "2 questions validées, dont 1 par son auteur. 1 refusée : un autre code que son auteur courant doit la valider.",
  );
  assert.equal(
    bilanLot({ geste: "statut", statut: "valide", nb: 0, revues: 0, refus: 3 }, ""),
    "Aucune question validée. 3 refusées : un autre code que leur auteur courant doit les valider.",
  );
  assert.equal(
    bilanLot({ geste: "statut", statut: "a_verifier", nb: 3, revues: 2 }, ""),
    "3 questions remises « à vérifier ». 2 validées sortent des tirages.",
  );
  assert.equal(bilanLot({ geste: "statut", statut: "retire", nb: 1, revues: 0 }, ""), "1 question retirée.");
});
