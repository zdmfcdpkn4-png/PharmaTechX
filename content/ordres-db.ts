import "server-only";
import { sql } from "@/lib/db";
import { cleProfil } from "./ordres";
import type { TypeParcours } from "./types";

/**
 * Ordres de profil en base (question 55, 23/09/2026). La règle — profil,
 * chronologie, modules entrés ou sortis depuis — est dans `content/ordres.ts`,
 * pure et testée ; ce fichier ne fait que lire et écrire.
 */

export interface OrdreProfil {
  filiere: string;
  niveau: string;
  parcours: TypeParcours;
  /** Identifiants des modules, dans l'ordre du profil. */
  modules: string[];
  /** « Tutorat · libellé du code » : qui a fixé l'ordre en dernier. */
  modifiePar: string;
  modifieLe: string;
}

interface LigneOrdre {
  filiere_id: string;
  niveau: string;
  parcours: string;
  modules: unknown;
  modifie_par: string;
  modifie_le: string;
}

function versOrdre(l: LigneOrdre): OrdreProfil {
  return {
    filiere: l.filiere_id,
    niveau: l.niveau,
    parcours: l.parcours === "maintien" ? "maintien" : "integration",
    modules: Array.isArray(l.modules) ? l.modules.filter((x): x is string => typeof x === "string") : [],
    modifiePar: l.modifie_par,
    modifieLe: l.modifie_le,
  };
}

/** Tous les ordres de profil, pour la liste de l'écran d'ordonnancement. */
export async function listerOrdresProfil(): Promise<OrdreProfil[]> {
  const r = await sql<LigneOrdre>`
    SELECT filiere_id, niveau, parcours, modules, modifie_par, modifie_le::text
    FROM ordres_profil ORDER BY parcours, filiere_id, niveau`;
  return r.rows.map(versOrdre);
}

/** Ordres d'un parcours, par clé de profil (« filière|niveau ») : ce que l'accueil applique. */
export async function ordresDuParcours(parcours: TypeParcours): Promise<Record<string, string[]>> {
  const r = await sql<LigneOrdre>`
    SELECT filiere_id, niveau, parcours, modules, modifie_par, modifie_le::text
    FROM ordres_profil WHERE parcours = ${parcours}`;
  return Object.fromEntries(r.rows.map(versOrdre).map((o) => [cleProfil(o.filiere, o.niveau), o.modules]));
}

export async function lireOrdreProfil(filiere: string, niveau: string, parcours: TypeParcours): Promise<OrdreProfil | null> {
  const r = await sql<LigneOrdre>`
    SELECT filiere_id, niveau, parcours, modules, modifie_par, modifie_le::text
    FROM ordres_profil WHERE filiere_id = ${filiere} AND niveau = ${niveau} AND parcours = ${parcours}`;
  return r.rows[0] ? versOrdre(r.rows[0]) : null;
}

export async function ecrireOrdreProfil(
  filiere: string,
  niveau: string,
  parcours: TypeParcours,
  modules: string[],
  par: string,
): Promise<void> {
  await sql`
    INSERT INTO ordres_profil (filiere_id, niveau, parcours, modules, modifie_par)
    VALUES (${filiere}, ${niveau}, ${parcours}, ${JSON.stringify(modules)}::jsonb, ${par})
    ON CONFLICT (filiere_id, niveau, parcours) DO UPDATE SET
      modules = EXCLUDED.modules, modifie_par = EXCLUDED.modifie_par, modifie_le = NOW()`;
}

/** Retour à l'ordre général : vrai si un ordre propre existait. */
export async function supprimerOrdreProfil(filiere: string, niveau: string, parcours: TypeParcours): Promise<boolean> {
  const r = await sql`
    DELETE FROM ordres_profil WHERE filiere_id = ${filiere} AND niveau = ${niveau} AND parcours = ${parcours}`;
  return r.rowCount > 0;
}

// ─────────────────────────────── ordre propre à un apprenant (question 56)

