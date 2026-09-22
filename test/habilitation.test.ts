import { test } from "node:test";
import assert from "node:assert/strict";
import {
  METIER_PAR_DEFAUT,
  criteres,
  criteresDuBloc,
  criteresDuMetier,
  codesDeNiveauDeLaFiche,
  filieres,
  libellePour,
  metiers,
  metiersDuCritere,
  niveauPour,
  niveaux,
  obligatoirePour,
} from "../content/habilitation";
import { NIVEAUX_FICHE } from "../content/types";

// ── Échelle du préparateur, corrigée sur la fiche officielle le 22/09/2026

test("le parcours préparatoire se nomme N1b : P1 et P2 ont disparu", () => {
  const codes = niveaux.map((n) => String(n.code));
  assert.ok(codes.includes("N1b"), "N1b est là");
  for (const perime of ["P1", "P2"]) {
    assert.equal(codes.includes(perime), false, `${perime} n'est plus un niveau`);
    assert.equal(
      (NIVEAUX_FICHE as readonly string[]).includes(perime),
      false,
      `${perime} n'est plus proposé à l'éditeur`,
    );
  }
  assert.equal(
    criteres.some((c) => c.niveau === "P1" || c.niveau === "P2"),
    false,
    "aucun critère ne reste rattaché à P1 ou P2",
  );
});

test("il n'existe qu'un niveau référent, N3", () => {
  const referents = niveaux.filter((n) => /référent/i.test(n.libelle));
  assert.deepEqual(referents.map((n) => String(n.code)), ["N3"]);
});

test("N2 exige les trois branches réunies, N1b et N1c ne dépendent que de N1a", () => {
  const parCode = new Map(niveaux.map((n) => [String(n.code), n]));
  assert.deepEqual(parCode.get("N2")!.prerequis.map(String).sort(), ["N1a", "N1b", "N1c"]);
  assert.deepEqual(parCode.get("N1b")!.prerequis.map(String), ["N1a"]);
  assert.deepEqual(parCode.get("N1c")!.prerequis.map(String), ["N1a"]);
});

test("la filière préparatoire ne porte plus que N1b", () => {
  const f = filieres.find((x) => x.id === "preparatoire")!;
  assert.deepEqual(f.niveaux.map(String), ["N1b"]);
});

// ── Bloc 7 ramené à ce que les fiches portent (question 45, choix b)

test("le bloc 7 ne porte que le critère de parrainage", () => {
  const b7 = criteresDuBloc(7);
  assert.equal(b7.length, 1, "un seul critère");
  assert.match(b7[0].libelle, /formation d'au moins un préparateur/);
  assert.equal(b7[0].niveau, "N3");
});

test("la condition du niveau référent porte l'ancienneté, que le site n'évalue pas", () => {
  const n3 = niveaux.find((n) => String(n.code) === "N3")!;
  assert.match(n3.condition, /année d'expérience/);
  assert.equal(
    criteres.some((c) => /expérience|ancienneté/i.test(c.libelle)),
    false,
    "l'ancienneté reste une condition de niveau, pas un critère évaluable",
  );
});

// ── Vivier unique, porté métier par métier (question 44, choix c)

test("tout critère du vivier porte au moins le métier par défaut", () => {
  for (const c of criteres) {
    assert.ok(c.metiers[METIER_PAR_DEFAUT], `${c.id} porte ${METIER_PAR_DEFAUT}`);
    assert.equal(c.metiers[METIER_PAR_DEFAUT].niveau, c.niveau, `${c.id} : même niveau`);
    assert.equal(
      c.metiers[METIER_PAR_DEFAUT].obligatoire,
      c.obligatoire,
      `${c.id} : même marquage obligatoire`,
    );
  }
});

test("le métier par défaut voit tout le vivier ; un métier inconnu n'en voit rien", () => {
  assert.equal(criteresDuMetier(METIER_PAR_DEFAUT).length, criteres.length);
  assert.equal(criteresDuMetier("mecanicien").length, 0);
});

test("la lecture par métier retombe sur le libellé commun quand la fiche n'en donne pas d'autre", () => {
  const c = criteres[0];
  assert.equal(libellePour(c, METIER_PAR_DEFAUT), c.libelle);
  assert.equal(libellePour(c, "mecanicien"), c.libelle, "le texte reste lisible hors rattachement");
  assert.equal(obligatoirePour(c, METIER_PAR_DEFAUT), c.obligatoire);
  assert.equal(obligatoirePour(c, "mecanicien"), false, "non évalué : pas obligatoire");
  assert.equal(niveauPour(c, METIER_PAR_DEFAUT), c.niveau);
  assert.equal(niveauPour(c, "mecanicien"), null);
});

test("les quatre métiers de l'unité sont déclarés ; trois attendent leur fiche", () => {
  assert.deepEqual(
    metiers.map((m) => m.id),
    ["preparateur", "pharmacien", "aide", "agent-entretien"],
  );
  const vides = metiers.filter((m) => m.niveaux.length === 0).map((m) => m.id);
  assert.deepEqual(vides, ["pharmacien", "aide", "agent-entretien"]);
  for (const m of metiers) {
    assert.equal(m.fiche, "[à compléter]", `${m.id} : référence de fiche non inventée`);
  }
});

test("un critère ne se rattache qu'aux métiers déclarés", () => {
  const c = criteres[0];
  assert.deepEqual(metiersDuCritere(c).map((m) => m.id), [METIER_PAR_DEFAUT]);
});

// ── Repère pour le signalement des orphelins

test("les codes connus de la fiche sont exactement ceux des niveaux", () => {
  assert.deepEqual(
    [...codesDeNiveauDeLaFiche()].sort(),
    ["N1a", "N1b", "N1c", "N2", "N3"],
  );
});
