import "server-only";
import { sql } from "@/lib/db";
import { lireParcours, type ParcoursAgent } from "./parcours-agent";

/**
 * Parcours d'un agent en base (question 103, choix a, 05/10/2026). La règle —
 * composition, application au programme du code — est dans
 * `content/parcours-agent.ts`, pure et testée ; ce fichier ne fait que lire et
 * écrire. Un parcours par identifiant ; purgé avec la progression
 * (`purgerProgression`), supprimé avec l'identifiant.
 */

export interface ParcoursEnregistre extends ParcoursAgent {
  agentId: number;
  /** « Tutorat · libellé du code » : qui a fixé le parcours en dernier. */
  modifiePar: string;
  modifieLe: string;
}

interface LigneParcours {
  agent_id: number;
  modules: unknown;
  fermes: unknown;
  modifie_par: string;
  modifie_le: string;
}

function versParcours(l: LigneParcours): ParcoursEnregistre {
  return { ...lireParcours(l.modules, l.fermes), agentId: l.agent_id, modifiePar: l.modifie_par, modifieLe: l.modifie_le };
}

export async function lireParcoursAgent(agentId: number): Promise<ParcoursEnregistre | null> {
  const r = await sql<LigneParcours>`
    SELECT agent_id, modules, fermes, modifie_par, modifie_le::text
    FROM parcours_agent WHERE agent_id = ${agentId}`;
  return r.rows[0] ? versParcours(r.rows[0]) : null;
}

export async function ecrireParcoursAgent(agentId: number, p: ParcoursAgent, par: string): Promise<void> {
  await sql`
    INSERT INTO parcours_agent (agent_id, modules, fermes, modifie_par)
    VALUES (${agentId}, ${JSON.stringify(p.modules)}::jsonb, ${JSON.stringify(p.fermes)}::jsonb, ${par})
    ON CONFLICT (agent_id) DO UPDATE SET
      modules = EXCLUDED.modules, fermes = EXCLUDED.fermes, modifie_par = EXCLUDED.modifie_par, modifie_le = NOW()`;
}

/** Retour au programme du code : vrai si un parcours existait. */
export async function supprimerParcoursAgent(agentId: number): Promise<boolean> {
  const r = await sql`DELETE FROM parcours_agent WHERE agent_id = ${agentId}`;
  return r.rowCount > 0;
}