/** Ordre propre à un apprenant sur un profil : il passe avant celui du profil quand l'apprenant est rattaché. */
export interface OrdreAgent extends OrdreProfil {
  agentId: number;
  /** Identifiant pseudonyme (AG-…), lu dans `agents`. */
  identifiant: string;
}

interface LigneOrdreAgent extends LigneOrdre {
  agent_id: number;
  identifiant: string;
}

function versOrdreAgent(l: LigneOrdreAgent): OrdreAgent {
  return { ...versOrdre(l), agentId: l.agent_id, identifiant: l.identifiant };
}

/** Ordres propres à des apprenants, tous ou ceux d'un seul, pour les écrans d'ordonnancement et du personnel. */
export async function listerOrdresAgents(agentId?: number): Promise<OrdreAgent[]> {
  const r = agentId
    ? await sql<LigneOrdreAgent>`
        SELECT o.agent_id, a.identifiant, o.filiere_id, o.niveau, o.parcours, o.modules, o.modifie_par, o.modifie_le::text
        FROM ordres_agent o JOIN agents a ON a.id = o.agent_id
        WHERE o.agent_id = ${agentId} ORDER BY o.parcours, o.filiere_id, o.niveau`
    : await sql<LigneOrdreAgent>`
        SELECT o.agent_id, a.identifiant, o.filiere_id, o.niveau, o.parcours, o.modules, o.modifie_par, o.modifie_le::text
        FROM ordres_agent o JOIN agents a ON a.id = o.agent_id
        ORDER BY a.identifiant, o.parcours, o.filiere_id, o.niveau`;
  return r.rows.map(versOrdreAgent);
}

/** Ordres d'un apprenant dans un parcours, par clé de profil : ce que son accueil applique quand il est rattaché. */
export async function ordresDeLAgent(agentId: number, parcours: TypeParcours): Promise<Record<string, string[]>> {
  const r = await sql<LigneOrdre>`
    SELECT filiere_id, niveau, parcours, modules, modifie_par, modifie_le::text
    FROM ordres_agent WHERE agent_id = ${agentId} AND parcours = ${parcours}`;
  return Object.fromEntries(r.rows.map(versOrdre).map((o) => [cleProfil(o.filiere, o.niveau), o.modules]));
}

export async function lireOrdreAgent(
  agentId: number,
  filiere: string,
  niveau: string,
  parcours: TypeParcours,
): Promise<OrdreProfil | null> {
  const r = await sql<LigneOrdre>`
    SELECT filiere_id, niveau, parcours, modules, modifie_par, modifie_le::text
    FROM ordres_agent
    WHERE agent_id = ${agentId} AND filiere_id = ${filiere} AND niveau = ${niveau} AND parcours = ${parcours}`;
  return r.rows[0] ? versOrdre(r.rows[0]) : null;
}

export async function ecrireOrdreAgent(
  agentId: number,
  filiere: string,
  niveau: string,
  parcours: TypeParcours,
  modules: string[],
  par: string,
): Promise<void> {
  await sql`
    INSERT INTO ordres_agent (agent_id, filiere_id, niveau, parcours, modules, modifie_par)
    VALUES (${agentId}, ${filiere}, ${niveau}, ${parcours}, ${JSON.stringify(modules)}::jsonb, ${par})
    ON CONFLICT (agent_id, filiere_id, niveau, parcours) DO UPDATE SET
      modules = EXCLUDED.modules, modifie_par = EXCLUDED.modifie_par, modifie_le = NOW()`;
}

/** Retour à l'ordre du profil : vrai si un ordre propre existait. */
export async function supprimerOrdreAgent(
  agentId: number,
  filiere: string,
  niveau: string,
  parcours: TypeParcours,
): Promise<boolean> {
  const r = await sql`
    DELETE FROM ordres_agent
    WHERE agent_id = ${agentId} AND filiere_id = ${filiere} AND niveau = ${niveau} AND parcours = ${parcours}`;
  return r.rowCount > 0;
}
