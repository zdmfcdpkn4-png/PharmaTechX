import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ORDRE_NIVEAUX,
  admiseAuProfil,
  bilanTirage,
  melanger,
  repartir,
  reserveesAdmises,
  tirageConforme,
  tirer,
  type ContexteTirage,
  type Difficulte,
  type ModeTirage,
  type QuestionTirable,
} from "../content/tirage";
import { NIVEAUX_QUESTION } from "../content/types";

type Extra = Omit<QuestionTirable, "id">;
const q = (id: string, extra: Extra = {}): QuestionTirable => ({ id, situation: null, ...extra });
const banque = [
  q("e1", { eliminatoire: true }),
  q("r1", { reservee: true }),
  q("r2", { reservee: true }),
  q("a"),
  q("b"),
  q("c"),
  q("s1", { situation: { id: "s" } }),
  q("s2", { situation: { id: "s" } }),
];
const fixe = () => 0.5;

/** Contexte d'avant la question 62 : ni plafond, ni répartition, ni signalement. */
const ctx = (mode: ModeTirage, difficulte: Difficulte, nb: number | null, extra: Partial<ContexteTirage> = {}): ContexteTirage => ({
  mode,
  difficulte,
  nb,
  plafond: null,
  repartition: null,
  signalees: [],
  ...extra,
});

