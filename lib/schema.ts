/**
 * Schéma de la base, appliqué automatiquement au premier accès (voir
 * `garantirSchema()` dans `lib/db.ts`). Chaque instruction est idempotente :
 * relancer l'ensemble sur une base déjà à jour ne change rien.
 *
 * Portable : PostgreSQL standard, sans extension. Fonctionne sur Render
 * (Postgres managé), Supabase, Neon (Vercel) ou une instance locale.
 *
 * Ce qui porte une identité de personne — et seulement cela — est confiné aux
 * tables `rapports` et `visas`, alimentées uniquement quand la conservation
 * nominative des rapports est activée (`CONSERVATION_RAPPORTS=nominative`).
 */
export const SCHEMA: string[] = [
  // ── accès par code de rôle (inchangé) ─────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS acces (
     id            SERIAL PRIMARY KEY,
     code_hash     TEXT NOT NULL,
     role          TEXT NOT NULL CHECK (role IN ('admin','tuteur','poste')),
     libelle       TEXT NOT NULL,
     filiere       TEXT,
     niveau        TEXT,
     actif         BOOLEAN NOT NULL DEFAULT TRUE,
     cree_le       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     dernier_usage TIMESTAMPTZ
   )`,
  `CREATE TABLE IF NOT EXISTS ordonnancement (
     module_id TEXT NOT NULL,
     parcours  TEXT NOT NULL,
     rang      INTEGER NOT NULL,
     PRIMARY KEY (module_id, parcours)
   )`,
  `CREATE TABLE IF NOT EXISTS depots (
     id         SERIAL PRIMARY KEY,
     titre      TEXT NOT NULL,
     nature     TEXT NOT NULL,
     url        TEXT NOT NULL,
     module_id  TEXT,
     critere_id TEXT,
     depose_le  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     depose_par TEXT NOT NULL
   )`,

  // ── fichiers déposés quand aucun store Blob n'est branché ─────────────────
  `CREATE TABLE IF NOT EXISTS fichiers (
     id       TEXT PRIMARY KEY,
     nom      TEXT NOT NULL,
     type     TEXT NOT NULL,
     octets   BYTEA NOT NULL,
     taille   INTEGER NOT NULL,
     cree_le  TIMESTAMPTZ NOT NULL DEFAULT NOW()
   )`,

  // ── images des schémas à compléter (PNG ou JPEG, en base) ─────────────────
  `CREATE TABLE IF NOT EXISTS images (
     id       TEXT PRIMARY KEY,
     type     TEXT NOT NULL CHECK (type IN ('image/png','image/jpeg')),
     octets   BYTEA NOT NULL,
     largeur  INTEGER NOT NULL CHECK (largeur > 0),
     hauteur  INTEGER NOT NULL CHECK (hauteur > 0),
     alt      TEXT NOT NULL DEFAULT '',
     cree_le  TIMESTAMPTZ NOT NULL DEFAULT NOW()
   )`,

  // ── banque de questions déposée par les tuteurs et administrateurs ────────
  `CREATE TABLE IF NOT EXISTS situations (
     id        TEXT PRIMARY KEY,
     module_id TEXT NOT NULL,
     titre     TEXT NOT NULL,
     contexte  TEXT NOT NULL,
     cree_le   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     edite_le  TIMESTAMPTZ NOT NULL DEFAULT NOW()
   )`,
  `CREATE TABLE IF NOT EXISTS depots_questions (
     id            TEXT PRIMARY KEY,
     nom           TEXT NOT NULL,
     module_id     TEXT NOT NULL,
     nb            INTEGER NOT NULL DEFAULT 0,
     nb_a_verifier INTEGER NOT NULL DEFAULT 0,
     depose_par    TEXT NOT NULL,
     depose_le     TIMESTAMPTZ NOT NULL DEFAULT NOW()
   )`,
  `CREATE TABLE IF NOT EXISTS questions (
     id            TEXT PRIMARY KEY,
     module_id     TEXT NOT NULL,
     situation_id  TEXT REFERENCES situations(id) ON DELETE SET NULL,
     format        TEXT NOT NULL CHECK (format IN ('QCM','QIM','SCH')),
     enonce        TEXT NOT NULL,
     options       JSONB NOT NULL DEFAULT '[]'::jsonb,
     legendes      JSONB NOT NULL DEFAULT '[]'::jsonb,
     mode_reponse  TEXT NOT NULL DEFAULT 'ecrire' CHECK (mode_reponse IN ('ecrire','choisir')),
     image_id      TEXT REFERENCES images(id) ON DELETE SET NULL,
     justification TEXT NOT NULL DEFAULT '',
     eliminatoire  BOOLEAN NOT NULL DEFAULT FALSE,
     refs          JSONB NOT NULL DEFAULT '[]'::jsonb,
     statut        TEXT NOT NULL DEFAULT 'a_verifier' CHECK (statut IN ('a_verifier','valide','retire')),
     depot_id      TEXT,
     rang          INTEGER NOT NULL DEFAULT 0,
     cree_par      TEXT NOT NULL,
     cree_le       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     valide_par    TEXT,
     valide_le     TIMESTAMPTZ,
     edite_le      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     version       INTEGER NOT NULL DEFAULT 1
   )`,
  `CREATE INDEX IF NOT EXISTS questions_module ON questions (module_id, statut)`,
  `CREATE TABLE IF NOT EXISTS signalements (
     id          SERIAL PRIMARY KEY,
     question_id TEXT NOT NULL,
     module_id   TEXT NOT NULL,
     motif       TEXT NOT NULL,
     note        TEXT NOT NULL DEFAULT '',
     statut      TEXT NOT NULL DEFAULT 'ouvert' CHECK (statut IN ('ouvert','traite','rejete')),
     cree_le     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     traite_par  TEXT,
     traite_le   TIMESTAMPTZ,
     reponse     TEXT
   )`,

  // ── rapports d'évaluation et visas (conservation nominative, sur décision) ─
  `CREATE SEQUENCE IF NOT EXISTS rapports_numero_seq`,
  `CREATE TABLE IF NOT EXISTS rapports (
     id                TEXT PRIMARY KEY,
     numero            TEXT NOT NULL UNIQUE,
     module_id         TEXT NOT NULL,
     module_titre      TEXT NOT NULL,
     critere_id        TEXT,
     apprenant_nom     TEXT NOT NULL,
     apprenant_qualite TEXT NOT NULL DEFAULT '',
     tirage            TEXT NOT NULL DEFAULT '',
     resultat          JSONB NOT NULL,
     empreinte         TEXT NOT NULL,
     statut            TEXT NOT NULL DEFAULT 'emis' CHECK (statut IN ('emis','vise_tuteur','clos','annule')),
     emis_le           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     annule_motif      TEXT,
     annule_le         TIMESTAMPTZ
   )`,
  `CREATE INDEX IF NOT EXISTS rapports_statut ON rapports (statut, emis_le DESC)`,
  `CREATE TABLE IF NOT EXISTS visas (
     id              SERIAL PRIMARY KEY,
     rapport_id      TEXT NOT NULL REFERENCES rapports(id) ON DELETE CASCADE,
     qualite         TEXT NOT NULL CHECK (qualite IN ('apprenant','tuteur','pharmacien')),
     nom             TEXT NOT NULL,
     role_session    TEXT NOT NULL,
     libelle_session TEXT NOT NULL DEFAULT '',
     commentaire     TEXT NOT NULL DEFAULT '',
     empreinte       TEXT NOT NULL,
     signe_le        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     UNIQUE (rapport_id, qualite)
   )`,

  // ── journal des actions d'administration ──────────────────────────────────
  `CREATE TABLE IF NOT EXISTS journal (
     id      SERIAL PRIMARY KEY,
     quand   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     role    TEXT NOT NULL,
     libelle TEXT NOT NULL,
     action  TEXT NOT NULL,
     cible   TEXT NOT NULL DEFAULT '',
     details JSONB NOT NULL DEFAULT '{}'::jsonb
   )`,

  // ── limiteur de tentatives de connexion (clé = empreinte de l'adresse) ────
  `CREATE TABLE IF NOT EXISTS tentatives_connexion (
     cle           TEXT PRIMARY KEY,
     echecs        INTEGER NOT NULL DEFAULT 0,
     bloque_jusqua TIMESTAMPTZ,
     maj_le        TIMESTAMPTZ NOT NULL DEFAULT NOW()
   )`,

  // ── signature du pharmacien (modèle métrologie : une image, déposée une
  //    fois, incrustée dans chaque rapport clos) — une par code admin ─────────
  `CREATE TABLE IF NOT EXISTS signatures (
     id       TEXT PRIMARY KEY,
     acces_id INTEGER REFERENCES acces(id) ON DELETE SET NULL,
     type     TEXT NOT NULL CHECK (type IN ('image/png','image/jpeg')),
     octets   BYTEA NOT NULL,
     largeur  INTEGER NOT NULL CHECK (largeur > 0),
     hauteur  INTEGER NOT NULL CHECK (hauteur > 0),
     cree_le  TIMESTAMPTZ NOT NULL DEFAULT NOW()
   )`,

  // ── colonnes ajoutées après la première version (idempotent) ──────────────
  `ALTER TABLE acces ADD COLUMN IF NOT EXISTS signature_id TEXT`,
  // décision : arbitrage motivé du tuteur (verdict indéterminé) et questions
  // exclues du calcul (retirées de la banque après signalement), fixées au
  // premier acte de décision — NULL tant qu'elles ne le sont pas.
  `ALTER TABLE rapports ADD COLUMN IF NOT EXISTS arbitrage JSONB`,
  `ALTER TABLE rapports ADD COLUMN IF NOT EXISTS exclusions JSONB`,
  // le visa du pharmacien référence l'image de signature incrustée
  `ALTER TABLE visas ADD COLUMN IF NOT EXISTS signature_id TEXT`,
];

/** Numéro d'un rapport : RAP-2026-0001. */
export function formaterNumeroRapport(annee: number, seq: number): string {
  return `RAP-${annee}-${String(seq).padStart(4, "0")}`;
}
