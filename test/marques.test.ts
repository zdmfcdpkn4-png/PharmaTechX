import { test } from "node:test";
import assert from "node:assert/strict";
import { marquesOptions, marquesQim, pastille } from "../content/marques";

const options = [
  { id: "a", texte: "Grade A" },
  { id: "b", texte: "Grade B" },
  { id: "c", texte: "Grade C" },
];

test("QCM : bonne réponse marquée attendue, cochée ou non ; choix erroné marqué ; le reste sans marque", () => {
  // Cochées : B (fausse) et C (juste) ; attendues : A et C.
  assert.deepEqual(marquesOptions(options, ["b", "c"], ["Grade A", "Grade C"]), {
    a: "attendue",
    b: "erronee",
    c: "attendue",
  });
  // Rien de coché : seules les attendues sont marquées.
  assert.deepEqual(marquesOptions(options, [], ["Grade B"]), { a: null, b: "attendue", c: null });
});

test("QIM : ce que l'apprenant a répondu, ce qui était attendu, verdict de la ligne", () => {
  const m = marquesQim(options, { a: true, b: true, c: "nsp" }, ["Grade A"]);
  assert.deepEqual(m, {
    a: { vous: true, attendu: true, verdict: "juste" },
    b: { vous: true, attendu: false, verdict: "faux" },
    c: { vous: "nsp", attendu: false, verdict: "sans" },
  });
  // Une proposition jamais touchée est sans réponse : ni juste ni fausse, comme « je ne sais pas ».
  assert.deepEqual(marquesQim(options, { a: false }, [])?.b, { vous: null, attendu: false, verdict: "sans" });
  assert.deepEqual(marquesQim(options, { a: false }, [])?.a, { vous: false, attendu: false, verdict: "juste" });
});

test("pastille du corrigé : « correct » sur une proposition attendue ou vraie, « incorrect » sur les autres, cochées ou non (05/10/2026)", () => {
  assert.equal(pastille("Grade A", ["Grade A", "Grade C"]), "correct");
  assert.equal(pastille("Grade B", ["Grade A", "Grade C"]), "incorrect");
  // Aucune attendue (QIM toute fausse) : toutes incorrectes.
  assert.deepEqual(options.map((o) => pastille(o.texte, [])), ["incorrect", "incorrect", "incorrect"]);
  // Le texte entier compte : une proposition qui en contient une autre n'en prend pas la pastille.
  assert.equal(pastille("Grade A+", ["Grade A"]), "incorrect");
});

test("deux propositions de même texte : pas de marquage, la correction écrite reste", () => {
  const doublon = [...options, { id: "d", texte: "Grade A" }];
  assert.equal(marquesOptions(doublon, ["a"], ["Grade A"]), null);
  assert.equal(marquesQim(doublon, { a: true }, ["Grade A"]), null);
});
