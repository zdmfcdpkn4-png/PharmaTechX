import "server-only";
import { randomBytes } from "node:crypto";
import { sql } from "./db";

/**
 * Images des schémas à compléter — reprise du module `images` du Lecteur
 * QIM · QCM : PNG ou JPEG, type réel lu dans les premiers octets, dimensions
 * lues dans l'entête (IHDR ou segment SOF), stockage en base, service par
 * `/api/images/[id]`.
 */

export const IMAGE_MAX_OCTETS = 2 * 1024 * 1024;

export type TypeImage = "image/png" | "image/jpeg";

/** Type réel d'une image d'après ses premiers octets ; null si ce n'est ni un PNG ni un JPEG. */
export function typeReel(buf: Buffer): TypeImage | null {
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
    buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a
  ) return "image/png";
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  return null;
}

/** Dimensions lues dans l'entête : IHDR d'un PNG, segment SOF d'un JPEG. */
export function dimensions(buf: Buffer, type: TypeImage): { w: number; h: number } | null {
  if (type === "image/png") {
    if (buf.length < 24 || buf.toString("latin1", 12, 16) !== "IHDR") return null;
    const w = buf.readUInt32BE(16);
    const h = buf.readUInt32BE(20);
    return w > 0 && h > 0 ? { w, h } : null;
  }
  let i = 2;
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) { i++; continue; }
    const marqueur = buf[i + 1];
    if (marqueur === 0xff) { i++; continue; }
    if ((marqueur >= 0xd0 && marqueur <= 0xd7) || marqueur === 0xd8 || marqueur === 0x01) { i += 2; continue; }
    if (marqueur === 0xd9) return null;
    const longueur = buf.readUInt16BE(i + 2);
    const sof = marqueur >= 0xc0 && marqueur <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marqueur);
    if (sof) {
      const h = buf.readUInt16BE(i + 5);
      const w = buf.readUInt16BE(i + 7);
      return w > 0 && h > 0 ? { w, h } : null;
    }
    i += 2 + longueur;
  }
  return null;
}

export interface ImageEnregistree {
  id: string;
  largeur: number;
  hauteur: number;
  type: TypeImage;
}

/** Enregistre une image ; null si les octets ne forment pas une image lisible. */
export async function enregistrerImage(octets: Buffer, alt: string): Promise<ImageEnregistree | null> {
  const type = typeReel(octets);
  if (!type || octets.length > IMAGE_MAX_OCTETS) return null;
  const dim = dimensions(octets, type);
  if (!dim) return null;
  const id = randomBytes(9).toString("base64url");
  await sql`
    INSERT INTO images (id, type, octets, largeur, hauteur, alt)
    VALUES (${id}, ${type}, ${octets}, ${dim.w}, ${dim.h}, ${alt})`;
  return { id, largeur: dim.w, hauteur: dim.h, type };
}

export async function lireImage(
  id: string,
): Promise<{ type: TypeImage; octets: Buffer; largeur: number; hauteur: number; alt: string } | null> {
  const r = await sql<{ type: TypeImage; octets: Buffer; largeur: number; hauteur: number; alt: string }>`
    SELECT type, octets, largeur, hauteur, alt FROM images WHERE id = ${id}`;
  return r.rows[0] ?? null;
}

export async function majAltImage(id: string, alt: string): Promise<void> {
  await sql`UPDATE images SET alt = ${alt} WHERE id = ${id}`;
}

/** Images qu'aucune question ne cite plus, passé un délai de grâce de sept jours. */
export async function nettoyerImagesOrphelines(): Promise<number> {
  const r = await sql`
    DELETE FROM images
    WHERE cree_le < NOW() - INTERVAL '7 days'
      AND NOT EXISTS (SELECT 1 FROM questions q WHERE q.image_id = images.id)`;
  return r.rowCount;
}
