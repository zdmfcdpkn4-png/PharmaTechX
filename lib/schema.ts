/**
 * Schéma de la base, appliqué automatiquement au premier accès (voir
 * `garantirSchema()` dans `lib/db.ts`). Chaque instruction est idempotente :
 * relancer l'ensemble sur une base déjà à jour ne change rien.
 *
 * Portable : PostgreSQL standard, sans extension. Fonctionne sur Supabase
 * (base retenue le 18/09/2026), Render, Neon (Vercel) ou une instance locale.
 *
 * Sécurité au niveau des lignes (RLS) activée sur chaque table, sans aucune
 * politique : sur Supabase, le schéma `public` est exposé par l'API de
 * données (PostgREST) avec une clé « anon » conçue pour être publique, et une
 * table sans RLS y serait lisible et modifiable. Les rôles de l'API
 * n'obtiennent rien ; le rôle de `DATABASE_URL`, propriétaire des tables
 * qu'il a créées, n'est pas soumis à RLS. Sans effet sur un PostgreSQL
 * ordinaire. Les droits accordés par défaut aux rôles de l'API (`anon`,
 * `authenticated`) sont retirés quand ces rôles existent.
 *
 * Aucune table ne porte de nom d'agent. Les rapports enregistrés
 * (`CONSERVATION_RAPPORTS=pseudonyme`) se rattachent à un identifiant d'agent
 * généré (`agents`), dont la correspondance avec la personne est tenue hors
 * du site ; les visas portent le rôle et le libellé du code de session.
 * Décision du 18/09/2026 (question 6, choix a).
 */
