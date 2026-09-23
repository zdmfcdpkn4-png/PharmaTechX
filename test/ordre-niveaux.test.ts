import { test } from "node:test";
import assert from "node:assert/strict";
import { ordonnerNiveaux, rangDeFiche, rangEffectif, rappelRangsFiche } from "../content/ordre-niveaux";

// ── Ordre des niveaux (tâche 66, recommandation retenue le 23/09/2026)

const FICHE = ["N1a", "N1b", "N1c", "N2", "N3"];
const niv = (code: string, metier?: string) => ({ code, metier });
const codes = (l: { code: string }[]) => l.map((n) => n.code);

test("rang de la fiche : de dix en dix, aucun pour un niveau ajouté", () => {
  assert.equal(rangDeFiche("N1a", FICHE), 10);
  assert.equal(rangDeFiche("N3", FICHE), 50);
  assert.equal(rangDeFiche("N2R", FICHE), null);
});

test("rang effectif : un rang déposé positif l'emporte, zéro laisse la place de la fiche", () => {
  assert.equal(rangEffectif("N2", 0, FICHE), 40);
  assert.equal(rangEffectif("N2", undefined, FICHE), 40);
  assert.equal(rangEffectif("N2", 55, FICHE), 55);
  assert.equal(rangEffectif("N2R", 45, FICHE), 45);
  assert.equal(rangEffectif("N2R", 0, FICHE), null);
  assert.equal(rangEffectif("N2R", Number.NaN, FICHE), null);
});

test("sans rang, un niveau ajouté reste après la fiche : l'ordre d'avant ne bouge pas", () => {
  const l = [niv("N1a"), niv("N1b"), niv("N1c"), niv("N2"), niv("N3"), niv("N2RESTREINT"), niv("S1")];
  assert.deepEqual(codes(ordonnerNiveaux(l, new Map([["N2RESTREINT", 0], ["S1", 0]]), FICHE)), [
    "N1a", "N1b", "N1c", "N2", "N3", "N2RESTREINT", "S1",
  ]);
});

test("un rang de 45 glisse un niveau entre N2 et N3", () => {
  const l = [niv("N1a"), niv("N1b"), niv("N1c"), niv("N2"), niv("N3"), niv("N2R")];
  assert.deepEqual(codes(ordonnerNiveaux(l, new Map([["N2R", 45]]), FICHE)), [
    "N1a", "N1b", "N1c", "N2", "N2R", "N3",
  ]);
});

test("un niveau de la fiche se déplace par son rang déposé", () => {
  const l = [niv("N1a"), niv("N1b"), niv("N1c"), niv("N2"), niv("N3")];
  assert.deepEqual(codes(ordonnerNiveaux(l, new Map([["N1b", 35]]), FICHE)), ["N1a", "N1c", "N1b", "N2", "N3"]);
});

test("rangés par métier d'abord : les rangs d'un métier ne se mêlent pas à ceux d'un autre", () => {
  const l = [
    niv("AE-N1", "agent-entretien"),
    niv("N1a"),
    niv("PH-N2", "pharmacien"),
    niv("PH-N1", "pharmacien"),
    niv("N2"),
    niv("AP-N1", "aide"),
  ];
  const rangs = new Map([["PH-N1", 10], ["PH-N2", 20], ["AE-N1", 5]]);
  assert.deepEqual(codes(ordonnerNiveaux(l, rangs, FICHE)), ["N1a", "N2", "PH-N1", "PH-N2", "AP-N1", "AE-N1"]);
});

test("à rang égal, l'ordre d'arrivée tient ; la liste d'origine n'est pas modifiée", () => {
  const l = [niv("N1a"), niv("N2"), niv("X1"), niv("X2"), niv("N3")];
  const avant = codes(l);
  assert.deepEqual(codes(ordonnerNiveaux(l, new Map([["X1", 40], ["X2", 40]]), FICHE)), ["N1a", "N2", "X1", "X2", "N3"]);
  assert.deepEqual(codes(l), avant);
});

test("clé de lecture des rangs de la fiche", () => {
  assert.equal(rappelRangsFiche(FICHE), "N1a 10, N1b 20, N1c 30, N2 40, N3 50");
});
