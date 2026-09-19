import "server-only";
import { readFileSync } from "node:fs";
import { Pool, type PoolClient, type QueryResultRow } from "pg";
import { SCHEMA } from "./schema";
import { fabriqueSocket, familleIp, protocoleTls } from "./reseau";
import { conformiteInstance } from "./instance";
import { hacherCode } from "./codes";

/**
 * Accès à la base — PostgreSQL standard via `pg`.
 *
 * Portable : la même chaîne de connexion sert sur Render (Postgres managé),
 * Supabase, Neon / Vercel ou en local. `DATABASE_URL` est lue en premier,
 * `POSTGRES_URL` (nom posé automatiquement par Vercel) en repli.
 *
 * TLS (`DATABASE_SSL`) : `disable` | `require` (chiffre sans vérifier
 * l'autorité — nécessaire avec l'autorité privée de Supabase) | `verify`
 * (vérifie la chaîne avec `DATABASE_SSL_CA` en PEM ou `DATABASE_SSL_CA_FILE`).
 * Défaut : `disable` sur un hôte local, `require` ailleurs. Le paramètre
 * `sslmode` de l'URL est retiré pour que ce réglage soit le seul qui compte.
 *
 * Famille d'adresses (`DATABASE_IP`, `lib/reseau.ts`) : `4` par défaut. La
 * base Supabase est jointe par son pooler de session (IPv4) ; l'hôte direct
 * n'a qu'une adresse IPv6, injoignable depuis Render `[à vérifier]`.
 *
 * Le schéma (`lib/schema.ts`) est appliqué au premier accès, sous verrou
 * consultatif : plusieurs instances peuvent démarrer en même temps.
 *
 * Le site fonctionne sans base : le contrôle d'accès est alors inactif et les
 * écrans d'administration affichent la marche à suivre.
 */

export function urlBase(): string | undefined {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || undefined;
}

export function baseConfiguree(): boolean {
  return Boolean(urlBase());
}

