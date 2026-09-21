import "server-only";
import { cookies } from "next/headers";
import { decoderJeton, encoderJeton, hacherCode, verifierCode } from "./auth";
import { baseConfiguree, requete, sql } from "./db";
import type { ResultatEvaluation } from "@/app/api/evaluation/route";
import { normaliserEtatEnCours, type EtatEnCours } from "@/content/en-cours";

/**
 * Progression d'apprentissage sous identifiant d'agent — décision du
 * 18/09/2026 (question 11, choix c), transposée du mode serveur du Lecteur
 * QIM · QCM.
 *
 * L'apprenant se **rattache** en saisissant son identifiant (AG-001…) et un
 * code personnel de 4 à 8 chiffres, choisi par lui à la première fois et
 * conservé haché (scrypt, comme les codes d'accès) ; un tuteur peut le
 * réinitialiser. Le rattachement est un cookie signé de douze heures, distinct
 * de la session de rôle. Tant qu'il est posé :
 *   - chaque évaluation corrigée est conservée avec son résultat scellé ;
 *   - la fin d'un entraînement et la lecture d'un module sont notées ;
 *   - l'évaluation en cours est sauvegardée pour être reprise ;
 *   - l'émission d'un rapport se fait sous cet identifiant, sans le ressaisir.
 * Rien ne désigne la personne : l'identifiant reste pseudonyme (docs/RGPD.md).
 */

export interface Rattachement {
  agentId: number;
  identifiant: string;
  exp: number;
}

const COOKIE = "fp_progression";
const DUREE_HEURES = 12;

export const CODE_PERSONNEL = /^\d{4,8}$/;

export function codePersonnelValide(v: unknown): v is string {
  return typeof v === "string" && CODE_PERSONNEL.test(v);
}

export async function rattachement(): Promise<Rattachement | null> {
  if (!baseConfiguree()) return null;
  const jeton = (await cookies()).get(COOKIE)?.value;
  return jeton ? decoderJeton<Rattachement>(jeton) : null;
}

export async function rattacher(agent: { id: number; identifiant: string }): Promise<void> {
  const r: Rattachement = {
    agentId: agent.id,
    identifiant: agent.identifiant,
    exp: Math.floor(Date.now() / 1000) + DUREE_HEURES * 3600,
  };
  (await cookies()).set(COOKIE, encoderJeton(r), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: DUREE_HEURES * 3600,
  });
}

