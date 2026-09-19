import { test } from "node:test";
import assert from "node:assert/strict";
import { TUTORIEL, VERSION_TUTORIEL, cleTutoriel, etapesTutoriel, type ProfilTutoriel } from "../content/tutoriel";

const PROFILS: ProfilTutoriel[] = ["poste", "tuteur", "admin"];

test("les trois profils ont une visite", () => {
  for (const p of PROFILS) {
    assert.ok(TUTORIEL[p].length > 0, `profil ${p} sans étape`);
  }
  assert.equal(Object.keys(TUTORIEL).length, 3);
});

test("une visite reste courte : au plus six étapes", () => {
  for (const p of PROFILS) {
    assert.ok(TUTORIEL[p].length <= 6, `profil ${p} : ${TUTORIEL[p].length} étapes`);
  }
});

test("sans conservation, aucune étape ne renvoie à un écran qui n'existe pas", () => {
  // `/admin/rapports` et `/admin/personnel` ne paraissent au volet qu'en mode
  // pseudonyme ; `/#progression` non plus. La visite ne doit pas les citer.
  const absents = ["/admin/rapports", "/admin/personnel", "/#progression"];
  for (const p of PROFILS) {
    for (const e of etapesTutoriel(p, false)) {
      assert.ok(!absents.includes(e.href ?? ""), `profil ${p} : ${e.href} cité sans conservation`);
    }
  }
});

test("avec conservation, les étapes réservées reparaissent", () => {
  for (const p of PROFILS) {
    const avec = etapesTutoriel(p, true).length;
    const sans = etapesTutoriel(p, false).length;
    assert.ok(avec >= sans, `profil ${p}`);
  }
  assert.ok(etapesTutoriel("poste", true).length > etapesTutoriel("poste", false).length);
  assert.ok(etapesTutoriel("tuteur", true).length > etapesTutoriel("tuteur", false).length);
  assert.ok(etapesTutoriel("admin", true).length > etapesTutoriel("admin", false).length);
});

test("la première étape de chaque profil n'envoie nulle part", () => {
  // Une visite s'ouvre sur ce qu'on vient d'obtenir, pas sur un lien qui la
  // ferait quitter avant d'avoir commencé.
  for (const p of PROFILS) {
    assert.equal(TUTORIEL[p][0].href, undefined, `profil ${p}`);
  }
});

test("toute étape qui porte une adresse porte aussi le libellé de son lien", () => {
  for (const p of PROFILS) {
    for (const e of TUTORIEL[p]) {
      if (e.href) assert.ok(e.lien && e.lien.length > 0, `profil ${p} : ${e.href} sans libellé`);
    }
  }
});

test("un profil de poste ne voit aucun écran d'administration", () => {
  for (const e of TUTORIEL.poste) {
    assert.ok(!(e.href ?? "").startsWith("/admin"), `poste : ${e.href}`);
  }
});

test("le tutorat ne voit pas les écrans réservés à l'administration", () => {
  // Barème, référentiel, signature, journal et gestion des accès sont sous
  // `session?.role === "admin"` dans le gabarit racine.
  const reserves = ["/admin/bareme", "/admin/referentiel", "/admin/signature", "/admin/journal", "/admin"];
  for (const e of TUTORIEL.tuteur) {
    assert.ok(!reserves.includes(e.href ?? ""), `tutorat : ${e.href}`);
  }
});

test("la clé de mémorisation porte le profil et la version, jamais une personne", () => {
  assert.equal(cleTutoriel("poste"), `fp-tutoriel-poste-v${VERSION_TUTORIEL}`);
  const cles = PROFILS.map(cleTutoriel);
  assert.equal(new Set(cles).size, 3, "deux profils partagent une clé");
});

test("les textes sont renseignés et tiennent en quelques lignes", () => {
  for (const p of PROFILS) {
    for (const e of TUTORIEL[p]) {
      assert.ok(e.titre.trim().length > 0, `profil ${p} : titre vide`);
      assert.ok(e.texte.trim().length > 40, `profil ${p} : « ${e.titre} » trop court`);
      assert.ok(e.texte.length <= 320, `profil ${p} : « ${e.titre} » trop long (${e.texte.length})`);
    }
  }
});
