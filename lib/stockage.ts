import "server-only";
import { randomBytes } from "node:crypto";
import { put, del } from "@vercel/blob";
import { baseConfiguree, blobConfigure, sql } from "./db";

/**
 * Stockage des documents déposés (procédures, fiches réflexes, vidéos).
 *
 * Deux dorsales, choisies à l'exécution :
 *   - `blob` : Vercel Blob, si `BLOB_READ_WRITE_TOKEN` est présent ;
 *   - `base` : la table `fichiers` de PostgreSQL, servie par
 *     `/api/fichiers/[id]`. C'est la dorsale de Render, ou de tout hébergeur
 *     sans store d'objets — sans service supplémentaire à provisionner.
 *
 * Taille maximale par fichier en base : 15 Mo. Au-delà, ou pour des vidéos,
 * un store d'objets (Blob, S3 compatible) est préférable — [à préciser].
 */

export const TAILLE_MAX_FICHIER = 15 * 1024 * 1024;

export type ModeStockage = "blob" | "base" | "aucun";

export function modeStockage(): ModeStockage {
  if (blobConfigure()) return "blob";
  if (baseConfiguree()) return "base";
  return "aucun";
}

export function stockageConfigure(): boolean {
  return modeStockage() !== "aucun";
}

const TYPES_ADMIS = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "video/mp4",
  "video/webm",
  "text/plain",
  "text/markdown",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

export function typeAdmis(type: string): boolean {
  return TYPES_ADMIS.has(type);
}

function nomSur(nom: string): string {
  return nom
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || "document";
}

export async function deposerFichier(
  nom: string,
  type: string,
  octets: Buffer,
): Promise<{ url: string }> {
  const mode = modeStockage();
  if (mode === "blob") {
    const blob = await put(`depots/${Date.now()}-${nomSur(nom)}`, octets, {
      access: "public",
      addRandomSuffix: true,
      contentType: type,
    });
    return { url: blob.url };
  }
  if (mode === "base") {
    if (octets.length > TAILLE_MAX_FICHIER) throw new Error("fichier-trop-lourd");
    const id = randomBytes(12).toString("base64url");
    await sql`
      INSERT INTO fichiers (id, nom, type, octets, taille)
      VALUES (${id}, ${nomSur(nom)}, ${type}, ${octets}, ${octets.length})`;
    return { url: `/api/fichiers/${id}` };
  }
  throw new Error("stockage-absent");
}

export async function supprimerFichier(url: string): Promise<void> {
  const m = /^\/api\/fichiers\/([A-Za-z0-9_-]+)$/.exec(url);
  if (m) {
    await sql`DELETE FROM fichiers WHERE id = ${m[1]}`;
    return;
  }
  if (blobConfigure()) {
    try {
      await del(url);
    } catch {
      // Le fichier a pu être supprimé côté Blob : l'index reste la référence.
    }
  }
}

export async function lireFichier(
  id: string,
): Promise<{ nom: string; type: string; octets: Buffer; taille: number } | null> {
  const r = await sql<{ nom: string; type: string; octets: Buffer; taille: number }>`
    SELECT nom, type, octets, taille FROM fichiers WHERE id = ${id}`;
  return r.rows[0] ?? null;
}
