import { test } from "node:test";
import assert from "node:assert/strict";
import type { Role } from "../lib/db";
import { etatBascule, refusVisa, sessionEnFormation, sessionFormateur, supervisionAdmise, type IdentiteFormateur } from "../lib/formation";

// ── Question 104 (choix b, 06/10/2026) : un code de tutorat relié à un identifiant, le tuteur en formation

const tuteur: { role: Role; libelle: string; filiere: string | null; niveau: string | null; acces: number; debut: number; exp: number; essai?: unknown; formation?: IdentiteFormateur } = {
  role: "tuteur",
  libelle: "PREPARATEUR-1",
  filiere: null,
  niveau: "N3",
  acces: 7,
  debut: 1000,
  exp: 2000,
};
const agent = { id: 4, identifiant: "AG-004", actif: true };

test("formation : la session du tuteur devient celle d'un poste relié, même code, même libellé, formateur mis de côté", () => {
  const f = sessionEnFormation(tuteur, agent);
  assert.ok(f);
  assert.equal(f.role, "poste");
  assert.equal(f.libelle, "PREPARATEUR-1", "le libellé du code reste : il nomme la session au journal et sur les visas");
  assert.equal(f.acces, 7);
  assert.equal(f.debut, 1000, "l'ouverture ne change pas");
  assert.equal(f.exp, 2000, "l'échéance ne change pas");
  assert.deepEqual(f.formation, { role: "tuteur", libelle: "PREPARATEUR-1" });
  assert.equal(f.niveau, "N3", "filière et niveau du code de tutorat, comme sur un code de poste");
});

test("formation : refusée sans code relié, en mode test, déjà en formation, ou hors tutorat", () => {
  assert.equal(sessionEnFormation(tuteur, null), null, "code de tutorat non relié");
  assert.equal(sessionEnFormation({ ...tuteur, essai: { role: "tuteur" } }, agent), null, "mode test");
  assert.equal(sessionEnFormation({ ...tuteur, role: "admin" }, agent), null, "administration");
  assert.equal(sessionEnFormation({ ...tuteur, role: "poste" }, agent), null, "poste");
  const f = sessionEnFormation(tuteur, agent)!;
  assert.equal(sessionEnFormation(f, agent), null, "déjà en formation");
});

test("formation : le retour rétablit le tuteur tel quel", () => {
  const f = sessionEnFormation(tuteur, agent)!;
  const r = sessionFormateur(f);
  assert.deepEqual(r, tuteur);
  assert.equal(sessionFormateur(tuteur), null, "rien à rétablir hors formation");
});

test("bascule : montrée au tuteur dont le code est relié, dans les deux sens ; à personne d'autre", () => {
  assert.equal(etatBascule(tuteur, true), "formateur");
  assert.equal(etatBascule(sessionEnFormation(tuteur, agent), true), "formation");
  assert.equal(etatBascule(tuteur, false), null, "code de tutorat non relié");
  assert.equal(etatBascule({ ...tuteur, essai: { role: "tuteur" } }, true), null, "mode test");
  assert.equal(etatBascule({ ...tuteur, role: "admin" }, true), null, "administration : la vue apprenant, pas la formation");
  assert.equal(etatBascule({ ...tuteur, role: "poste" }, true), null, "code de poste relié : pas de bascule");
  assert.equal(etatBascule(null, true), null);
});

test("supervision : l'identifiant d'un tuteur ne se gère que depuis l'administration", () => {
  assert.equal(supervisionAdmise("tuteur", false), true);
  assert.equal(supervisionAdmise("admin", false), true);
  assert.equal(supervisionAdmise("poste", false), false);
  assert.equal(supervisionAdmise("tuteur", true), false, "un tuteur ne compose pas le parcours d'un tuteur");
  assert.equal(supervisionAdmise("admin", true), true);
});

test("visa : refusé sur son propre rapport, et à un tuteur sur le rapport d'un tuteur", () => {
  const codes = [
    { id: 7, role: "tuteur" as Role },
    { id: 9, role: "poste" as Role },
  ];
  assert.equal(refusVisa({ role: "tuteur", acces: 7 }, codes), "propre-rapport", "le code 7 est relié à l'identifiant du rapport");
  assert.equal(refusVisa({ role: "admin", acces: 7 }, codes), "propre-rapport", "même un pharmacien ne vise pas son propre rapport");
  assert.equal(refusVisa({ role: "tuteur", acces: 12 }, codes), "tuteur-supervise", "rapport d'un tuteur : pharmacien seulement");
  assert.equal(refusVisa({ role: "admin", acces: 12 }, codes), null);
  assert.equal(refusVisa({ role: "tuteur", acces: 12 }, [{ id: 9, role: "poste" }]), null, "rapport d'un agent : le tutorat vise");
  assert.equal(refusVisa({ role: "tuteur", acces: null }, codes), "tuteur-supervise", "session sans code : jamais « propre rapport »");
  assert.equal(refusVisa({ role: "tuteur", acces: 12 }, []), null, "identifiant sans code relié : rien ne s'y oppose");
});