export function blobConfigure(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

function hoteLocal(u: URL): boolean {
  return ["localhost", "127.0.0.1", "::1", "[::1]"].includes(u.hostname);
}

function optionsTls(u: URL): false | { rejectUnauthorized: boolean; ca?: string } {
  const mode = (process.env.DATABASE_SSL ?? (hoteLocal(u) ? "disable" : "require")).toLowerCase();
  if (mode === "disable" || mode === "false" || mode === "0") return false;
  if (mode === "verify") {
    const ca =
      process.env.DATABASE_SSL_CA ||
      (process.env.DATABASE_SSL_CA_FILE
        ? readFileSync(process.env.DATABASE_SSL_CA_FILE, "utf8")
        : undefined);
    return { rejectUnauthorized: true, ...(ca ? { ca } : {}) };
  }
  return { rejectUnauthorized: false };
}

/** Un seul pool par processus, y compris à travers les rechargements de dev. */
const g = globalThis as unknown as {
  __fpPool?: Pool;
  __fpSchema?: Promise<void>;
  /** Protocole TLS constaté à l'ouverture de la dernière connexion du pool. */
  __fpTls?: string;
  /** Refus d'instance déjà journalisé : une ligne par processus, pas par requête. */
  __fpRefusSignale?: boolean;
};

function pool(): Pool {
  if (g.__fpPool) return g.__fpPool;
  const brut = urlBase();
  if (!brut) throw new Error("Base de données non configurée (DATABASE_URL).");
  const u = new URL(brut);
  for (const p of ["sslmode", "ssl", "sslcert", "sslkey", "sslrootcert"]) u.searchParams.delete(p);
  g.__fpPool = new Pool({
    connectionString: u.toString(),
    ssl: optionsTls(u),
    stream: fabriqueSocket(familleIp()),
    max: Number(process.env.DATABASE_POOL_MAX ?? 5),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
  // Une connexion inactive coupée par le serveur (pause ou maintenance d'une
  // base managée) émet `error` sur le pool ; sans écouteur, le processus
  // s'arrêterait. Le client est retiré du pool, la requête suivante en ouvre un autre.
  g.__fpPool.on("error", (e) => {
    console.error(`[base] connexion inactive perdue : ${e.message}`);
  });
  // Chiffrement constaté à l'ouverture, pas à la demande : la page de santé le
  // lit sans ouvrir de connexion, donc sans risque de la ralentir (Render s'en
  // sert comme contrôle de santé).
  g.__fpPool.on("connect", (client) => {
    g.__fpTls = protocoleTls(client);
  });
  return g.__fpPool;
}

/** Étiquette d'instance inscrite dans la base ; `null` si la table ou la clé manque. */
async function etiquetteInscrite(c: Pool | PoolClient): Promise<string | null> {
  const t = await c.query<{ existe: string | null }>(
    "SELECT to_regclass('public.parametres')::text AS existe",
  );
  if (!t.rows[0]?.existe) return null;
  const r = await c.query<{ valeur: unknown }>(
    "SELECT valeur FROM parametres WHERE cle = 'instance'",
  );
  const v = r.rows[0]?.valeur;
  return typeof v === "string" ? v : null;
}

/** Refus d'instance : code stable pour la page de santé, une ligne au journal. */
function refusInstance(raison: string): Error {
  if (!g.__fpRefusSignale) {
    g.__fpRefusSignale = true;
    console.error(`[base] refus d'instance : ${raison}`);
  }
  return Object.assign(new Error(raison), { code: "INSTANCE_REFUSEE" });
}

/**
 * Amorçage du premier administrateur, par variable d'environnement.
 *
 * Décision du 19/09/2026 : **aucun bouton public** ne crée cet accès. La page
 * de connexion étant ouverte à tous, un bouton d'amorçage y aurait offert le
 * rôle d'administrateur au premier venu, entre le branchement de la base et
 * la création du compte. La porte est donc côté hébergeur : poser
 * `ADMIN_INITIAL` dans le tableau de bord, redéployer, se connecter avec ce
 * code, créer ses propres codes, révoquer celui-ci, puis **supprimer la
 * variable**.
 *
 * L'insertion n'a lieu que si aucun administrateur actif n'existe : laisser la
 * variable en place ne crée pas de second compte, et l'amorçage ne se rouvre
 * pas de lui-même. L'opération est journalisée dans la même transaction que le
 * schéma, sous le verrou consultatif : deux instances qui démarrent ensemble
 * n'en créent qu'un.
 */
async function amorcerAdministrateur(c: PoolClient): Promise<void> {
  const code = (process.env.ADMIN_INITIAL ?? "").trim();
  if (code.length < 8) return;
  const deja = await c.query(
    "SELECT 1 FROM acces WHERE role = 'admin' AND actif = TRUE LIMIT 1",
  );
  if ((deja.rowCount ?? 0) > 0) return;
  const cree = await c.query<{ id: number }>(
    "INSERT INTO acces (code_hash, role, libelle) VALUES ($1, 'admin', $2) RETURNING id",
    [hacherCode(code), "Administrateur initial"],
  );
  await c.query(
    `INSERT INTO journal (role, libelle, action, cible, details)
     VALUES ('systeme', 'amorçage', 'creation-code', 'admin', $1::jsonb)`,
    [JSON.stringify({ libelle: "Administrateur initial", acces: cree.rows[0].id })],
  );
}

/**
 * Applique le schéma une fois par processus. Le verrou consultatif
 * transactionnel sérialise les instances qui démarrent ensemble.
 *
 * L'étiquette d'instance (question 23, choix b) est contrôlée dans la même
 * transaction, avant la première instruction : une base étiquetée n'est
 * servie que par un environnement qui la réclame (`BASE_ATTENDUE`), sans quoi
 * rien n'est appliqué et l'erreur remonte à chaque accès. L'étiquette
 * s'inscrit après le schéma, la table `parametres` devant exister.
 */
export function garantirSchema(): Promise<void> {
  if (g.__fpSchema) return g.__fpSchema;
  g.__fpSchema = (async () => {
    const c = await pool().connect();
    try {
      await c.query("BEGIN");
      await c.query("SELECT pg_advisory_xact_lock(7452026)");
      const conformite = conformiteInstance(process.env.BASE_ATTENDUE, await etiquetteInscrite(c));
      if (!conformite.ok) throw refusInstance(conformite.raison ?? "instance refusée");
      for (const instruction of SCHEMA) await c.query(instruction);
      if (conformite.aInscrire) {
        await c.query(
          `INSERT INTO parametres (cle, valeur, modifie_par)
           VALUES ('instance', to_jsonb($1::text), 'environnement')
           ON CONFLICT (cle) DO NOTHING`,
          [conformite.aInscrire],
        );
      }
      await amorcerAdministrateur(c);
      await c.query("COMMIT");
    } catch (e) {
      await c.query("ROLLBACK").catch(() => undefined);
      g.__fpSchema = undefined;
      throw e;
    } finally {
      c.release();
    }
  })();
  return g.__fpSchema;
}

/** Réinitialise l'application du schéma (tests). */
export function oublierSchema(): void {
  g.__fpSchema = undefined;
}

export interface Resultat<T> {
  rows: T[];
  rowCount: number;
}

/**
 * Requête paramétrée en gabarit : `sql\`SELECT … WHERE id = ${id}\`` devient
 * `SELECT … WHERE id = $1`. Les valeurs ne sont jamais interpolées dans le
 * texte de la requête.
 */
export async function sql<T extends QueryResultRow = QueryResultRow>(
  morceaux: TemplateStringsArray,
  ...valeurs: unknown[]
): Promise<Resultat<T>> {
  await garantirSchema();
  const r = await pool().query<T>(texteRequete(morceaux), valeurs);
  return { rows: r.rows, rowCount: r.rowCount ?? 0 };
}

/**
 * Requête paramétrée écrite en clair (`$1`, `$2`…), pour les cas où une
 * partie constante du texte — une liste de colonnes — ne doit pas être
 * paramétrée. Les valeurs, elles, le sont toujours.
 */
export async function requete<T extends QueryResultRow = QueryResultRow>(
  texte: string,
  valeurs: unknown[] = [],
): Promise<Resultat<T>> {
  await garantirSchema();
  const r = await pool().query<T>(texte, valeurs);
  return { rows: r.rows, rowCount: r.rowCount ?? 0 };
}

/** Même gabarit, sur un client de transaction. */
export function sqlSur(client: PoolClient) {
  return async <T extends QueryResultRow = QueryResultRow>(
    morceaux: TemplateStringsArray,
    ...valeurs: unknown[]
  ): Promise<Resultat<T>> => {
    const r = await client.query<T>(texteRequete(morceaux), valeurs);
    return { rows: r.rows, rowCount: r.rowCount ?? 0 };
  };
}

export async function transaction<T>(travail: (client: PoolClient) => Promise<T>): Promise<T> {
  await garantirSchema();
  const c = await pool().connect();
  try {
    await c.query("BEGIN");
    const r = await travail(c);
    await c.query("COMMIT");
    return r;
  } catch (e) {
    await c.query("ROLLBACK").catch(() => undefined);
    throw e;
  } finally {
    c.release();
  }
}

export function texteRequete(morceaux: TemplateStringsArray): string {
  let texte = "";
  morceaux.forEach((m, i) => {
    texte += m;
    if (i < morceaux.length - 1) texte += `$${i + 1}`;
  });
  return texte;
}

export interface EtatBase {
  joignable: boolean;
  /** Code de l'erreur de connexion (`ENOTFOUND`, `ECONNREFUSED`, `28P01`…), jamais la chaîne de connexion. */
  erreur: string | null;
  /** Étiquette d'instance inscrite dans la base (question 23) : « service », « essai » ou `null`. */
  instance: string | null;
  /** Refus d'instance, en clair ; `null` si la base est servie. */
  refus: string | null;
}

/** Étiquette lue hors du contrôle, pour la page de santé : ne lève jamais. */
async function etiquetteSansControle(): Promise<string | null> {
  try {
    return await etiquetteInscrite(pool());
  } catch {
    return null;
  }
}

/** Ping pour la page de santé. */
export async function etatBase(): Promise<EtatBase> {
  try {
    await sql`SELECT 1`;
    return { joignable: true, erreur: null, instance: await etiquetteSansControle(), refus: null };
  } catch (e) {
    const err = e as { code?: unknown; name?: unknown; message?: unknown };
    const message = typeof err.message === "string" ? err.message : "";
    // erreurs de `pg` sans code : négociation TLS refusée par le serveur, délai du pool
    const code =
      typeof err.code === "string" ? err.code
      : message.includes("does not support SSL") ? "SSL_NON_SUPPORTE"
      : message.includes("timeout exceeded") ? "DELAI_CONNEXION"
      : typeof err.name === "string" ? err.name
      : "inconnue";
    if (code === "INSTANCE_REFUSEE") {
      return {
        joignable: false,
        erreur: code,
        instance: await etiquetteSansControle(),
        refus: message,
      };
    }
    return { joignable: false, erreur: code, instance: null, refus: null };
  }
}

/**
 * Chiffrement de la liaison avec la base, constaté sur la dernière connexion
 * ouverte : `null` sans base, « absent » si la liaison est en clair, « inconnu »
 * si aucune connexion n'a encore été ouverte ou si le flux n'est pas lisible,
 * sinon le protocole négocié.
 *
 * À quoi cela sert : avant d'exiger TLS côté serveur (Supabase, « Enforce SSL
 * on incoming connections »), constater que le service est déjà en TLS.
 * L'interrupteur posé sur une liaison en clair coupe le service de sa base.
 */
export function chiffrementBase(): string | null {
  if (!baseConfiguree()) return null;
  return g.__fpTls ?? "inconnu";
}

export async function baseJoignable(): Promise<boolean> {
  return (await etatBase()).joignable;
}

// ──────────────────────────────────────────────────────────── accès et codes

export type Role = "admin" | "tuteur" | "poste";

export interface LigneAcces {
  id: number;
  role: Role;
  libelle: string;
  filiere: string | null;
  niveau: string | null;
  actif: boolean;
  cree_le: string;
  dernier_usage: string | null;
}

export interface LigneDepot {
  id: number;
  titre: string;
  nature: string;
  url: string;
  module_id: string | null;
  critere_id: string | null;
  depose_le: string;
  depose_par: Role;
  /** Profils auxquels le document est proposé : filières et niveaux (vides = tous). */
  filieres: string[];
  niveaux: string[];
}

/** Profils d'un document : identifiants de filières et codes de niveaux. */
export interface ProfilsDepot {
  filieres: string[];
  niveaux: string[];
}

/** Conservé pour compatibilité : le schéma est désormais appliqué automatiquement. */
export async function initSchema(): Promise<void> {
  await garantirSchema();
}

export async function listerAcces(): Promise<LigneAcces[]> {
  const r = await sql<LigneAcces>`
    SELECT id, role, libelle, filiere, niveau, actif,
           cree_le::text, dernier_usage::text
    FROM acces ORDER BY role, libelle`;
  return r.rows;
}

export async function creerAcces(
  codeHash: string,
  role: Role,
  libelle: string,
  filiere: string | null,
  niveau: string | null,
): Promise<number> {
  const r = await sql<{ id: number }>`
    INSERT INTO acces (code_hash, role, libelle, filiere, niveau)
    VALUES (${codeHash}, ${role}, ${libelle}, ${filiere}, ${niveau}) RETURNING id`;
  return r.rows[0].id;
}

/**
 * Révocation ou réactivation d'un code. La révocation date `ferme_le` : les
 * sessions ouvertes avant restent fermées même si le code est réactivé
 * (décision du 18/09/2026, question 16, choix b).
 */
export async function basculerAcces(id: number, actif: boolean): Promise<void> {
  if (actif) await sql`UPDATE acces SET actif = TRUE WHERE id = ${id}`;
  else await sql`UPDATE acces SET actif = FALSE, ferme_le = NOW() WHERE id = ${id}`;
}

/** État d'un code d'accès, pour lier une session à son code ; null si le code a été supprimé. */
export async function lireEtatAcces(id: number): Promise<{ actif: boolean; ferme: number | null } | null> {
  const r = await sql<{ actif: boolean; ferme: number | null }>`
    SELECT actif, EXTRACT(EPOCH FROM ferme_le)::float8 AS ferme FROM acces WHERE id = ${id}`;
  return r.rows[0] ?? null;
}

export async function supprimerAcces(id: number): Promise<void> {
  await sql`DELETE FROM acces WHERE id = ${id}`;
}

export async function codesActifs(): Promise<
  { id: number; code_hash: string; role: Role; libelle: string; filiere: string | null; niveau: string | null }[]
> {
  const r = await sql<{
    id: number; code_hash: string; role: Role; libelle: string;
    filiere: string | null; niveau: string | null;
  }>`SELECT id, code_hash, role, libelle, filiere, niveau FROM acces WHERE actif = TRUE`;
  return r.rows;
}

export async function marquerUsage(id: number): Promise<void> {
  await sql`UPDATE acces SET dernier_usage = NOW() WHERE id = ${id}`;
}

// ─────────────────────────────────────────────────────────── ordonnancement

export async function lireOrdonnancement(parcours: string): Promise<Record<string, number>> {
  const r = await sql<{ module_id: string; rang: number }>`
    SELECT module_id, rang FROM ordonnancement WHERE parcours = ${parcours}`;
  return Object.fromEntries(r.rows.map((x) => [x.module_id, x.rang]));
}

export async function ecrireRang(moduleId: string, parcours: string, rang: number): Promise<void> {
  await sql`
    INSERT INTO ordonnancement (module_id, parcours, rang)
    VALUES (${moduleId}, ${parcours}, ${rang})
    ON CONFLICT (module_id, parcours) DO UPDATE SET rang = EXCLUDED.rang`;
}

// ───────────────────────────────────────────────────── documents déposés

const COLONNES_DEPOT = `id, titre, nature, url, module_id, critere_id, depose_le::text, depose_par, filieres, niveaux`;

export async function listerDepots(): Promise<LigneDepot[]> {
  const r = await requete<LigneDepot>(`SELECT ${COLONNES_DEPOT} FROM depots ORDER BY depose_le DESC`);
  return r.rows;
}

export async function depotsDuModule(moduleId: string): Promise<LigneDepot[]> {
  const r = await requete<LigneDepot>(
    `SELECT ${COLONNES_DEPOT} FROM depots WHERE module_id = $1 ORDER BY depose_le DESC`,
    [moduleId],
  );
  return r.rows;
}

/** Documents sans module, proposés par profil sur le programme (filières et niveaux). */
export async function depotsGeneraux(): Promise<LigneDepot[]> {
  const r = await requete<LigneDepot>(
    `SELECT ${COLONNES_DEPOT} FROM depots WHERE module_id IS NULL ORDER BY depose_le DESC`,
  );
  return r.rows;
}

/** Type MIME des fichiers conservés en base, par identifiant (pour l'affichage en ligne). */
export async function typesFichiers(ids: string[]): Promise<Record<string, string>> {
  if (ids.length === 0) return {};
  const r = await sql<{ id: string; type: string }>`SELECT id, type FROM fichiers WHERE id = ANY(${ids}::text[])`;
  return Object.fromEntries(r.rows.map((x) => [x.id, x.type]));
}

export async function compterDepotsDuModule(moduleId: string): Promise<number> {
  const r = await sql<{ n: number }>`SELECT COUNT(*)::int AS n FROM depots WHERE module_id = ${moduleId}`;
  return r.rows[0]?.n ?? 0;
}

export async function enregistrerDepot(
  titre: string,
  nature: string,
  url: string,
  moduleId: string | null,
  critereId: string | null,
  role: Role,
  profils: ProfilsDepot = { filieres: [], niveaux: [] },
): Promise<void> {
  await sql`
    INSERT INTO depots (titre, nature, url, module_id, critere_id, depose_par, filieres, niveaux)
    VALUES (${titre}, ${nature}, ${url}, ${moduleId}, ${critereId}, ${role},
      ${JSON.stringify(profils.filieres)}::jsonb, ${JSON.stringify(profils.niveaux)}::jsonb)`;
}

export async function supprimerDepot(id: number): Promise<string | null> {
  const r = await sql<{ url: string }>`DELETE FROM depots WHERE id = ${id} RETURNING url`;
  return r.rows[0]?.url ?? null;
}
