import "server-only";
import { sql } from "@vercel/postgres";

/**
 * Accès à la base.
 *
 * Trois tables seulement, et aucune ne porte d'identité :
 *   - `acces`          : codes de rôle, stockés hachés
 *   - `ordonnancement` : rang des modules dans un parcours
 *   - `depots`         : index des documents déposés (le fichier est en Blob)
 *
 * Les résultats d'évaluation ne sont toujours écrits nulle part : ils vivent
 * en mémoire de l'onglet puis dans le rapport téléchargé. Cette base sert à la
 * configuration du site, pas au suivi des personnes.
 */

/**
 * Le site fonctionne sans base : dans ce cas le contrôle d'accès est inactif
 * et les écrans d'administration affichent la marche à suivre. Cela permet de
 * déployer avant d'avoir provisionné les stores.
 */
export function baseConfiguree(): boolean {
  return Boolean(process.env.POSTGRES_URL);
}

export function blobConfigure(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

export interface LigneAcces {
  id: number;
  role: Role;
  libelle: string;
  /** Filière à laquelle ce code donne accès (null = tout). */
  filiere: string | null;
  /** Niveau visé par ce profil de poste (null = tous). */
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
  /** Module auquel le document est rattaché, null si document général. */
  module_id: string | null;
  critere_id: string | null;
  depose_le: string;
  depose_par: Role;
}

export type Role = "admin" | "tuteur" | "poste";

/** Crée les tables si besoin. Idempotent, appelé au premier accès admin. */
export async function initSchema(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS acces (
      id            SERIAL PRIMARY KEY,
      code_hash     TEXT NOT NULL,
      role          TEXT NOT NULL CHECK (role IN ('admin','tuteur','poste')),
      libelle       TEXT NOT NULL,
      filiere       TEXT,
      niveau        TEXT,
      actif         BOOLEAN NOT NULL DEFAULT TRUE,
      cree_le       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      dernier_usage TIMESTAMPTZ
    );
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS ordonnancement (
      module_id TEXT NOT NULL,
      parcours  TEXT NOT NULL,
      rang      INTEGER NOT NULL,
      PRIMARY KEY (module_id, parcours)
    );
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS depots (
      id         SERIAL PRIMARY KEY,
      titre      TEXT NOT NULL,
      nature     TEXT NOT NULL,
      url        TEXT NOT NULL,
      module_id  TEXT,
      critere_id TEXT,
      depose_le  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      depose_par TEXT NOT NULL
    );
  `;
}

export async function listerAcces(): Promise<LigneAcces[]> {
  const r = await sql<LigneAcces>`
    SELECT id, role, libelle, filiere, niveau, actif,
           cree_le::text, dernier_usage::text
    FROM acces ORDER BY role, libelle;
  `;
  return r.rows;
}

export async function creerAcces(
  codeHash: string,
  role: Role,
  libelle: string,
  filiere: string | null,
  niveau: string | null,
): Promise<void> {
  await sql`
    INSERT INTO acces (code_hash, role, libelle, filiere, niveau)
    VALUES (${codeHash}, ${role}, ${libelle}, ${filiere}, ${niveau});
  `;
}

export async function basculerAcces(id: number, actif: boolean): Promise<void> {
  await sql`UPDATE acces SET actif = ${actif} WHERE id = ${id};`;
}

export async function supprimerAcces(id: number): Promise<void> {
  await sql`DELETE FROM acces WHERE id = ${id};`;
}

/** Codes actifs, pour vérification à la connexion. */
export async function codesActifs(): Promise<
  { id: number; code_hash: string; role: Role; libelle: string; filiere: string | null; niveau: string | null }[]
> {
  const r = await sql<{
    id: number; code_hash: string; role: Role; libelle: string;
    filiere: string | null; niveau: string | null;
  }>`
    SELECT id, code_hash, role, libelle, filiere, niveau
    FROM acces WHERE actif = TRUE;
  `;
  return r.rows;
}

export async function marquerUsage(id: number): Promise<void> {
  await sql`UPDATE acces SET dernier_usage = NOW() WHERE id = ${id};`;
}

/** Y a-t-il au moins un code admin ? Sinon, amorçage nécessaire. */
export async function existeAdmin(): Promise<boolean> {
  const r = await sql`SELECT 1 FROM acces WHERE role = 'admin' AND actif = TRUE LIMIT 1;`;
  return (r.rowCount ?? 0) > 0;
}

export async function lireOrdonnancement(
  parcours: string,
): Promise<Record<string, number>> {
  const r = await sql<{ module_id: string; rang: number }>`
    SELECT module_id, rang FROM ordonnancement WHERE parcours = ${parcours};
  `;
  return Object.fromEntries(r.rows.map((x) => [x.module_id, x.rang]));
}

export async function ecrireRang(
  moduleId: string,
  parcours: string,
  rang: number,
): Promise<void> {
  await sql`
    INSERT INTO ordonnancement (module_id, parcours, rang)
    VALUES (${moduleId}, ${parcours}, ${rang})
    ON CONFLICT (module_id, parcours) DO UPDATE SET rang = EXCLUDED.rang;
  `;
}

export async function listerDepots(): Promise<LigneDepot[]> {
  const r = await sql<LigneDepot>`
    SELECT id, titre, nature, url, module_id, critere_id,
           depose_le::text, depose_par
    FROM depots ORDER BY depose_le DESC;
  `;
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
    VALUES (${titre}, ${nature}, ${url}, ${moduleId}, ${critereId}, ${role});
  `;
}

export async function supprimerDepot(id: number): Promise<string | null> {
  const r = await sql<{ url: string }>`
    DELETE FROM depots WHERE id = ${id} RETURNING url;
  `;
  return r.rows[0]?.url ?? null;
}
