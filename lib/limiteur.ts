import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { sql } from "./db";

/**
 * Limiteur de tentatives de connexion, en base (donc partagé entre instances
 * et survivant aux redémarrages d'une fonction serverless).
 *
 * L'adresse n'est jamais stockée en clair : la clé est son empreinte, salée
 * par le secret de l'application. Cinq échecs bloquent un quart d'heure ; le
 * palier double à chaque blocage suivant. Un succès efface le compteur.
 */
const ECHECS_AVANT_BLOCAGE = 5;
const BLOCAGE_MINUTES = 15;

async function cleAdresse(): Promise<string> {
  const h = await headers();
  const brut =
    h.get("x-forwarded-for")?.split(",")[0].trim() ||
    h.get("x-real-ip") ||
    "inconnue";
  const sel = process.env.AUTH_SECRET ?? "sans-secret";
  return createHash("sha256").update(`${sel}|${brut}`).digest("hex");
}

/** Minutes restantes de blocage, 0 si l'adresse peut tenter. */
export async function minutesDeBlocage(): Promise<number> {
  const cle = await cleAdresse();
  const r = await sql<{ restant: number | null }>`
    SELECT CEIL(EXTRACT(EPOCH FROM (bloque_jusqua - NOW())) / 60)::int AS restant
    FROM tentatives_connexion
    WHERE cle = ${cle} AND bloque_jusqua IS NOT NULL AND bloque_jusqua > NOW()`;
  return r.rows[0]?.restant ?? 0;
}

export async function enregistrerEchec(): Promise<void> {
  const cle = await cleAdresse();
  const r = await sql<{ echecs: number }>`
    INSERT INTO tentatives_connexion (cle, echecs, maj_le)
    VALUES (${cle}, 1, NOW())
    ON CONFLICT (cle) DO UPDATE
      SET echecs = CASE
            WHEN tentatives_connexion.maj_le < NOW() - INTERVAL '1 day' THEN 1
            ELSE tentatives_connexion.echecs + 1 END,
          maj_le = NOW()
    RETURNING echecs`;
  const echecs = r.rows[0]?.echecs ?? 1;
  if (echecs >= ECHECS_AVANT_BLOCAGE && echecs % ECHECS_AVANT_BLOCAGE === 0) {
    const palier = Math.floor(echecs / ECHECS_AVANT_BLOCAGE);
    const minutes = BLOCAGE_MINUTES * 2 ** (palier - 1);
    await sql`
      UPDATE tentatives_connexion
      SET bloque_jusqua = NOW() + (${minutes} || ' minutes')::interval
      WHERE cle = ${cle}`;
  }
}

export async function effacerEchecs(): Promise<void> {
  const cle = await cleAdresse();
  await sql`DELETE FROM tentatives_connexion WHERE cle = ${cle}`;
}
