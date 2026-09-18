import "server-only";
import { sql } from "./db";
import type { Role } from "./db";

/**
 * Journal des actions d'administration : qui (rôle et libellé de profil,
 * jamais une personne), quoi, sur quoi, quand. Répond à la limite « pas de
 * journal d'audit » de la version précédente, et donne aux visas une trace
 * opposable.
 */
export interface EntreeJournal {
  id: number;
  quand: string;
  role: string;
  libelle: string;
  action: string;
  cible: string;
  details: Record<string, unknown>;
}

export async function journaliser(
  acteur: { role: Role | "systeme"; libelle: string },
  action: string,
  cible = "",
  details: Record<string, unknown> = {},
): Promise<void> {
  try {
    await sql`
      INSERT INTO journal (role, libelle, action, cible, details)
      VALUES (${acteur.role}, ${acteur.libelle}, ${action}, ${cible}, ${JSON.stringify(details)}::jsonb)`;
  } catch {
    // Le journal ne doit jamais faire échouer l'action qu'il trace.
  }
}

export async function lireJournal(limite = 200): Promise<EntreeJournal[]> {
  const r = await sql<EntreeJournal>`
    SELECT id, quand::text, role, libelle, action, cible, details
    FROM journal ORDER BY id DESC LIMIT ${limite}`;
  return r.rows;
}
