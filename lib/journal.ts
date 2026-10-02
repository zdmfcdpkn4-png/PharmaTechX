import "server-only";
import { sql } from "./db";
import type { Role } from "./db";
import { PAGE_JOURNAL, motifCible, type FiltreJournal } from "./journal-filtre";

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

/**
 * Journal filtré (question 90, choix a) : action exacte, période en jours de
 * Paris, partie de la cible ; une page des plus récentes aux plus anciennes,
 * `avant` menant aux suivantes. `total` compte toutes les lignes retenues,
 * pages comprises ; `suite` dit s'il en reste de plus anciennes.
 */
export async function chercherJournal(
  f: FiltreJournal,
  limite = PAGE_JOURNAL,
): Promise<{ entrees: EntreeJournal[]; total: number; suite: boolean }> {
  const action = f.action ?? null;
  const du = f.du ?? null;
  const au = f.au ?? null;
  const motif = f.cible ? motifCible(f.cible) : null;
  const avant = f.avant ?? null;
  const [r, t] = await Promise.all([
    sql<EntreeJournal>`
      SELECT id, quand::text, role, libelle, action, cible, details FROM journal
      WHERE (${action}::text IS NULL OR action = ${action}::text)
        AND (${du}::date IS NULL OR quand >= (${du}::date::timestamp AT TIME ZONE 'Europe/Paris'))
        AND (${au}::date IS NULL OR quand < ((${au}::date + 1)::timestamp AT TIME ZONE 'Europe/Paris'))
        AND (${motif}::text IS NULL OR cible ILIKE ${motif}::text)
        AND (${avant}::int IS NULL OR id < ${avant}::int)
      ORDER BY id DESC LIMIT ${limite + 1}`,
    sql<{ n: number }>`
      SELECT COUNT(*)::int AS n FROM journal
      WHERE (${action}::text IS NULL OR action = ${action}::text)
        AND (${du}::date IS NULL OR quand >= (${du}::date::timestamp AT TIME ZONE 'Europe/Paris'))
        AND (${au}::date IS NULL OR quand < ((${au}::date + 1)::timestamp AT TIME ZONE 'Europe/Paris'))
        AND (${motif}::text IS NULL OR cible ILIKE ${motif}::text)`,
  ]);
  return { entrees: r.rows.slice(0, limite), total: t.rows[0]?.n ?? 0, suite: r.rows.length > limite };
}

/** Les actions écrites au journal, avec leur nombre : la liste du filtre « Action ». */
export async function actionsJournal(): Promise<{ action: string; n: number }[]> {
  const r = await sql<{ action: string; n: number }>`
    SELECT action, COUNT(*)::int AS n FROM journal GROUP BY action ORDER BY action`;
  return r.rows;
}
