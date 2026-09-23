import { test } from "node:test";
import assert from "node:assert/strict";
import { LIBELLES_STATUT_SIGNALEMENT, MOTIFS_SIGNALEMENT } from "../content/signalements";
import { SCHEMA } from "../lib/schema";

// ── Question 54 (a + b, 23/09/2026)

test("motifs : la révision a le sien, « Ambigu » reste proposé d'abord, « Autre » en dernier", () => {
  assert.ok(
    (MOTIFS_SIGNALEMENT as readonly string[]).includes("À mettre à jour (référence ou pratique périmée)"),
    "une question dépassée par la référence ou la pratique se signale comme telle",
  );
  assert.equal(MOTIFS_SIGNALEMENT[0], "Ambigu", "le motif choisi par défaut ne change pas");
  assert.equal(MOTIFS_SIGNALEMENT[MOTIFS_SIGNALEMENT.length - 1], "Autre");
  assert.equal(new Set(MOTIFS_SIGNALEMENT).size, MOTIFS_SIGNALEMENT.length, "aucun motif en double");
});

test("statuts : un libellé accentué pour chaque valeur admise par la base, et pour elles seules", () => {
  assert.deepEqual(LIBELLES_STATUT_SIGNALEMENT, { ouvert: "Ouvert", traite: "Traité", rejete: "Rejeté" });
  const table = SCHEMA.find((l) => l.includes("CREATE TABLE IF NOT EXISTS signalements"));
  assert.ok(table, "table des signalements au schéma");
  const admises = /CHECK \(statut IN \(([^)]*)\)\)/
    .exec(table)![1]
    .split(",")
    .map((v) => v.trim().replace(/'/g, ""));
  assert.deepEqual(Object.keys(LIBELLES_STATUT_SIGNALEMENT).sort(), admises.sort());
});
