import { test } from "node:test";
import assert from "node:assert/strict";
import { dateDeMention, mentionDePreuve, type SourceMention } from "../lib/mention";

const clos: SourceMention = {
  numero: "RAP-2026-0001",
  moduleTitre: "Comportement en ZAC",
  emisLe: "2026-09-22T09:12:00Z",
  statut: "clos",
  score: 92,
  verdict: "acquis",
};

test("un rapport clos donne la mention composée, en service", () => {
  const m = mentionDePreuve(clos, { miseEnService: "2026-09-18" });
  assert.ok("texte" in m);
  assert.equal(
    m.texte,
    "PharmaTechX — RAP-2026-0001 — 22/09/2026 — Comportement en ZAC — 92 % — acquis",
  );
});

test("la mention ne porte jamais l'empreinte : six segments, pas un de plus", () => {
  const m = mentionDePreuve(clos, { miseEnService: "2026-09-18" });
  assert.ok("texte" in m);
  const segments = m.texte.split(" — ");
  assert.equal(segments.length, 6, "outil, numéro, date, module, score, verdict");
  assert.equal(/[0-9a-f]{12,}/.test(m.texte), false, "aucune chaîne d'empreinte");
});

test("avant la clôture, aucune mention : l'arbitrage peut encore changer le verdict", () => {
  for (const statut of ["emis", "vise_tuteur"]) {
    const m = mentionDePreuve({ ...clos, statut });
    assert.ok("refus" in m && m.refus === "non-clos", `refusé : ${statut}`);
  }
});

test("un rapport annulé se refuse sur son propre motif, avant le contrôle de clôture", () => {
  const m = mentionDePreuve({ ...clos, statut: "annule" });
  assert.ok("refus" in m && m.refus === "annule");
});

test("sans mise en service, la mention porte d'abord qu'elle ne vaut pas preuve", () => {
  const m = mentionDePreuve(clos);
  assert.ok("texte" in m);
  assert.ok(
    m.texte.startsWith("Phase d'essai — ne vaut pas preuve — "),
    "la mention ne peut pas contredire le rapport qu'elle cite",
  );
  assert.ok(m.texte.includes("RAP-2026-0001"));
});

test("la date est lue à l'heure de Paris, pas en UTC", () => {
  // 22h30 UTC le 22 septembre, c'est déjà le 23 à Paris (UTC+2 en septembre).
  assert.equal(dateDeMention("2026-09-22T22:30:00Z"), "23/09/2026");
  assert.equal(dateDeMention("2026-09-22T09:12:00Z"), "22/09/2026");
});

test("une date illisible est rendue telle quelle, jamais remplacée", () => {
  assert.equal(dateDeMention("pas une date"), "pas une date");
});
