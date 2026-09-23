import { test } from "node:test";
import assert from "node:assert/strict";
import { LIBELLES_STATUT_FICHE, auteurDeFiche, mentionValidation, numeroDeFiche } from "../content/fiches";
import { MOTIFS_SIGNALEMENT_FICHE } from "../content/signalements";
import { peutValider, validationParAuteur } from "../content/quatre-yeux";
import { SCHEMA } from "../lib/schema";
import { construireRapport, ligneFichesRemises, type ResultatRapport } from "../lib/rapport";

// ── Questions 59 et 60, choix a (23/09/2026)

const deposee = { depose_par: "tuteur · Tuteur chimio", depose_par_acces: 3, edite_par: null, edite_par_acces: null };
const tuteur = { role: "tuteur", libelle: "Tuteur chimio", acces: 3 };
const autreTuteur = { role: "tuteur", libelle: "Tuteur isolateur", acces: 4 };
const admin = { role: "admin", libelle: "PHARMACIEN", acces: 1 };

test("fiche : quatre yeux comme pour une question, l'administration valide aussi les siennes, tracé", () => {
  const auteur = auteurDeFiche(deposee);
  assert.equal(peutValider(auteur, tuteur), false, "le déposant ne valide pas sa fiche");
  assert.equal(peutValider(auteur, autreTuteur), true);
  assert.equal(validationParAuteur(auteur, autreTuteur), false);
  const corrigee = auteurDeFiche({ ...deposee, edite_par: "tuteur · Tuteur isolateur", edite_par_acces: 4 });
  assert.equal(peutValider(corrigee, autreTuteur), false, "qui corrige devient l'auteur courant");
  assert.equal(peutValider(corrigee, tuteur), true, "le premier déposant peut alors valider la correction");
  const del = auteurDeFiche({ ...deposee, depose_par: "admin · PHARMACIEN", depose_par_acces: 1 });
  assert.equal(peutValider(del, admin), true);
  assert.equal(validationParAuteur(del, admin), true, "validation par son auteur d'administration : tracée");
  // fiche déposée avant la règle : le rôle seul, sans code — elle est déjà validée d'office
  assert.equal(peutValider(auteurDeFiche({ ...deposee, depose_par: "tuteur", depose_par_acces: null }), tuteur), true);
});

test("fiche : mention de validation — validateur, auteur, ou validée d'office avant la règle", () => {
  assert.equal(
    mentionValidation({ valideeLe: "2026-09-23T15:00:00.000Z", valideePar: "admin · PHARMACIEN", valideeParAuteur: false }),
    "validée le 23/09/2026 par admin · PHARMACIEN",
  );
  assert.equal(
    mentionValidation({ valideeLe: "2026-09-23T15:00:00.000Z", valideePar: "admin · PHARMACIEN", valideeParAuteur: true }),
    "validée le 23/09/2026 par admin · PHARMACIEN (son auteur)",
  );
  assert.equal(
    mentionValidation({ valideePar: null, deposeeLe: "2026-09-20T08:00:00.000Z" }),
    "validée d'office : déposée le 20/09/2026, avant la règle du 23/09/2026",
  );
  assert.equal(
    mentionValidation({ valideeLe: "2026-09-23T22:30:00.000Z", valideePar: "tuteur · X" }),
    "validée le 24/09/2026 par tuteur · X",
    "la date se lit à l'heure de Paris, où qu'elle soit calculée",
  );
});

test("fiche : identifiant d'écran, statuts et motifs de signalement", () => {
  assert.equal(numeroDeFiche("depot-12"), 12);
  assert.equal(numeroDeFiche("depot-"), null);
  assert.equal(numeroDeFiche("12"), null);
  assert.equal(numeroDeFiche("depot-1 OR 1=1"), null);
  assert.deepEqual(Object.keys(LIBELLES_STATUT_FICHE), ["a_verifier", "valide", "retire"]);
  const contrainte = SCHEMA.find((l) => l.includes("depots_statut_check CHECK"));
  assert.ok(contrainte, "statuts contraints en base");
  assert.match(contrainte!, /'a_verifier','valide','retire'/);
  assert.ok((MOTIFS_SIGNALEMENT_FICHE as readonly string[]).includes("Fichier illisible ou qui ne s'ouvre pas"));
  assert.equal(MOTIFS_SIGNALEMENT_FICHE[MOTIFS_SIGNALEMENT_FICHE.length - 1], "Autre");
});

test("schéma : un document déjà déposé reste validé, un signalement peut viser une fiche sans question", () => {
  assert.ok(SCHEMA.includes("ALTER TABLE depots ADD COLUMN IF NOT EXISTS statut TEXT NOT NULL DEFAULT 'valide'"));
  assert.ok(SCHEMA.includes("ALTER TABLE signalements ALTER COLUMN question_id DROP NOT NULL"));
  assert.ok(SCHEMA.includes("ALTER TABLE signalements ADD COLUMN IF NOT EXISTS depot_id INTEGER"));
  assert.ok(
    SCHEMA.indexOf("ALTER TABLE signalements ADD COLUMN IF NOT EXISTS depot_id INTEGER") <
      SCHEMA.findIndex((l) => l.includes("ENABLE ROW LEVEL SECURITY")),
    "colonnes ajoutées avant la RLS",
  );
});

test("rapport : la fiche remise est citée ; un résultat antérieur ne dit rien", () => {
  const fiche = {
    id: "depot-3",
    titre: "Synthèse ZAC",
    url: "/api/fichiers/x",
    affichage: "pdf" as const,
    deposeeLe: "2026-09-23T08:00:00.000Z",
    valideeLe: "2026-09-23T09:00:00.000Z",
    valideePar: "admin · PHARMACIEN",
    valideeParAuteur: false,
  };
  assert.equal(
    ligneFichesRemises([fiche]),
    "Fiche de synthèse remise en fin de test : Synthèse ZAC (validée le 23/09/2026 par admin · PHARMACIEN).",
  );
  assert.equal(ligneFichesRemises([]), "Aucune fiche de synthèse validée pour ce module au moment de l'évaluation.");
  assert.match(ligneFichesRemises([fiche, { ...fiche, titre: "Autre" }]), /^Fiches de synthèse remises en fin de test : /);

  const resultat = {
    moduleId: "m",
    moduleTitre: "Module",
    critereId: null,
    seuilReussite: 80,
    pointsObtenus: 1,
    pointsTotal: 1,
    score: 100,
    echecEliminatoire: false,
    reussi: true,
    verdict: "acquis",
    bande: 0,
    bandeBasse: 80,
    bandeHaute: 80,
    concluant: true,
    minQuestions: 1,
    bareme: undefined,
    detail: [],
    horodatage: "23 septembre 2026",
    horodatageIso: "2026-09-23T10:00:00.000Z",
    tirage: "",
    jeton: "x",
  } as unknown as ResultatRapport;
  const avec = construireRapport({ nom: "", qualite: "", parcours: "" }, [{ ...resultat, fiches: [fiche] }]);
  assert.ok(avec.includes("Fiche de synthèse remise en fin de test : Synthèse ZAC"), "citée dans le rapport imprimable");
  const sans = construireRapport({ nom: "", qualite: "", parcours: "" }, [resultat]);
  assert.equal(sans.includes("Fiche de synthèse remise"), false);
  assert.equal(sans.includes("Aucune fiche de synthèse validée"), false, "rapport antérieur : aucune mention");
});
