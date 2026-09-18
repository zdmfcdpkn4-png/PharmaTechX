import "server-only";
import { randomBytes } from "node:crypto";
import { requete, sql } from "./db";
import { IMAGE_MAX_OCTETS, dimensions, typeReel, type TypeImage } from "./images";

/**
 * Signature du pharmacien — reprise du modèle de la console de vérification
 * métrologique : une image déposée une fois, réduite à 600 px de large par le
 * navigateur, incrustée dans chaque rapport clos.
 *
 * Différence assumée : la console la garde sur le poste (`localStorage`) ; ici
 * elle vit en base, rattachée au code d'accès admin qui l'a déposée. Un visa de
 * pharmacien référence l'image incrustée à cet instant, de sorte qu'un rapport
 * clos ne change pas si la signature est remplacée ensuite.
 */

export const SIGNATURE_LARGEUR_MAX = 600;

export interface Signature {
  id: string;
  type: TypeImage;
  octets: Buffer;
  largeur: number;
  hauteur: number;
  cree_le: string;
}

const COLONNES = "s.id, s.type, s.octets, s.largeur, s.hauteur, s.cree_le::text";

/** Enregistre la signature d'un code admin et la rend courante ; null si l'image est illisible. */
export async function enregistrerSignature(
  accesId: number,
  octets: Buffer,
): Promise<{ id: string; largeur: number; hauteur: number } | null> {
  const type = typeReel(octets);
  if (!type || octets.length > IMAGE_MAX_OCTETS) return null;
  const dim = dimensions(octets, type);
  if (!dim) return null;
  const id = randomBytes(9).toString("base64url");
  await sql`
    INSERT INTO signatures (id, acces_id, type, octets, largeur, hauteur)
    VALUES (${id}, ${accesId}, ${type}, ${octets}, ${dim.w}, ${dim.h})`;
  await sql`UPDATE acces SET signature_id = ${id} WHERE id = ${accesId}`;
  await purgerSignaturesInutilisees();
  return { id, largeur: dim.w, hauteur: dim.h };
}

/** Signature courante d'un code d'accès. */
export async function signatureCourante(accesId: number | null | undefined): Promise<Signature | null> {
  if (!accesId) return null;
  const r = await requete<Signature>(
    `SELECT ${COLONNES} FROM signatures s
     WHERE s.id = (SELECT signature_id FROM acces WHERE id = $1)`,
    [accesId],
  );
  return r.rows[0] ?? null;
}

export async function lireSignature(id: string | null | undefined): Promise<Signature | null> {
  if (!id) return null;
  const r = await requete<Signature>(`SELECT ${COLONNES} FROM signatures s WHERE s.id = $1`, [id]);
  return r.rows[0] ?? null;
}

/** Retire la signature courante d'un code ; l'image reste si un visa l'a incrustée. */
export async function retirerSignature(accesId: number): Promise<void> {
  await sql`UPDATE acces SET signature_id = NULL WHERE id = ${accesId}`;
  await purgerSignaturesInutilisees();
}

/** Supprime les images qui ne sont ni courantes pour un code, ni incrustées dans un visa. */
async function purgerSignaturesInutilisees(): Promise<void> {
  await sql`
    DELETE FROM signatures s
    WHERE NOT EXISTS (SELECT 1 FROM acces a WHERE a.signature_id = s.id)
      AND NOT EXISTS (SELECT 1 FROM visas v WHERE v.signature_id = s.id)`;
}

/** Adresse `data:` de l'image, pour l'incruster dans un rapport autoportant. */
export function dataUri(s: Pick<Signature, "type" | "octets">): string {
  return `data:${s.type};base64,${Buffer.from(s.octets).toString("base64")}`;
}