/** Générateur pseudo-aléatoire reproductible (mulberry32). */
function graine(n: number): () => number {
  let a = n >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const compter = (xs: readonly QuestionTirable[], n: QuestionTirable["niveauQuestion"]) =>
  xs.filter((x) => (x.niveauQuestion ?? null) === (n ?? null)).length;

test("réservées admises : évaluation en Habilitation ou Complet seulement", () => {
  assert.equal(reserveesAdmises("evaluation", "habilitation"), true);
  assert.equal(reserveesAdmises("evaluation", "complet"), true);
  assert.equal(reserveesAdmises("evaluation", "decouverte"), false);
  assert.equal(reserveesAdmises("entrainement", "complet"), false);
});

test("tirage d'évaluation : toutes les éliminatoires, puis les réservées en priorité, jusqu'au nombre demandé", () => {
  const ids = tirer(banque, ctx("evaluation", "habilitation", 4), fixe).map((x) => x.id);
  assert.equal(ids.length, 4);
  assert.ok(ids.includes("e1"));
  assert.ok(ids.includes("r1") && ids.includes("r2"));
});

test("entraînement et Découverte : aucune réservée, même en tirage complet", () => {
  assert.deepEqual(tirer(banque, ctx("entrainement", "complet", null), fixe).map((x) => x.id), ["e1", "a", "b", "c", "s1", "s2"]);
  assert.ok(tirer(banque, ctx("evaluation", "decouverte", 3), fixe).every((x) => !x.reservee));
});

test("tirage complet en évaluation : toute la banque, ordre conservé", () => {
  assert.deepEqual(tirer(banque, ctx("evaluation", "complet", null), fixe).map((x) => x.id), banque.map((x) => x.id));
});

test("mises en situation rendues par vignette, après les questions isolées", () => {
  const t = tirer(banque, ctx("evaluation", "habilitation", 7), fixe);
  const premiereSituation = t.findIndex((x) => x.situation);
  const derniereIsolee = t.map((x) => !x.situation).lastIndexOf(true);
  if (premiereSituation >= 0) assert.ok(derniereIsolee < premiereSituation);
});

test("conformité : refus des réservées en entraînement et en Découverte", () => {
  assert.equal(tirageConforme([q("r1", { reservee: true })], banque, ctx("entrainement", "complet", null)).ok, false);
  assert.equal(tirageConforme([q("r1", { reservee: true })], banque, ctx("evaluation", "decouverte", 5)).ok, false);
  assert.equal(tirageConforme([q("a")], banque, ctx("entrainement", "complet", null)).ok, true);
});

test("conformité : en Habilitation, autant de réservées que le tirage prioritaire en aurait pris", () => {
  const h = ctx("evaluation", "habilitation", 4);
  assert.equal(tirageConforme(tirer(banque, h, fixe), banque, h).ok, true);
  const sans = [q("e1", { eliminatoire: true }), q("a"), q("b"), q("c")];
  const c = tirageConforme(sans, banque, h);
  assert.equal(c.ok, false);
  if (!c.ok) assert.match(c.raison, /2 questions réservées/);
  assert.equal(tirageConforme(sans, sans, h).ok, true, "banque sans réservée : rien d'attendu");
  assert.equal(tirageConforme(banque, banque, ctx("evaluation", "complet", null)).ok, true);
  const eliminatoireReservee = [q("e1", { eliminatoire: true, reservee: true }), q("a")];
  assert.equal(tirageConforme(eliminatoireReservee, eliminatoireReservee, h).ok, true);
});

test("mélange déterministe : permutation des mêmes éléments", () => {
  assert.deepEqual([...melanger([1, 2, 3, 4], fixe)].sort(), [1, 2, 3, 4]);
});

// ───────────────────────────── questions 62 et 63 : niveau cible, obligatoires, signalements

test("les trois niveaux du tirage sont ceux des questions, dans le même ordre", () => {
  assert.deepEqual([...ORDRE_NIVEAUX], [...NIVEAUX_QUESTION]);
});

test("répartition : plus forts restes, niveau le plus simple d'abord à reste égal, rien au-dessus du plafond", () => {
  const prompt = { initial: 30, intermediaire: 40, avance: 30 };
  assert.deepEqual(repartir(10, prompt, "avance"), { initial: 3, intermediaire: 4, avance: 3 });
  assert.deepEqual(repartir(5, prompt, "avance"), { initial: 2, intermediaire: 2, avance: 1 });
  assert.deepEqual(repartir(10, { initial: 43, intermediaire: 57, avance: 0 }, "intermediaire"), { initial: 4, intermediaire: 6, avance: 0 });
  assert.deepEqual(repartir(10, prompt, "initial"), { initial: 10, intermediaire: 0, avance: 0 }, "part du seul niveau admis");
  assert.deepEqual(repartir(10, prompt, null), { initial: 3, intermediaire: 4, avance: 3 }, "sans plafond : tous les niveaux");
  assert.deepEqual(repartir(10, { initial: 0, intermediaire: 0, avance: 0 }, "avance"), { initial: 0, intermediaire: 0, avance: 0 });
  for (const nb of [1, 2, 3, 7, 11, 17, 23]) {
    const r = repartir(nb, prompt, "avance");
    assert.equal(r.initial + r.intermediaire + r.avance, nb, `somme juste pour ${nb}`);
  }
});

/** Banque étagée : 5 initiales, 6 intermédiaires, 5 avancées, 4 sans niveau. */
const etagee: QuestionTirable[] = [
  ...Array.from({ length: 5 }, (_, i) => q(`i${i}`, { niveauQuestion: "initial" })),
  ...Array.from({ length: 6 }, (_, i) => q(`m${i}`, { niveauQuestion: "intermediaire" })),
  ...Array.from({ length: 5 }, (_, i) => q(`v${i}`, { niveauQuestion: "avance" })),
  ...Array.from({ length: 4 }, (_, i) => q(`p${i}`)),
];
const PROMPT = { initial: 30, intermediaire: 40, avance: 30 };

test("plafond : les niveaux au-dessus sont écartés, les questions sans niveau restent", () => {
  const c = ctx("evaluation", "complet", null, { plafond: "initial", repartition: { initial: 100, intermediaire: 0, avance: 0 } });
  const ids = tirer(etagee, c, fixe).map((x) => x.id);
  assert.deepEqual(ids, ["i0", "i1", "i2", "i3", "i4", "p0", "p1", "p2", "p3"]);
  const b = bilanTirage(etagee, c);
  assert.equal(b.auDessus, 11);
  assert.equal(b.admises, 9);
});

test("répartition : chaque passation a la même composition par niveau", () => {
  const c = ctx("evaluation", "habilitation", 10, { plafond: "avance", repartition: PROMPT });
  for (let k = 1; k <= 200; k++) {
    const t = tirer(etagee, c, graine(k));
    assert.equal(t.length, 10);
    assert.equal(compter(t, "initial"), 3);
    assert.equal(compter(t, "intermediaire"), 4);
    assert.equal(compter(t, "avance"), 3);
    assert.equal(compter(t, null), 0, "aucune question sans niveau tant que les niveaux suffisent");
  }
});

test("répartition : une place qu'un niveau ne peut remplir va d'abord aux questions sans niveau, puis aux autres niveaux", () => {
  const maigre = [
    q("i0", { niveauQuestion: "initial" }),
    ...Array.from({ length: 6 }, (_, i) => q(`m${i}`, { niveauQuestion: "intermediaire" })),
    ...Array.from({ length: 5 }, (_, i) => q(`v${i}`, { niveauQuestion: "avance" })),
    q("p0"),
  ];
  const c = ctx("evaluation", "habilitation", 10, { plafond: "avance", repartition: PROMPT });
  for (let k = 1; k <= 50; k++) {
    const t = tirer(maigre, c, graine(k));
    assert.equal(t.length, 10);
    assert.equal(compter(t, "initial"), 1);
    assert.equal(compter(t, null), 1, "la question sans niveau passe avant les autres niveaux");
    assert.equal(compter(t, "intermediaire") + compter(t, "avance"), 8);
    assert.ok(compter(t, "intermediaire") >= 4 && compter(t, "avance") >= 3);
    assert.equal(tirageConforme(t, maigre, c).ok, true);
  }
});

test("obligatoires : toujours posées dans un tirage qui peut conclure, et comptées dans leur niveau", () => {
  const avec = etagee.map((x) => (x.id === "i0" || x.id === "i1" || x.id === "v0" ? { ...x, obligatoire: true } : x));
  const h = ctx("evaluation", "habilitation", 10, { plafond: "avance", repartition: PROMPT });
  for (let k = 1; k <= 50; k++) {
    const t = tirer(avec, h, graine(k));
    for (const id of ["i0", "i1", "v0"]) assert.ok(t.some((x) => x.id === id), `${id} posée`);
    assert.deepEqual([compter(t, "initial"), compter(t, "intermediaire"), compter(t, "avance")], [3, 4, 3]);
  }
  assert.equal(bilanTirage(avec, h).obligatoires, 3);
  // Découverte et entraînement : des questions comme les autres.
  const d = ctx("evaluation", "decouverte", 5, { plafond: "avance", repartition: PROMPT });
  assert.equal(bilanTirage(avec, d).obligatoires, 0);
  const sansElles = Array.from({ length: 50 }, (_, k) => tirer(avec, d, graine(k + 1)))
    .filter((t) => !["i0", "i1", "v0"].every((id) => t.some((x) => x.id === id)));
  assert.ok(sansElles.length > 0, "en Découverte, les obligatoires ne sont pas imposées");
});

test("obligatoires au-delà de la part de leur niveau : toutes posées, les autres niveaux gardent leur part", () => {
  const avec = etagee.map((x) => (x.niveauQuestion === "initial" ? { ...x, obligatoire: true } : x));
  const h = ctx("evaluation", "habilitation", 10, { plafond: "avance", repartition: PROMPT });
  const t = tirer(avec, h, graine(7));
  assert.deepEqual([compter(t, "initial"), compter(t, "intermediaire"), compter(t, "avance")], [5, 4, 3]);
  assert.equal(t.length, 12, "le tirage s'allonge plutôt que de retirer une obligatoire");
  assert.equal(tirageConforme(t, avec, h).ok, true);
});

test("signalement ouvert : la question est écartée de tout tirage, évaluation et entraînement", () => {
  for (const c of [
    ctx("evaluation", "complet", null, { signalees: ["a"] }),
    ctx("entrainement", "complet", null, { signalees: ["a"] }),
    ctx("evaluation", "habilitation", 5, { signalees: ["a"] }),
  ]) {
    for (let k = 1; k <= 20; k++) assert.ok(!tirer(banque, c, graine(k)).some((x) => x.id === "a"));
  }
  assert.equal(bilanTirage(banque, ctx("evaluation", "complet", null, { signalees: ["a", "r1"] })).signalees, 2);
  assert.equal(bilanTirage(banque, ctx("entrainement", "complet", null, { signalees: ["a", "r1"] })).signalees, 1, "une réservée hors du tirage n'est pas comptée");
});

test("obligatoire signalée : remplacée par une question du même niveau, même quand les obligatoires remplissent sa part", () => {
  const avec = etagee.map((x) => (x.niveauQuestion === "initial" ? { ...x, obligatoire: true } : x));
  const h = ctx("evaluation", "habilitation", 10, { plafond: "avance", repartition: PROMPT, signalees: ["i0"] });
  for (let k = 1; k <= 30; k++) {
    const t = tirer(avec, h, graine(k));
    assert.ok(!t.some((x) => x.id === "i0"), "l'obligatoire signalée n'est pas posée");
    // quatre obligatoires restantes, plus une remplaçante : de niveau initial, il n'y en a plus → sans effet ici
    assert.equal(compter(t, "initial"), 4);
    assert.equal(tirageConforme(t, avec, h).ok, true);
  }
  assert.deepEqual([bilanTirage(avec, h).remplacees, bilanTirage(avec, h).nonRemplacees], [0, 1], "annoncée sans remplaçante");
  // Avec une initiale non obligatoire disponible, elle prend la place.
  const plus = [...avec, q("i9", { niveauQuestion: "initial" })];
  for (let k = 1; k <= 30; k++) {
    const t = tirer(plus, h, graine(k));
    assert.ok(t.some((x) => x.id === "i9"), "la remplaçante est de même niveau");
    assert.equal(compter(t, "initial"), 5);
    assert.equal(tirageConforme(t, plus, h).ok, true);
  }
  assert.equal(bilanTirage(plus, h).remplacees, 1);
  // Un tirage qui omet la remplaçante est refusé.
  const t = tirer(plus, h, graine(3)).filter((x) => x.id !== "i9");
  const autre = plus.find((x) => x.niveauQuestion === "avance" && !t.includes(x));
  assert.ok(autre);
  const c = tirageConforme([...t, autre], plus, h);
  assert.equal(c.ok, false);
  if (!c.ok) assert.match(c.raison, /de niveau initial attendues/);
});

test("réservées : tirées en priorité dans leur niveau", () => {
  const avec = etagee.map((x) => (x.id === "v1" || x.id === "v2" || x.id === "m5" ? { ...x, reservee: true } : x));
  const h = ctx("evaluation", "habilitation", 10, { plafond: "avance", repartition: PROMPT });
  for (let k = 1; k <= 50; k++) {
    const t = tirer(avec, h, graine(k));
    for (const id of ["v1", "v2", "m5"]) assert.ok(t.some((x) => x.id === id), `réservée ${id} posée`);
    assert.equal(tirageConforme(t, avec, h).ok, true);
  }
  // Une réservée évitée au profit d'une question ordinaire du même niveau est refusée.
  const t = tirer(avec, h, graine(1));
  const sansV1 = t.filter((x) => x.id !== "v1");
  const ordinaire = avec.find((x) => x.niveauQuestion === "avance" && !x.reservee && !t.includes(x));
  assert.ok(ordinaire);
  assert.equal(tirageConforme([...sansV1, ordinaire], avec, h).ok, false);
});

test("conformité : plafond, questions toujours posées et composition vérifiés par le serveur", () => {
  const avec = etagee.map((x) => (x.id === "i0" ? { ...x, obligatoire: true } : x));
  const n2 = ctx("evaluation", "habilitation", 10, { plafond: "intermediaire", repartition: { initial: 43, intermediaire: 57, avance: 0 } });
  const t = tirer(avec, n2, graine(5));
  assert.equal(tirageConforme(t, avec, n2).ok, true);
  assert.deepEqual([compter(t, "initial"), compter(t, "intermediaire"), compter(t, "avance")], [4, 6, 0]);
  // au-dessus du plafond
  const trop = tirageConforme([...t.slice(1), avec.find((x) => x.id === "v0")!], avec, n2);
  assert.equal(trop.ok, false);
  if (!trop.ok) assert.match(trop.raison, /au-dessus du niveau cible/);
  // obligatoire omise
  const sans = t.filter((x) => x.id !== "i0");
  const remplacee = [...sans, avec.find((x) => x.niveauQuestion === "initial" && !t.includes(x))!];
  const oubli = tirageConforme(remplacee, avec, n2);
  assert.equal(oubli.ok, false);
  if (!oubli.ok) assert.match(oubli.raison, /obligatoire non posée/);
  // composition faussée : une intermédiaire de moins, une initiale de plus
  const faussee = [...t.filter((x) => x.id !== t.find((y) => y.niveauQuestion === "intermediaire")!.id), avec.find((x) => x.niveauQuestion === "initial" && !t.includes(x))!];
  const c = tirageConforme(faussee, avec, n2);
  assert.equal(c.ok, false);
  if (!c.ok) assert.match(c.raison, /6 questions de niveau intermédiaire attendues, 5 posées/);
  // entraînement : rien de plus que les réservées, la correction va question par question
  assert.equal(tirageConforme([avec[12]], avec, { ...n2, mode: "entrainement" }).ok, true);
});

test("conformité : ce que le serveur tient pour signalé en plus ne fait pas refuser le tirage", () => {
  const avec = etagee.map((x) => (x.id === "i0" ? { ...x, obligatoire: true } : x));
  const h = ctx("evaluation", "habilitation", 10, { plafond: "avance", repartition: PROMPT, signalees: ["m0"] });
  for (let k = 1; k <= 30; k++) {
    const t = tirer(avec, h, graine(k));
    // signalement ouvert pendant l'épreuve sur une question posée, ou clos depuis peu sur une autre
    const posee = t.find((x) => x.niveauQuestion === "avance")!.id;
    assert.equal(tirageConforme(t, avec, { ...h, signalees: ["m0", posee, "i0", "v4"] }).ok, true);
  }
});

test("tirage conforme à son propre contrôle, sur des banques et des réglages variés", () => {
  const niveaux = [...ORDRE_NIVEAUX, null] as const;
  for (let k = 1; k <= 300; k++) {
    const alea = graine(k * 7919);
    const taille = 6 + Math.floor(alea() * 20);
    const b: QuestionTirable[] = Array.from({ length: taille }, (_, i) => {
      const r = alea();
      return q(`q${i}`, {
        niveauQuestion: niveaux[Math.floor(alea() * 4)],
        eliminatoire: r < 0.08,
        obligatoire: r >= 0.08 && r < 0.2,
        reservee: alea() < 0.2,
        situation: alea() < 0.15 ? { id: `s${i % 3}` } : null,
      });
    });
    const plafond = ORDRE_NIVEAUX[Math.floor(alea() * 3)];
    const signalees = b.filter(() => alea() < 0.15).map((x) => x.id);
    const repartition = { initial: 30, intermediaire: 40, avance: 30 };
    const mode: ModeTirage = alea() < 0.8 ? "evaluation" : "entrainement";
    const difficulte = (["decouverte", "habilitation", "complet"] as const)[Math.floor(alea() * 3)];
    const nb = difficulte === "complet" ? null : difficulte === "decouverte" ? 5 : 10;
    const c = ctx(mode, difficulte, nb, { plafond, repartition, signalees });
    const t = tirer(b, c, alea);
    assert.equal(new Set(t.map((x) => x.id)).size, t.length, "aucune question en double");
    assert.ok(t.every((x) => !signalees.includes(x.id)), "aucune question signalée");
    const verdict = tirageConforme(t, b, c);
    assert.equal(verdict.ok, true, verdict.ok ? "" : `graine ${k} : ${verdict.raison}`);
  }
});

// ───────────────────────────── question 71 (choix b) : réservées déjà vues

test("réservées déjà vues : l'évaluation suivante pose d'abord les autres réservées, puis les questions ordinaires", () => {
  const h = ctx("evaluation", "habilitation", 4, { dejaVues: ["r1"] });
  for (let k = 1; k <= 40; k++) {
    const ids = tirer(banque, h, graine(k)).map((x) => x.id);
    assert.equal(ids.length, 4);
    assert.ok(ids.includes("e1") && ids.includes("r2"), "éliminatoire et réservée non vue posées");
    assert.ok(!ids.includes("r1"), "réservée déjà vue écartée : les questions ordinaires suffisent");
    assert.equal(tirageConforme(tirer(banque, h, graine(k)), banque, h).ok, true);
  }
});

test("réservées déjà vues : reposées quand la banque n'offre pas assez d'autres questions", () => {
  const petite = [q("r1", { reservee: true }), q("r2", { reservee: true }), q("r3", { reservee: true }), q("a")];
  const h = ctx("evaluation", "habilitation", 3, { dejaVues: ["r1", "r2"] });
  for (let k = 1; k <= 20; k++) {
    const ids = tirer(petite, h, graine(k)).map((x) => x.id);
    assert.equal(ids.length, 3);
    assert.ok(ids.includes("r3") && ids.includes("a"));
    assert.equal(ids.filter((id) => id === "r1" || id === "r2").length, 1, "une déjà vue comble la dernière place");
  }
});

test("réservées déjà vues : la composition par niveau prime, la déjà vue passe après les ordinaires de son niveau", () => {
  const avec = etagee.map((x) => (x.id === "v1" || x.id === "v2" || x.id === "m5" ? { ...x, reservee: true } : x));
  const h = ctx("evaluation", "habilitation", 10, { plafond: "avance", repartition: PROMPT, dejaVues: ["v1"] });
  for (let k = 1; k <= 50; k++) {
    const t = tirer(avec, h, graine(k));
    assert.ok(t.some((x) => x.id === "v2") && t.some((x) => x.id === "m5"), "réservées non vues posées");
    assert.ok(!t.some((x) => x.id === "v1"), "v1 déjà vue : trois avancées ordinaires suffisent");
    assert.deepEqual([compter(t, "initial"), compter(t, "intermediaire"), compter(t, "avance")], [3, 4, 3]);
    assert.equal(tirageConforme(t, avec, h).ok, true);
  }
  // Sans assez d'avancées ordinaires, la déjà vue comble la part de son niveau.
  const peu = avec.filter((x) => x.id !== "v3" && x.id !== "v4");
  for (let k = 1; k <= 20; k++) {
    const t = tirer(peu, h, graine(k));
    assert.ok(t.some((x) => x.id === "v1"));
    assert.equal(compter(t, "avance"), 3);
    assert.equal(tirageConforme(t, peu, h).ok, true);
  }
});

test("réservées déjà vues : Complet pose toute la banque, une éliminatoire reste posée", () => {
  const complet = ctx("evaluation", "complet", null, { dejaVues: ["r1", "r2"] });
  assert.deepEqual(tirer(banque, complet, fixe).map((x) => x.id), banque.map((x) => x.id));
  const petite = [q("e1", { eliminatoire: true, reservee: true }), q("a"), q("b"), q("c")];
  const h = ctx("evaluation", "habilitation", 2, { dejaVues: ["e1"] });
  assert.ok(tirer(petite, h, fixe).some((x) => x.id === "e1"));
});

test("réservées déjà vues : une question ordinaire ou inconnue dans la liste ne change pas le tirage, à graine égale", () => {
  const h = ctx("evaluation", "habilitation", 10, { plafond: "avance", repartition: PROMPT });
  const avec = etagee.map((x) => (x.id === "v1" || x.id === "m5" ? { ...x, reservee: true } : x));
  for (let k = 1; k <= 20; k++) {
    assert.deepEqual(
      tirer(avec, { ...h, dejaVues: ["i0", "v0", "inconnue"] }, graine(k)).map((x) => x.id),
      tirer(avec, h, graine(k)).map((x) => x.id),
    );
  }
});

test("réservées déjà vues : contrôle du serveur", () => {
  const client = ctx("evaluation", "habilitation", 4, { dejaVues: ["r1"] });
  const t = tirer(banque, client, fixe);
  // Le serveur en sait plus (une autre évaluation enregistrée entre-temps) : accepté.
  assert.equal(tirageConforme(t, banque, { ...client, dejaVues: ["r1", "r2"] }).ok, true);
  // Tirage fait sans rattachement, corrigé rattaché : accepté.
  const sans = tirer(banque, ctx("evaluation", "habilitation", 4), fixe);
  assert.equal(tirageConforme(sans, banque, client).ok, true);
  // Une réservée non vue évitée au profit d'une question ordinaire : refusé.
  const evitee = [q("e1", { eliminatoire: true }), q("a"), q("b"), q("c")];
  const c = tirageConforme(evitee, banque, client);
  assert.equal(c.ok, false);
  if (!c.ok) assert.match(c.raison, /1 question réservée/);
});

// ───────────────────────────────────── étiquettes de profil (question 74, choix c)

test("profil : sans étiquette, une question est admise à tout profil, précisé ou non", () => {
  assert.equal(admiseAuProfil(null, { filiere: "chimiotherapie", niveau: "N2" }), true);
  assert.equal(admiseAuProfil(undefined, undefined), true);
  assert.equal(admiseAuProfil({ filieres: [], niveaux: [] }, { filiere: "preparatoire", niveau: "N1b" }), true);
});

test("profil : filières et niveaux cochés se lisent comme le réglage d'un module", () => {
  const e = { filieres: ["chimiotherapie"], niveaux: ["N1c", "N2"] };
  assert.equal(admiseAuProfil(e, { filiere: "chimiotherapie", niveau: "N2" }), true);
  assert.equal(admiseAuProfil(e, { filiere: "chimiotherapie", niveau: "n1c" }), true, "code de niveau sans égard à la casse");
  assert.equal(admiseAuProfil(e, { filiere: "preparatoire", niveau: "N2" }), false, "autre filière");
  assert.equal(admiseAuProfil(e, { filiere: "chimiotherapie", niveau: "N1a" }), false, "autre niveau");
  // Une liste vide ne limite rien.
  assert.equal(admiseAuProfil({ filieres: [], niveaux: ["N3"] }, { filiere: "encadrement", niveau: "N3" }), true);
  assert.equal(admiseAuProfil({ filieres: ["preparatoire"], niveaux: [] }, { filiere: "preparatoire", niveau: "N1b" }), true);
});

test("profil : une dimension non précisée ne limite rien, comme un niveau cible non précisé", () => {
  const e = { filieres: ["chimiotherapie"], niveaux: ["N2"] };
  assert.equal(admiseAuProfil(e, { filiere: null, niveau: "N2" }), true);
  assert.equal(admiseAuProfil(e, { filiere: "chimiotherapie", niveau: null }), true);
  assert.equal(admiseAuProfil(e, { filiere: null, niveau: null }), true);
  assert.equal(admiseAuProfil(e, { filiere: null, niveau: "N1b" }), false, "le niveau précisé limite encore");
  assert.equal(admiseAuProfil(e, undefined), true, "contexte sans profil");
});

test("profil : une question étiquetée pour un autre profil n'est tirée ni en évaluation ni en entraînement", () => {
  const chimio = { filieres: ["chimiotherapie"], niveaux: [] };
  const b = [q("a"), q("b"), q("c", { profils: chimio }), q("e", { eliminatoire: true, profils: chimio })];
  const prep = { filiere: "preparatoire", niveau: "N1b" };
  for (const mode of ["evaluation", "entrainement"] as const) {
    const t = tirer(b, ctx(mode, "complet", null, { profil: prep }), fixe);
    assert.deepEqual(t.map((x) => x.id), ["a", "b"], `${mode} : ni la question ni l'éliminatoire d'un autre profil`);
  }
  const t = tirer(b, ctx("evaluation", "complet", null, { profil: { filiere: "chimiotherapie", niveau: "N2" } }), fixe);
  assert.deepEqual(t.map((x) => x.id), ["a", "b", "c", "e"]);
  const sans = tirer(b, ctx("evaluation", "complet", null), fixe);
  assert.equal(sans.length, 4, "sans profil : aucune limite");
});

test("profil : bilan et contrôle du serveur", () => {
  const e = { filieres: ["chimiotherapie"], niveaux: [] };
  const b = [q("a"), q("b"), q("c"), q("d"), q("x", { profils: e }), q("y", { profils: e })];
  const c = ctx("evaluation", "habilitation", 3, { profil: { filiere: "preparatoire", niveau: null } });
  const bilan = bilanTirage(b, c);
  assert.equal(bilan.admises, 4);
  assert.equal(bilan.horsProfil, 2);
  for (let i = 0; i < 20; i++) {
    const t = tirer(b, c, graine(i));
    assert.ok(t.every((x) => !x.profils), "aucune question d'un autre profil tirée");
    assert.deepEqual(tirageConforme(t, b, c), { ok: true });
  }
  const refus = tirageConforme([b[0], b[1], b[4]], b, c);
  assert.equal(refus.ok, false);
  assert.match((refus as { raison: string }).raison, /1 question étiquetée pour d'autres profils/);
  // Pour la filière cochée, la même soumission est conforme.
  assert.deepEqual(tirageConforme([b[0], b[1], b[4]], b, { ...c, profil: { filiere: "chimiotherapie", niveau: null } }), { ok: true });
});

test("profil : une obligatoire d'un autre profil n'est pas exigée par le contrôle", () => {
  const e = { filieres: ["chimiotherapie"], niveaux: ["N2"] };
  const b = [q("a"), q("b"), q("c"), q("o", { obligatoire: true, profils: e })];
  const c = ctx("evaluation", "habilitation", 2, { profil: { filiere: "chimiotherapie", niveau: "N1c" } });
  const t = tirer(b, c, fixe);
  assert.ok(!t.some((x) => x.id === "o"));
  assert.deepEqual(tirageConforme(t, b, c), { ok: true });
});