export async function detacher(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

// ───────────────────────────────────────────────────────── code personnel

export async function codePersonnelDefini(agentId: number): Promise<boolean> {
  const r = await sql<{ defini: boolean }>`SELECT code_hash IS NOT NULL AS defini FROM agents WHERE id = ${agentId}`;
  return r.rows[0]?.defini ?? false;
}

export async function definirCodePersonnel(agentId: number, code: string): Promise<void> {
  await sql`UPDATE agents SET code_hash = ${hacherCode(code)}, code_maj_le = NOW() WHERE id = ${agentId}`;
}

export async function verifierCodePersonnel(agentId: number, code: string): Promise<boolean> {
  const r = await sql<{ code_hash: string | null }>`SELECT code_hash FROM agents WHERE id = ${agentId}`;
  const h = r.rows[0]?.code_hash;
  return typeof h === "string" && verifierCode(code, h);
}

export async function reinitialiserCodePersonnel(agentId: number): Promise<void> {
  await sql`UPDATE agents SET code_hash = NULL, code_maj_le = NOW() WHERE id = ${agentId}`;
}

// ────────────────────────────────────────────────────────────── traces

export type NatureProgression = "evaluation" | "entrainement" | "lecture";

export interface LigneProgression {
  id: number;
  agent_id: number;
  module_id: string;
  nature: NatureProgression;
  resultat: unknown | null;
  score: number | null;
  verdict: string | null;
  cree_le: string;
}

/** Résumé d'un entraînement, conservé à sa fin. */
export interface ResumeEntrainement {
  justes: number;
  total: number;
  points: number;
  tirage: string;
}

const COLONNES = `id, agent_id, module_id, nature, resultat, score, verdict, cree_le::text`;

/** Une évaluation corrigée, avec son résultat scellé ; efface la session en cours du module. */
export async function enregistrerEvaluation(agentId: number, r: ResultatEvaluation): Promise<boolean> {
  const ins = await sql`
    INSERT INTO progression (agent_id, module_id, nature, resultat, score, verdict)
    SELECT ${agentId}, ${r.moduleId}, 'evaluation', ${JSON.stringify(r)}::jsonb, ${r.score}, ${r.verdict}
    WHERE EXISTS (SELECT 1 FROM agents WHERE id = ${agentId} AND actif)`;
  await sql`DELETE FROM en_cours WHERE agent_id = ${agentId} AND module_id = ${r.moduleId}`;
  return ins.rowCount > 0;
}

export async function enregistrerEntrainement(agentId: number, moduleId: string, e: ResumeEntrainement): Promise<boolean> {
  const score = e.total > 0 ? Math.round((e.justes / e.total) * 100) : 0;
  const r = await sql`
    INSERT INTO progression (agent_id, module_id, nature, resultat, score)
    SELECT ${agentId}, ${moduleId}, 'entrainement', ${JSON.stringify(e)}::jsonb, ${score}
    WHERE EXISTS (SELECT 1 FROM agents WHERE id = ${agentId} AND actif)`;
  await sql`DELETE FROM en_cours WHERE agent_id = ${agentId} AND module_id = ${moduleId}`;
  return r.rowCount > 0;
}

/** Une lecture par module et par agent : la date est celle de la dernière. */
export async function enregistrerLecture(agentId: number, moduleId: string): Promise<boolean> {
  const maj = await sql`
    UPDATE progression SET cree_le = NOW()
    WHERE agent_id = ${agentId} AND module_id = ${moduleId} AND nature = 'lecture'`;
  if (maj.rowCount > 0) return true;
  const r = await sql`
    INSERT INTO progression (agent_id, module_id, nature)
    SELECT ${agentId}, ${moduleId}, 'lecture'
    WHERE EXISTS (SELECT 1 FROM agents WHERE id = ${agentId} AND actif)`;
  return r.rowCount > 0;
}

export async function historique(agentId: number, limite = 300): Promise<LigneProgression[]> {
  const r = await requete<LigneProgression>(
    `SELECT ${COLONNES} FROM progression WHERE agent_id = $1 ORDER BY cree_le ASC, id ASC LIMIT $2`,
    [agentId, limite],
  );
  return r.rows;
}

/** Les évaluations conservées, dans l'ordre chronologique, pour la mémoire de session du navigateur. */
export async function evaluationsDeLAgent(agentId: number, limite = 200): Promise<ResultatEvaluation[]> {
  const r = await requete<{ resultat: ResultatEvaluation }>(
    `SELECT resultat FROM progression WHERE agent_id = $1 AND nature = 'evaluation' AND resultat IS NOT NULL
     ORDER BY cree_le ASC, id ASC LIMIT $2`,
    [agentId, limite],
  );
  return r.rows.map((x) => x.resultat);
}

export interface EmissionAgent {
  id: string;
  numero: string;
  empreinte: string;
  emis_le: string;
  identifiant: string;
  module_id: string | null;
  horodatage_iso: string | null;
}

/** Les rapports émis par l'agent, pour retrouver « émis sous le n° » sur ses évaluations. */
export async function emissionsDeLAgent(agentId: number): Promise<EmissionAgent[]> {
  const r = await sql<EmissionAgent>`
    SELECT id, numero, empreinte, emis_le::text, agent_identifiant AS identifiant,
           resultat->>'moduleId' AS module_id, resultat->>'horodatageIso' AS horodatage_iso
    FROM rapports WHERE agent_id = ${agentId} ORDER BY emis_le ASC`;
  return r.rows;
}

export interface StatistiquesAgent {
  evaluations: number;
  entrainements: number;
  lectures: number;
  derniere: string | null;
}

export async function statistiquesAgent(agentId: number): Promise<StatistiquesAgent> {
  const r = await sql<{ nature: NatureProgression; n: number; derniere: string }>`
    SELECT nature, COUNT(*)::int AS n, MAX(cree_le)::text AS derniere
    FROM progression WHERE agent_id = ${agentId} GROUP BY nature`;
  const out: StatistiquesAgent = { evaluations: 0, entrainements: 0, lectures: 0, derniere: null };
  for (const l of r.rows) {
    if (l.nature === "evaluation") out.evaluations = l.n;
    else if (l.nature === "entrainement") out.entrainements = l.n;
    else out.lectures = l.n;
    if (!out.derniere || l.derniere > out.derniere) out.derniere = l.derniere;
  }
  return out;
}

/** Purge par l'administrateur : traces et session en cours de l'agent ; nombre de lignes effacées. */
export async function purgerProgression(agentId: number): Promise<number> {
  const a = await sql`DELETE FROM progression WHERE agent_id = ${agentId}`;
  const b = await sql`DELETE FROM en_cours WHERE agent_id = ${agentId}`;
  return a.rowCount + b.rowCount;
}

// ─────────────────────────────────────────────────────── session en cours

export async function sauverEnCours(agentId: number, moduleId: string, brut: unknown): Promise<boolean> {
  const etat = normaliserEtatEnCours(brut);
  if (!etat) return false;
  const r = await sql`
    INSERT INTO en_cours (agent_id, module_id, etat)
    SELECT ${agentId}, ${moduleId}, ${JSON.stringify(etat)}::jsonb
    WHERE EXISTS (SELECT 1 FROM agents WHERE id = ${agentId} AND actif)
    ON CONFLICT (agent_id, module_id) DO UPDATE SET etat = EXCLUDED.etat, maj_le = NOW()`;
  return r.rowCount > 0;
}

export async function effacerEnCours(agentId: number, moduleId: string): Promise<void> {
  await sql`DELETE FROM en_cours WHERE agent_id = ${agentId} AND module_id = ${moduleId}`;
}

export async function lireEnCours(agentId: number, moduleId: string): Promise<EtatEnCours | null> {
  const r = await sql<{ etat: unknown }>`SELECT etat FROM en_cours WHERE agent_id = ${agentId} AND module_id = ${moduleId}`;
  return r.rows[0] ? normaliserEtatEnCours(r.rows[0].etat) : null;
}

/**
 * La dernière évaluation laissée en plan par cet agent, tous modules
 * confondus. Sert la zone « Reprendre » de l'accès rapide (paquet A,
 * 21/09/2026) : sans elle, il faudrait connaître le module pour savoir qu'on
 * l'a interrompu.
 */
export interface EnCoursRepris {
  moduleId: string;
  etat: EtatEnCours;
  majLe: string;
}

export async function dernierEnCours(agentId: number): Promise<EnCoursRepris | null> {
  const r = await sql<{ module_id: string; etat: unknown; maj_le: string }>`
    SELECT module_id, etat, maj_le::text
    FROM en_cours WHERE agent_id = ${agentId}
    ORDER BY maj_le DESC LIMIT 1`;
  const l = r.rows[0];
  if (!l) return null;
  const etat = normaliserEtatEnCours(l.etat);
  return etat ? { moduleId: l.module_id, etat, majLe: l.maj_le } : null;
}
