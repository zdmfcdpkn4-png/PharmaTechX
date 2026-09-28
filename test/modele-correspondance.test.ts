import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { lireEntree } from "../lib/docx";

/**
 * Modèle de la table de correspondance identifiant ↔ agent (question 83,
 * choix a), fabriqué par scripts/modele-correspondance.py. Le dépôt est
 * public : le classeur livré ne porte que son titre et ses en-têtes, jamais
 * une ligne remplie.
 */
const classeur = readFileSync("docs/modeles/table-correspondance-agents.xlsx");
const classeurXml = lireEntree(classeur, "xl/workbook.xml");
const feuille = lireEntree(classeur, "xl/worksheets/sheet1.xml");

// openpyxl écrit les accents tels quels ou en références numériques, selon qu'il passe par lxml.
const ENTITES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const texte = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, e: string) =>
    e[0] !== "#"
      ? ENTITES[e]
      : String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : Number(e.slice(1))),
  );

function cellules(ligne: number): string[] {
  const contenu = new RegExp(`<row r="${ligne}"[^>]*>([\\s\\S]*?)</row>`).exec(feuille)?.[1] ?? "";
  return [...contenu.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((m) => texte(m[1]));
}

test("deux feuilles : la table, puis son mode d'emploi", () => {
  const noms = [...classeurXml.matchAll(/<sheet [^>]*name="([^"]*)"/g)].map((m) => texte(m[1]));
  assert.deepEqual(noms, ["Correspondance", "Mode d'emploi"]);
});

test("les colonnes retenues à la question 83, dans l'ordre", () => {
  assert.deepEqual(cellules(2), [
    "Identifiant",
    "Nom",
    "Prénom",
    "Fonction",
    "Identifiant créé le",
    "Créé par",
    "Remis à l'agent le",
    "Clos le",
  ]);
});

test("vierge : rien au-delà du titre et des en-têtes", () => {
  const lignes = [...feuille.matchAll(/<row r="(\d+)"/g)].map((m) => Number(m[1]));
  assert.deepEqual(lignes, [1, 2]);
  const references = [...feuille.matchAll(/<c r="[A-Z]+(\d+)"/g)].map((m) => Number(m[1]));
  assert.ok(references.every((n) => n <= 2), "aucune cellule sous les en-têtes");
});

test("identifiant contrôlé de la ligne 3 à 2000 : format du site, doublon refusé, rouge si collé", () => {
  const regle = ['EXACT(LEFT(A3,3),"AG-")', "COUNTIF($A$3:$A$2000,A3)=1"];
  const validation = /<dataValidation [^>]*sqref="A3:A2000"[^>]*type="custom"[^>]*errorStyle="stop"[^>]*>([\s\S]*?)<\/dataValidation>/.exec(feuille)?.[1] ?? "";
  const miseEnForme = /<conditionalFormatting sqref="A3:A2000">([\s\S]*?)<\/conditionalFormatting>/.exec(feuille)?.[1] ?? "";
  for (const morceau of regle) {
    assert.ok(validation.includes(morceau), `validation : ${morceau}`);
    assert.ok(miseEnForme.includes(morceau), `mise en forme : ${morceau}`);
  }
});
