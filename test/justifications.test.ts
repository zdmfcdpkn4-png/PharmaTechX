import { test } from "node:test";
import assert from "node:assert/strict";
import {
  composerJustification,
  justificationsParOption,
  lirePieges,
  repartirJustification,
  separerCorrigeColle,
} from "../content/justifications";
import { sanitizeQuestion, type Question } from "../content/types";

// Justification par proposition (question 85, choix a, 01/10/2026).

test("composer : justification, extrait, piège, une ligne chacun, dans cet ordre", () => {
  assert.equal(
    composerJustification({ justification: "Faux : c'est l'inverse.", extrait: "« phrase »", piege: "inversion." }),
    "Faux : c'est l'inverse.\nExtrait : « phrase »\nPiège : inversion.",
  );
  assert.equal(composerJustification({ extrait: "« phrase »" }), "Extrait : « phrase »");
  assert.equal(composerJustification({ piege: " terme voisin " }), "Piège : terme voisin.");
  assert.equal(composerJustification({ justification: " ", extrait: "" }), "");
});

test("pièges : le sien à chaque lettre, le reste à part", () => {
  const p = lirePieges("A valeur modifiée, C mauvaise attribution, E terme voisin.", ["A", "B", "C", "D", "E"]);
  assert.deepEqual([...p.parLettre], [["A", "valeur modifiée"], ["C", "mauvaise attribution"], ["E", "terme voisin"]]);
  assert.deepEqual(p.reste, []);
  assert.deepEqual(lirePieges("aucune", ["A", "B"]).reste, ["aucune"], "« aucune » ne se range sous aucune lettre");
  assert.deepEqual(lirePieges("B inversion, D restriction", ["A", "B", "C"]).reste, ["D restriction"], "lettre sans proposition");
  const virgule = lirePieges("C énoncé juste, attribué au mauvais équipement, D inversion", ["C", "D"]);
  assert.equal(virgule.parLettre.get("C"), "énoncé juste, attribué au mauvais équipement", "une virgule dans le piège ne le coupe pas");
  assert.equal(lirePieges("B inversion, B restriction", ["B"]).parLettre.get("B"), "inversion, restriction");
});

test("répartir : la forme que le dépôt écrivait avant la question 85, y compris un « ; » dans un extrait", () => {
  const ancien =
    "A : « phrase une ; et sa suite » ; B : « phrase deux » ; " +
    "C : « phrase trois » ; D : « phrase quatre » ; E : « phrase cinq ». " +
    "Pièges : B mauvaise attribution, C mauvaise attribution.";
  const r = repartirJustification(ancien, ["A", "B", "C", "D", "E"]);
  assert.deepEqual(r, {
    question: "",
    propositions: {
      A: "Extrait : « phrase une ; et sa suite »",
      B: "Extrait : « phrase deux »\nPiège : mauvaise attribution.",
      C: "Extrait : « phrase trois »\nPiège : mauvaise attribution.",
      D: "Extrait : « phrase quatre »",
      E: "Extrait : « phrase cinq »",
    },
  });
});

test("répartir : la justification libre et l'extrait du document restent à la question", () => {
  const r = repartirJustification(
    "Les sels de platine forment des adduits. Extrait du document : « Ils se lient à l'ADN ». A : « a » ; B : « b ». Pièges : aucun.",
    ["A", "B"],
  );
  assert.deepEqual(r, {
    question: "Les sels de platine forment des adduits. Extrait du document : « Ils se lient à l'ADN ». Pièges : aucun.",
    propositions: { A: "Extrait : « a »", B: "Extrait : « b »" },
  });
  assert.deepEqual(repartirJustification("Libre. B : « b ».", ["A", "B"]), { question: "Libre.", propositions: { B: "Extrait : « b »" } });
});

test("répartir : rien à répartir, ou une forme qu'on ne devine pas", () => {
  assert.equal(repartirJustification("cf. procédure interne.", ["A", "B"]), null);
  assert.equal(repartirJustification("Voir l'annexe A : tableau 3.", ["A", "B"]), null, "« A : » au milieu d'une phrase");
  assert.equal(repartirJustification("B : « b » ; A : « a ».", ["A", "B"]), null, "lettres dans le désordre");
  assert.equal(repartirJustification("A : « a » ; D : « d ».", ["A", "B"]), null, "lettre sans proposition");
  assert.equal(repartirJustification("", ["A"]), null);
  assert.deepEqual(
    repartirJustification("Pièges : B inversion.", ["A", "B"]),
    { question: "", propositions: { B: "Piège : inversion." } },
    "des pièges sans extraits se rangent quand même",
  );
});

test("justifications de la correction : par identifiant, rapprochées par le texte", () => {
  const options = [
    { id: "b", texte: "Deux" },
    { id: "a", texte: "Un" },
  ];
  assert.deepEqual(justificationsParOption(options, ["Un", "Deux"], ["Extrait : « un »", ""]), { a: "Extrait : « un »" });
  assert.equal(justificationsParOption(options, undefined, undefined), null, "résultat antérieur : rien");
  assert.equal(
    justificationsParOption([{ id: "a", texte: "X" }, { id: "b", texte: "X" }], ["X", "X"], ["un", "deux"]),
    null,
    "deux propositions de même texte : ambigu",
  );
});

test("la justification des propositions ne part pas au navigateur avant la réponse", () => {
  const q: Question = {
    id: "q",
    enonce: "Énoncé",
    type: "QIM",
    options: [
      { id: "a", texte: "Un" },
      { id: "b", texte: "Deux" },
    ],
    bonnesReponses: ["a"],
    justification: "",
    justificationsOptions: { a: "Extrait : « secret »" },
  };
  const pub = sanitizeQuestion(q);
  assert.equal("justificationsOptions" in pub, false);
  assert.equal(JSON.stringify(pub).includes("secret"), false);
});

test("corrigé collé au bout d'un extrait : séparé, lettres lues ; rien sans guillemet fermant", () => {
  assert.deepEqual(separerCorrigeColle("« projets de fond » Réponses : A D E"), { texte: "« projets de fond »", lettres: ["A", "D", "E"] });
  assert.deepEqual(separerCorrigeColle("« x » Réponse : B, C et E."), { texte: "« x »", lettres: ["B", "C", "E"] });
  assert.deepEqual(separerCorrigeColle("« x » Réponses : aucune"), { texte: "« x »", lettres: [] });
  assert.equal(separerCorrigeColle("« x »"), null);
  assert.equal(separerCorrigeColle("les réponses : A et B sont fausses"), null, "phrase de l'extrait, pas un corrigé collé");
});

test("répartir : le corrigé collé au dernier extrait en sort, et revient à part", () => {
  const r = repartirJustification("A : « a » ; B : « b » Réponses : A. Pièges : B inversion.", ["A", "B"]);
  assert.deepEqual(r, {
    question: "",
    propositions: { A: "Extrait : « a »", B: "Extrait : « b »\nPiège : inversion." },
    corrige: ["A"],
  });
  assert.equal(repartirJustification("A : « a » ; B : « b ».", ["A", "B"])?.corrige, undefined, "pas de corrigé : rien de plus");
});
