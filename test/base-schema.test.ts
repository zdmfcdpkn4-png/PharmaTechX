import { test } from "node:test";
import assert from "node:assert/strict";
import { SCHEMA, TABLES } from "../lib/schema";

const tablesCreees = SCHEMA.map((i) => /CREATE TABLE IF NOT EXISTS (\w+)/.exec(i)?.[1]).filter(Boolean);

test("TABLES recense chaque table créée par le schéma, dans l'ordre", () => {
  assert.deepEqual(tablesCreees, [...TABLES]);
});

test("RLS activée sur chaque table, droits des rôles de l'API Supabase retirés", () => {
  for (const t of TABLES) {
    assert.ok(SCHEMA.includes(`ALTER TABLE ${t} ENABLE ROW LEVEL SECURITY`), `RLS sur ${t}`);
  }
  const revoke = SCHEMA.find((i) => i.includes("REVOKE ALL ON TABLE"));
  assert.ok(revoke, "bloc REVOKE présent");
  for (const t of TABLES) assert.ok(revoke!.includes(t), `REVOKE couvre ${t}`);
  assert.match(revoke!, /rolname IN \('anon', 'authenticated'\)/);
  // les RLS viennent après les créations et les ALTER de colonnes
  const premierRls = SCHEMA.findIndex((i) => i.includes("ENABLE ROW LEVEL SECURITY"));
  const dernierCreate = SCHEMA.map((i) => i.startsWith("CREATE")).lastIndexOf(true);
  assert.ok(premierRls > dernierCreate);
});

test("schéma portable : aucune extension, aucune politique RLS", () => {
  for (const i of SCHEMA) {
    assert.doesNotMatch(i, /CREATE EXTENSION/i);
    assert.doesNotMatch(i, /CREATE POLICY/i);
    assert.doesNotMatch(i, /FORCE ROW LEVEL SECURITY/i);
  }
});
