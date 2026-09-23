import { test } from "node:test";
import assert from "node:assert/strict";
import type { Role } from "../lib/db";
import { LIBELLE_ESSAI, numeroEssai, sessionDEssai, sessionRetablie, type IdentiteTesteur } from "../lib/essai";

const tuteur: {
  role: Role;
  libelle: string;
  filiere: string | null;
  niveau: string | null;
  acces: number;
  debut: number;
  exp: number;
  essai?: IdentiteTesteur;
} = { role: "tuteur", libelle: "Tutorat · M. T.", filiere: "prep", niveau: "N2", acces: 7, debut: 1000, exp: 2000 };

test("mode test : vue apprenant sous « Utilisateur test », identité du testeur mise de côté", () => {
  const e = sessionDEssai(tuteur);
  assert.ok(e);
  assert.equal(e.role, "poste");
  assert.equal(e.libelle, LIBELLE_ESSAI);
  assert.equal(e.filiere, null);
  assert.equal(e.niveau, null);
  // Liaison au code inchangée : une révocation postérieure ferme toujours la session.
  assert.equal(e.acces, 7);
  assert.equal(e.debut, 1000);
  assert.equal(e.exp, 2000);
  assert.deepEqual(e.essai, { role: "tuteur", libelle: "Tutorat · M. T.", filiere: "prep", niveau: "N2" });
});

test("mode test : refusé à un poste, et pas deux fois de suite", () => {
  assert.equal(sessionDEssai({ ...tuteur, role: "poste" }), null);
  assert.equal(sessionDEssai(sessionDEssai(tuteur)!), null);
});

test("fin du test : l'identité revient à l'identique ; hors test, rien à rétablir", () => {
  assert.deepEqual(sessionRetablie(sessionDEssai(tuteur)!), tuteur);
  assert.deepEqual(sessionRetablie(sessionDEssai({ ...tuteur, role: "admin" })!), { ...tuteur, role: "admin" });
  assert.equal(sessionRetablie(tuteur), null);
});

test("numéro d'essai : hors séquence RAP, heure de Paris à la seconde", () => {
  // 21:05:09 UTC = 23:05:09 à Paris en heure d'été.
  assert.equal(numeroEssai(new Date("2026-09-23T21:05:09Z")), "ESSAI-20260923-230509");
  // Le jour change à Paris avant de changer en UTC (heure d'hiver).
  assert.equal(numeroEssai(new Date("2026-12-31T23:30:00Z")), "ESSAI-20270101-003000");
  assert.match(numeroEssai(new Date()), /^ESSAI-\d{8}-\d{6}$/);
});
