import { test } from "node:test";
import assert from "node:assert/strict";
import { LIBELLES_AVANCEMENT, VIERGE, avancementParModule, libelleAvancement } from "../content/avancement-agent";

// ── Avancement d'un agent par module, vu du tutorat (06/10/2026, demande directe)

const t = (module_id: string, nature: string, cree_le: string, verdict: string | null = null, score: number | null = null) => ({
  module_id,
  nature,
  verdict,
  score,
  cree_le,
});

test("avancement : la dernière évaluation fait l'état, quel que soit l'ordre des traces", () => {
  const a = avancementParModule([
    t("m1", "evaluation", "2026-10-06 10:00:00+00", "acquis", 85),
    t("m1", "lecture", "2026-10-06 11:00:00+00"),
    t("m1", "evaluation", "2026-10-05 09:00:00+00", "non_acquis", 40),
    t("m1", "entrainement", "2026-10-07 09:00:00+00", null, 90),
  ]);
  assert.deepEqual(a.get("m1"), { etat: "acquis", le: "2026-10-06 10:00:00+00", score: 85 }, "l'évaluation la plus récente, pas la lecture ni l'entraînement d'après");
});

test("avancement : sans évaluation, l'entraînement ; sans entraînement, la lecture ; sinon rien", () => {
  const a = avancementParModule([
    t("m2", "lecture", "2026-10-01 08:00:00+00"),
    t("m2", "entrainement", "2026-10-02 08:00:00+00", null, 60),
    t("m3", "lecture", "2026-10-03 08:00:00+00"),
    t("m3", "lecture", "2026-10-04 08:00:00+00"),
    t("m4", "inconnue", "2026-10-04 08:00:00+00"),
  ]);
  assert.deepEqual(a.get("m2"), { etat: "entraine", le: "2026-10-02 08:00:00+00", score: 60 });
  assert.deepEqual(a.get("m3"), { etat: "lu", le: "2026-10-04 08:00:00+00", score: null }, "la dernière lecture");
  assert.equal(a.has("m4"), false, "une nature inconnue ne fait pas d'avancement");
  assert.equal(a.has("m5"), false);
  assert.deepEqual(avancementParModule([]).size, 0);
});

test("avancement : chaque verdict a son état, un verdict inconnu vaut indéterminé", () => {
  const a = avancementParModule([
    t("a", "evaluation", "2026-10-06 10:00:00+00", "acquis", 90),
    t("b", "evaluation", "2026-10-06 10:00:00+00", "non_acquis", 30),
    t("c", "evaluation", "2026-10-06 10:00:00+00", "indetermine", 68),
    t("d", "evaluation", "2026-10-06 10:00:00+00", "non_concluant", 50),
    t("e", "evaluation", "2026-10-06 10:00:00+00", "bizarre", 50),
    t("f", "evaluation", "2026-10-06 10:00:00+00", null, 50),
  ]);
  assert.deepEqual(
    ["a", "b", "c", "d", "e", "f"].map((id) => a.get(id)?.etat),
    ["acquis", "non_acquis", "indetermine", "non_concluant", "indetermine", "indetermine"],
  );
});

test("libellé d'avancement : l'état, la date, le score quand il en est un", () => {
  const date = (iso: string) => `[${iso.slice(0, 10)}]`;
  assert.equal(libelleAvancement({ etat: "acquis", le: "2026-10-06 10:00:00+00", score: 85 }, date), "Acquis le [2026-10-06] · 85 %");
  assert.equal(libelleAvancement({ etat: "non_acquis", le: "2026-10-06 10:00:00+00", score: 0 }, date), "Non acquis le [2026-10-06] · 0 %");
  assert.equal(libelleAvancement({ etat: "entraine", le: "2026-10-05 10:00:00+00", score: 60 }, date), "Entraîné le [2026-10-05] · 60 %");
  assert.equal(libelleAvancement({ etat: "lu", le: "2026-10-05 10:00:00+00", score: null }, date), "Lu le [2026-10-05]", "une lecture n'a pas de score");
  assert.equal(libelleAvancement(VIERGE, date), "Pas commencé");
  for (const etat of Object.keys(LIBELLES_AVANCEMENT)) assert.match(LIBELLES_AVANCEMENT[etat as keyof typeof LIBELLES_AVANCEMENT], /\S/, etat);
});
