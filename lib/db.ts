import "server-only";
import { readFileSync } from "node:fs";
import { Pool, type PoolClient, type QueryResultRow } from "pg";
import { SCHEMA } from "./schema";
import { fabriqueSocket, familleIp } from "./reseau";

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
const g = globalThis as unknown as { __fpPool?: Pool; __fpSchema?: Promise<void> };

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
  return g.__fpPool;
}

/**
 * Applique le schéma une fois par processus. Le verrou consultatif
 * transactionnel sérialise les instances qui démarrent ensemble.
 */
export function garantirSchema(): Promise<void> {
  if (g.__fpSchema) return g.__fpSchema;
  g.__fpSchema = (async () => {
    const c = await pool().connect();
    try {
      await c.query("BEGIN");
      await c.query("SELECT pg_advisory_xact_lock(7452026)");
      for (const instruction of SCHEMA) await c.query(instruction);
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
}

/** Ping pour la page de santé. */
export async function etatBase(): Promise<EtatBase> {
  try {
    await sql`SELECT 1`;
    return { joignable: true, erreur: null };
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
    return { joignable: false, erreur: code };
  }
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

export async function basculerAcces(id: number, actif: boolean): Promise<void> {
  await sql`UPDATE acces SET actif = ${actif} WHERE id = ${id}`;
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

export async function existeAdmin(): Promise<boolean> {
  const r = await sql`SELECT 1 FROM acces WHERE role = 'admin' AND actif = TRUE LIMIT 1`;
  return r.rowCount > 0;
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

export async function listerDepots(): Promise<LigneDepot[]> {
  const r = await sql<LigneDepot>`
    SELECT id, titre, nature, url, module_id, critere_id, depose_le::text, depose_par
    FROM depots ORDER BY depose_le DESC`;
  return r.rows;
}

export async function depotsDuModule(moduleId: string): Promise<LigneDepot[]> {
  const r = await sql<LigneDepot>`
    SELECT id, titre, nature, url, module_id, critere_id, depose_le::text, depose_par
    FROM depots WHERE module_id = ${moduleId} ORDER BY depose_le DESC`;
  return r.rows;
}

export async function enregistrerDepot(
  titre: string,
  nature: string,
  url: string,
  moduleId: string | null,
  critereId: string | null,
  role: Role,
): Promise<void> {
  await sql`
    INSERT INTO depots (titre, nature, url, module_id, critere_id, depose_par)
    VALUES (${titre}, ${nature}, ${url}, ${moduleId}, ${critereId}, ${role})`;
}

export async function supprimerDepot(id: number): Promise<string | null> {
  const r = await sql<{ url: string }>`DELETE FROM depots WHERE id = ${id} RETURNING url`;
  return r.rows[0]?.url ?? null;
}
