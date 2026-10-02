import { test } from "node:test";
import assert from "node:assert/strict";
import type { Role } from "../lib/db";
import {
  LIBELLE_ESSAI,
  adresseDuSite,
  basculerVue,
  numeroEssai,
  sessionDEssai,
  sessionRetablie,
  type IdentiteTesteur,
  type MemoireVues,
} from "../lib/essai";

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

test("mode test à un profil choisi (24/09/2026) : filière et niveau posés comme par un code de poste, rétablis à la fin", () => {
  const e = sessionDEssai(tuteur, { filiere: "chimiotherapie", niveau: "N1c" });
  assert.ok(e);
  assert.equal(e.role, "poste");
  assert.equal(e.filiere, "chimiotherapie");
  assert.equal(e.niveau, "N1c");
  assert.deepEqual(e.essai, { role: "tuteur", libelle: "Tutorat · M. T.", filiere: "prep", niveau: "N2" }, "le profil du testeur est mis de côté");
  assert.deepEqual(sessionRetablie(e), tuteur);
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

// ─────────────────────────────── interrupteur de la vue apprenant (question 94)

const connus = { filieres: ["chimiotherapie", "prep"], niveaux: ["N1a", "N1b", "N2"] };
const admin: typeof tuteur & { vues?: MemoireVues } = {
  role: "admin",
  libelle: "Administration · essai",
  filiere: null,
  niveau: null,
  acces: 2,
  debut: 1000,
  exp: 2000,
};

test("interrupteur : une adresse du site seulement ; trop longue, son seul chemin", () => {
  assert.equal(adresseDuSite("/admin/questions?q=habillage#liste"), "/admin/questions?q=habillage#liste");
  assert.equal(adresseDuSite("/"), "/");
  for (const x of ["//exemple.org/x", "/\\exemple.org", "https://exemple.org/", "admin", "", "/a b", "/é", "/a\nb", null, 3]) {
    assert.equal(adresseDuSite(x), null, String(x));
  }
  assert.equal(adresseDuSite("/admin/questions?q=" + "x".repeat(700)), "/admin/questions");
  assert.equal(adresseDuSite("/" + "x".repeat(700)), null);
});

test("interrupteur : aller-retour, chaque vue reprend sa page, le profil choisi une fois", () => {
  // Premier passage : rien de gardé, le programme s'ouvre, profil à choisir à l'écran.
  const aller = basculerVue(admin, { ici: "/admin/questions?q=habillage#liste" }, connus);
  assert.ok(aller);
  assert.equal(aller.cible, "/");
  assert.equal(aller.session.role, "poste");
  assert.equal(aller.session.libelle, LIBELLE_ESSAI);
  assert.deepEqual([aller.session.filiere, aller.session.niveau], [null, null]);
  assert.deepEqual(aller.session.vues, { admin: "/admin/questions?q=habillage" });
  assert.deepEqual([aller.session.debut, aller.session.exp], [1000, 2000], "le test ne prolonge rien");
  // Profil choisi à l'écran, sur le programme : il est gardé, et l'adresse perd le sien, qui le contredirait.
  const retour = basculerVue(
    aller.session,
    { ici: "/?parcours=maintien&filiere=prep&niveau=N2#modules", ecran: { filiere: "chimiotherapie", niveau: "N1b" } },
    connus,
  );
  assert.ok(retour);
  assert.equal(retour.cible, "/admin/questions?q=habillage");
  assert.deepEqual([retour.session.role, retour.session.libelle, retour.session.essai], ["admin", "Administration · essai", undefined]);
  assert.deepEqual(retour.session.vues, {
    admin: "/admin/questions?q=habillage",
    apprenant: "/?parcours=maintien",
    filiere: "chimiotherapie",
    niveau: "N1b",
  });
  // Second aller : le test rouvre le profil gardé, à la page quittée ; la page d'administration suit.
  const encore = basculerVue(retour.session, { ici: "/admin/journal" }, connus);
  assert.ok(encore);
  assert.equal(encore.cible, "/?parcours=maintien");
  assert.deepEqual([encore.session.filiere, encore.session.niveau], ["chimiotherapie", "N1b"]);
  assert.equal(encore.session.vues?.admin, "/admin/journal");
  // « Socle transversal seul », « Tous niveaux » choisis à l'écran : plus de profil.
  const vide = basculerVue(encore.session, { ici: "/", ecran: { filiere: "", niveau: "" } }, connus)!;
  assert.deepEqual([vide.session.vues?.filiere, vide.session.vues?.niveau], [null, null]);
});

test("interrupteur : sans le programme à l'écran, le profil de l'adresse, sinon celui du test", () => {
  const essai = basculerVue(admin, { ici: "/admin" }, connus)!.session;
  const page = "/module/m1?parcours=integration&filiere=prep&niveau=N1a";
  const surModule = basculerVue(essai, { ici: page }, connus)!;
  assert.deepEqual([surModule.session.vues?.filiere, surModule.session.vues?.niveau], ["prep", "N1a"]);
  assert.equal(surModule.session.vues?.apprenant, page, "page gardée telle quelle");
  const avecProfil = { ...essai, filiere: "chimiotherapie", niveau: "N2" };
  const reperes = basculerVue(avecProfil, { ici: "/reperes#niveaux" }, connus)!;
  assert.deepEqual([reperes.session.vues?.filiere, reperes.session.vues?.niveau], ["chimiotherapie", "N2"]);
  assert.equal(reperes.session.vues?.apprenant, "/reperes", "la page, sans son ancre");
  // Profil d'adresse inconnu du référentiel : celui du test.
  const inconnu = basculerVue(avecProfil, { ici: "/module/m1?filiere=inconnue&niveau=N1a" }, connus)!;
  assert.deepEqual([inconnu.session.vues?.filiere, inconnu.session.vues?.niveau], ["chimiotherapie", "N2"]);
});

test("interrupteur : profil gardé disparu, adresses refusées ; ni le tutorat ni un poste", () => {
  const garde: typeof admin = { ...admin, vues: { apprenant: "//exemple.org", filiere: "supprimee", niveau: "N2" } };
  const r = basculerVue(garde, { ici: "https://exemple.org" }, connus)!;
  assert.equal(r.cible, "/", "adresse gardée refusée : le programme");
  assert.deepEqual([r.session.filiere, r.session.niveau], [null, "N2"], "filière disparue : à choisir à l'écran");
  assert.equal(r.session.vues?.admin, undefined, "adresse d'administration refusée : rien de gardé");
  assert.equal(basculerVue(r.session, { ici: "/" }, connus)!.cible, "/accueil", "sans page d'administration gardée : l'accueil");
  assert.equal(basculerVue(tuteur, { ici: "/admin" }, connus), null, "tutorat : pas d'interrupteur");
  assert.equal(basculerVue(sessionDEssai(tuteur)!, { ici: "/" }, connus), null, "test du tutorat : pas d'interrupteur");
  assert.equal(basculerVue({ ...tuteur, role: "poste" }, { ici: "/" }, connus), null);
});
