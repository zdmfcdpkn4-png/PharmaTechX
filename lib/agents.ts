import "server-only";
import { sql, transaction, sqlSur, type Role } from "./db";
import { formaterIdentifiant, normaliserIdentifiant } from "./identifiant";

/**
 * Agents pseudonymes — décision du 18/09/2026 (question 6, choix a).
 *
 * Un agent n'est, dans la base, qu'un identifiant généré (`AG-001`…), sa date
 * de création et son état (actif ou clos). Ni nom, ni fonction, ni champ
 * libre : rien où un nom pourrait être saisi. Un identifiant clos ne reçoit
 * plus de rapport ; son historique reste jusqu'à purge manuelle.
 */

export interface LigneAgent {
  id: number;
  identifiant: string;
  actif: boolean;
  cree_le: string;
  clos_le: string | null;
  nb_rapports: number;
  /** Code personnel de rattachement défini (question 11, choix c). */
  code_defini: boolean;
  /** Traces de progression (évaluations, entraînements, lectures) et dernière activité. */
  nb_traces: number;
  derniere_activite: string | null;
  /** Codes reliés à cet identifiant (question 99, choix a ; de tutorat aussi depuis la question 104), par libellé. */
  codes_relies: string[];
  /** Ceux d'entre eux qui sont des codes de tutorat : l'identifiant est celui d'un tuteur, supervisé par les pharmaciens. */
  codes_tutorat: string[];
  /** Parcours fixé par le tutorat (question 103) : nombre de modules, dont fermés ; null sans parcours. */
  nb_parcours: number | null;
  nb_parcours_fermes: number | null;
}

/** Crée un identifiant ; le numéro vient de la séquence, sans trou concurrent. */
export async function creerAgent(): Promise<{ id: number; identifiant: string }> {
  return transaction(async (client) => {
    const s = sqlSur(client);
    const n = await s<{ n: string }>`SELECT nextval('agents_id_seq')::text AS n`;
    const id = Number(n.rows[0].n);
    const identifiant = formaterIdentifiant(id);
    await s`INSERT INTO agents (id, identifiant) VALUES (${id}, ${identifiant})`;
    return { id, identifiant };
  });
}

export async function listerAgents(): Promise<LigneAgent[]> {
  const r = await sql<LigneAgent>`
    SELECT a.id, a.identifiant, a.actif, a.cree_le::text, a.clos_le::text,
           (SELECT COUNT(*) FROM rapports r WHERE r.agent_id = a.id)::int AS nb_rapports,
           (a.code_hash IS NOT NULL) AS code_defini,
           (SELECT COUNT(*) FROM progression p WHERE p.agent_id = a.id)::int AS nb_traces,
           (SELECT MAX(p.cree_le) FROM progression p WHERE p.agent_id = a.id)::text AS derniere_activite,
           ARRAY(SELECT c.libelle FROM acces c WHERE c.agent_id = a.id ORDER BY c.libelle) AS codes_relies,
           ARRAY(SELECT c.libelle FROM acces c WHERE c.agent_id = a.id AND c.role = 'tuteur' ORDER BY c.libelle) AS codes_tutorat,
           (SELECT jsonb_array_length(pa.modules) FROM parcours_agent pa WHERE pa.agent_id = a.id)::int AS nb_parcours,
           (SELECT jsonb_array_length(pa.fermes) FROM parcours_agent pa WHERE pa.agent_id = a.id)::int AS nb_parcours_fermes
    FROM agents a ORDER BY a.id`;
  return r.rows;
}

/** Identifiants seuls, dans l'ordre de création : la liste où choisir l'agent d'un code (question 99). */
export async function listerIdentifiants(): Promise<{ id: number; identifiant: string; actif: boolean }[]> {
  const r = await sql<{ id: number; identifiant: string; actif: boolean }>`
    SELECT id, identifiant, actif FROM agents ORDER BY id`;
  return r.rows;
}

/** Agent tel que saisi par l'apprenant ; `null` si l'identifiant est inconnu. */
export async function agentParIdentifiant(
  saisie: string,
): Promise<{ id: number; identifiant: string; actif: boolean } | null> {
  const identifiant = normaliserIdentifiant(saisie);
  if (!identifiant) return null;
  const r = await sql<{ id: number; identifiant: string; actif: boolean }>`
    SELECT id, identifiant, actif FROM agents WHERE identifiant = ${identifiant}`;
  return r.rows[0] ?? null;
}

/** Clôt (départ de l'agent) ou rouvre un identifiant. */
export async function basculerAgent(id: number, actif: boolean): Promise<string | null> {
  const r = await sql<{ identifiant: string }>`
    UPDATE agents SET actif = ${actif}, clos_le = ${actif ? null : new Date().toISOString()}::timestamptz
    WHERE id = ${id} RETURNING identifiant`;
  return r.rows[0]?.identifiant ?? null;
}

export async function compterAgents(): Promise<{ actifs: number; clos: number }> {
  const r = await sql<{ actif: boolean; n: number }>`SELECT actif, COUNT(*)::int AS n FROM agents GROUP BY actif`;
  const out = { actifs: 0, clos: 0 };
  for (const l of r.rows) {
    if (l.actif) out.actifs = l.n;
    else out.clos = l.n;
  }
  return out;
}

/** Un agent par son numéro interne (écrans d'administration). */
export async function lireAgent(id: number): Promise<LigneAgent | null> {
  const r = await sql<LigneAgent>`
    SELECT a.id, a.identifiant, a.actif, a.cree_le::text, a.clos_le::text,
           (SELECT COUNT(*) FROM rapports r WHERE r.agent_id = a.id)::int AS nb_rapports,
           (a.code_hash IS NOT NULL) AS code_defini,
           (SELECT COUNT(*) FROM progression p WHERE p.agent_id = a.id)::int AS nb_traces,
           (SELECT MAX(p.cree_le) FROM progression p WHERE p.agent_id = a.id)::text AS derniere_activite,
           ARRAY(SELECT c.libelle FROM acces c WHERE c.agent_id = a.id ORDER BY c.libelle) AS codes_relies,
           ARRAY(SELECT c.libelle FROM acces c WHERE c.agent_id = a.id AND c.role = 'tuteur' ORDER BY c.libelle) AS codes_tutorat
    FROM agents a WHERE a.id = ${id}`;
  return r.rows[0] ?? null;
}

/** Codes d'accès reliés à un identifiant, avec leur rôle : supervision des tuteurs par les pharmaciens (question 104). */
export async function codesDeLAgent(agentId: number): Promise<{ id: number; role: Role; libelle: string }[]> {
  const r = await sql<{ id: number; role: Role; libelle: string }>`
    SELECT id, role, libelle FROM acces WHERE agent_id = ${agentId} ORDER BY libelle`;
  return r.rows;
}