/** Toutes les tables du site, dans l'ordre de création. */
export const TABLES = [
  "acces",
  "ordonnancement",
  "depots",
  "fichiers",
  "images",
  "situations",
  "depots_questions",
  "questions",
  "signalements",
  "agents",
  "rapports",
  "visas",
  "journal",
  "tentatives_connexion",
  "signatures",
  "modules_deposes",
  "reglages_modules",
  "parametres",
  "progression",
  "en_cours",
  "filieres_deposees",
  "niveaux_deposes",
] as const;

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
     format        TEXT NOT NULL CHECK (format IN ('QCM','QIM','SCH','ORD','TAT')),
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

  // ── agents pseudonymes : un identifiant généré, sans nom (décision Q6, a) ──
  `CREATE TABLE IF NOT EXISTS agents (
     id          SERIAL PRIMARY KEY,
     identifiant TEXT NOT NULL UNIQUE,
     actif       BOOLEAN NOT NULL DEFAULT TRUE,
     cree_le     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     clos_le     TIMESTAMPTZ
   )`,

  // ── rapports d'évaluation et visas (conservation pseudonyme, sur décision) ─
  `CREATE SEQUENCE IF NOT EXISTS rapports_numero_seq`,
  `CREATE TABLE IF NOT EXISTS rapports (
     id                TEXT PRIMARY KEY,
     numero            TEXT NOT NULL UNIQUE,
     module_id         TEXT NOT NULL,
     module_titre      TEXT NOT NULL,
     critere_id        TEXT,
     agent_id          INTEGER NOT NULL REFERENCES agents(id),
     agent_identifiant TEXT NOT NULL,
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

  // ── modules déposés depuis l'administration (décision du 18/09/2026,
  // question 10) : titre, objectif, présentation courte, rattachement à un
  // critère de la fiche, profils (filières, niveaux, parcours), seuil propre,
  // cycle brouillon → publié → retiré. Les questions et documents s'y
  // rattachent par `module_id`. Aucune donnée nominative.
  `CREATE TABLE IF NOT EXISTS modules_deposes (
     id            TEXT PRIMARY KEY,
     titre         TEXT NOT NULL,
     objectif      TEXT NOT NULL DEFAULT '',
     presentation  TEXT NOT NULL DEFAULT '',
     critere_id    TEXT,
     filieres      JSONB NOT NULL DEFAULT '[]'::jsonb,
     niveaux       JSONB NOT NULL DEFAULT '[]'::jsonb,
     parcours      JSONB NOT NULL DEFAULT '["integration","maintien"]'::jsonb,
     seuil         INTEGER NOT NULL DEFAULT 80 CHECK (seuil BETWEEN 50 AND 100),
     duree_minutes INTEGER NOT NULL DEFAULT 0,
     statut        TEXT NOT NULL DEFAULT 'brouillon' CHECK (statut IN ('brouillon','publie','retire')),
     cree_par      TEXT NOT NULL,
     cree_le       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     edite_le      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     publie_le     TIMESTAMPTZ,
     version       INTEGER NOT NULL DEFAULT 1
   )`,
  // seuil de réussite réglé pour un module du code (sinon : seuil par défaut du barème)
  `CREATE TABLE IF NOT EXISTS reglages_modules (
     module_id   TEXT PRIMARY KEY,
     seuil       INTEGER NOT NULL CHECK (seuil BETWEEN 50 AND 100),
     modifie_par TEXT NOT NULL,
     modifie_le  TIMESTAMPTZ NOT NULL DEFAULT NOW()
   )`,
  // paramètres réglables du site (clé « bareme » : content/bareme.ts)
  `CREATE TABLE IF NOT EXISTS parametres (
     cle         TEXT PRIMARY KEY,
     valeur      JSONB NOT NULL,
     modifie_par TEXT NOT NULL,
     modifie_le  TIMESTAMPTZ NOT NULL DEFAULT NOW()
   )`,

  // ── progression d'apprentissage sous identifiant d'agent (décision du
  // 18/09/2026, question 11, choix c) : évaluations (résultat scellé complet),
  // entraînements (score) et lectures, rattachés à l'agent qui s'est
  // identifié par son identifiant et son code personnel ; session d'évaluation
  // en cours pour la reprise. Données pseudonymisées : docs/RGPD.md.
  `CREATE TABLE IF NOT EXISTS progression (
     id        SERIAL PRIMARY KEY,
     agent_id  INTEGER NOT NULL REFERENCES agents(id),
     module_id TEXT NOT NULL,
     nature    TEXT NOT NULL CHECK (nature IN ('evaluation','entrainement','lecture')),
     resultat  JSONB,
     score     INTEGER,
     verdict   TEXT,
     cree_le   TIMESTAMPTZ NOT NULL DEFAULT NOW()
   )`,
  `CREATE INDEX IF NOT EXISTS progression_agent ON progression (agent_id, cree_le)`,
  `CREATE TABLE IF NOT EXISTS en_cours (
     agent_id  INTEGER NOT NULL REFERENCES agents(id),
     module_id TEXT NOT NULL,
     etat      JSONB NOT NULL,
     maj_le    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     PRIMARY KEY (agent_id, module_id)
   )`,

  // ── colonnes ajoutées après la première version (idempotent) ──────────────
  `ALTER TABLE acces ADD COLUMN IF NOT EXISTS signature_id TEXT`,
  // décision du 18/09/2026 (question 16, choix b) : date de la dernière
  // révocation du code, qui ferme les sessions ouvertes avant elle
  `ALTER TABLE acces ADD COLUMN IF NOT EXISTS ferme_le TIMESTAMPTZ`,
  // décision du 18/09/2026 (question 18, choix c) : question réservée à
  // l'évaluation, jamais posée en entraînement ni en Découverte
  `ALTER TABLE questions ADD COLUMN IF NOT EXISTS reservee BOOLEAN NOT NULL DEFAULT FALSE`,
  // réglage des modules du code (décision du 19/09/2026, question 36, choix a) :
  // filières, niveaux et parcours d'un critère se règlent en administration,
  // en écart assumé à la fiche d'habilitation. NULL = ce que dit la fiche.
  `ALTER TABLE reglages_modules ALTER COLUMN seuil DROP NOT NULL`,
  `ALTER TABLE reglages_modules ADD COLUMN IF NOT EXISTS filieres JSONB`,
  `ALTER TABLE reglages_modules ADD COLUMN IF NOT EXISTS niveaux JSONB`,
  `ALTER TABLE reglages_modules ADD COLUMN IF NOT EXISTS parcours JSONB`,
  // décision : arbitrage motivé du tuteur (verdict indéterminé) et questions
  // exclues du calcul (retirées de la banque après signalement), fixées au
  // premier acte de décision — NULL tant qu'elles ne le sont pas.
  `ALTER TABLE rapports ADD COLUMN IF NOT EXISTS arbitrage JSONB`,
  `ALTER TABLE rapports ADD COLUMN IF NOT EXISTS exclusions JSONB`,
  // le visa du pharmacien référence l'image de signature incrustée
  `ALTER TABLE visas ADD COLUMN IF NOT EXISTS signature_id TEXT`,
  // décision du 18/09/2026 (question 6, choix a) : plus aucun nom en base ;
  // les rapports se rattachent à un identifiant d'agent. Sur une base créée
  // avant cette version (aucune en production), les colonnes nominatives
  // disparaissent et les rapports existants perdent leur rattachement.
  `ALTER TABLE rapports DROP COLUMN IF EXISTS apprenant_nom`,
  `ALTER TABLE rapports DROP COLUMN IF EXISTS apprenant_qualite`,
  `ALTER TABLE rapports ADD COLUMN IF NOT EXISTS agent_id INTEGER REFERENCES agents(id)`,
  `ALTER TABLE rapports ADD COLUMN IF NOT EXISTS agent_identifiant TEXT`,
  `ALTER TABLE visas DROP COLUMN IF EXISTS nom`,
  // règle des quatre yeux (question 12) : code d'accès qui a créé la question,
  // dernier code qui l'a modifiée ; la validation vient d'un autre code
  `ALTER TABLE questions ADD COLUMN IF NOT EXISTS cree_par_acces INTEGER`,
  `ALTER TABLE questions ADD COLUMN IF NOT EXISTS edite_par TEXT`,
  `ALTER TABLE questions ADD COLUMN IF NOT EXISTS edite_par_acces INTEGER`,
  // séquence à ordonner et texte à trous (19/09/2026) : la contrainte de
  // format est refaite, une base en service ne l'aurait qu'aux trois anciens
  `ALTER TABLE questions DROP CONSTRAINT IF EXISTS questions_format_check`,
  `ALTER TABLE questions ADD CONSTRAINT questions_format_check CHECK (format IN ('QCM','QIM','SCH','ORD','TAT'))`,
  // code personnel de l'agent (haché, scrypt) pour rattacher sa progression — question 11
  `ALTER TABLE agents ADD COLUMN IF NOT EXISTS code_hash TEXT`,
  `ALTER TABLE agents ADD COLUMN IF NOT EXISTS code_maj_le TIMESTAMPTZ`,
  // documents liés à un ou plusieurs profils (filières, niveaux) — question 10
  `ALTER TABLE depots ADD COLUMN IF NOT EXISTS filieres JSONB NOT NULL DEFAULT '[]'::jsonb`,
  `ALTER TABLE depots ADD COLUMN IF NOT EXISTS niveaux JSONB NOT NULL DEFAULT '[]'::jsonb`,

  // ── référentiel déposé : filières et niveaux (question 38, choix b) ───────
  // La fiche d'habilitation versionnée (`content/habilitation.ts`) reste la
  // référence ; ces tables l'étendent et la corrigent. Un rapport émis scelle
  // les libellés du moment, il ne dépend donc pas de ces tables pour se relire.
  `CREATE TABLE IF NOT EXISTS filieres_deposees (
     id          TEXT PRIMARY KEY,
     libelle     TEXT NOT NULL,
     description TEXT NOT NULL DEFAULT '',
     badge       TEXT NOT NULL DEFAULT '',
     blocs       JSONB NOT NULL DEFAULT '[]'::jsonb,
     rang        INTEGER NOT NULL DEFAULT 0,
     actif       BOOLEAN NOT NULL DEFAULT TRUE,
     cree_le     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     modifie_le  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     modifie_par TEXT NOT NULL DEFAULT ''
   )`,
  `CREATE TABLE IF NOT EXISTS niveaux_deposes (
     code        TEXT PRIMARY KEY,
     libelle     TEXT NOT NULL,
     filiere_id  TEXT NOT NULL,
     condition   TEXT NOT NULL DEFAULT '',
     prerequis   JSONB NOT NULL DEFAULT '[]'::jsonb,
     rang        INTEGER NOT NULL DEFAULT 0,
     actif       BOOLEAN NOT NULL DEFAULT TRUE,
     cree_le     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     modifie_le  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     modifie_par TEXT NOT NULL DEFAULT ''
   )`,
  `CREATE INDEX IF NOT EXISTS niveaux_deposes_filiere ON niveaux_deposes (filiere_id)`,

  // ── Supabase : API de données (voir l'en-tête) ─────────────────────────────
  ...TABLES.map((t) => `ALTER TABLE ${t} ENABLE ROW LEVEL SECURITY`),
  `DO $$
   DECLARE r TEXT;
   BEGIN
     FOR r IN SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated') LOOP
       EXECUTE format('REVOKE ALL ON TABLE ${TABLES.join(", ")} FROM %I', r);
     END LOOP;
   END $$`,
];

/** Numéro d'un rapport : RAP-2026-0001. */
export function formaterNumeroRapport(annee: number, seq: number): string {
  return `RAP-${annee}-${String(seq).padStart(4, "0")}`;
}
