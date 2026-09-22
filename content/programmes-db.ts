import "server-only";
import { sql } from "@/lib/db";
import { estStatutProgramme, type Programme, type StatutProgramme } from "./programmes";

/**
 * Programmes à la carte en base (question 50, 22/09/2026). La règle — ordre,
 * validation, retour en brouillon — est dans `content/programmes.ts`, pure et
 * testée ; ce fichier ne fait que lire et écrire.
 */

interface LigneProgramme {
  id: number;
  nom: string;
  destinataire: string;
  motif: string;
  modules: unknown;
  statut: string;
  cree_par: string;
  cree_le: string;
  modifie_par: string | null;
  modifie_le: string | null;
  valide_par: string | null;
  valide_le: string | null;
}

function versProgramme(l: LigneProgramme): Programme {
  return {
    id: l.id,
    nom: l.nom,
    destinataire: l.destinataire,
    motif: l.motif,
    modules: Array.isArray(l.modules) ? l.modules.filter((x): x is string => typeof x === "string") : [],
    statut: estStatutProgramme(l.statut) ? l.statut : "brouillon",
    creePar: l.cree_par,
    creeLe: l.cree_le,
    modifiePar: l.modifie_par,
    modifieLe: l.modifie_le,
    validePar: l.valide_par,
    valideLe: l.valide_le,
  };
}

export async function listerProgrammes(statut?: StatutProgramme): Promise<Programme[]> {
  const r = statut
    ? await sql<LigneProgramme>`
        SELECT id, nom, destinataire, motif, modules, statut, cree_par, cree_le::text,
               modifie_par, modifie_le::text, valide_par, valide_le::text
        FROM programmes WHERE statut = ${statut} ORDER BY nom, id`
    : await sql<LigneProgramme>`
        SELECT id, nom, destinataire, motif, modules, statut, cree_par, cree_le::text,
               modifie_par, modifie_le::text, valide_par, valide_le::text
        FROM programmes ORDER BY statut = 'retire', nom, id`;
  return r.rows.map(versProgramme);
}

export async function lireProgramme(id: number): Promise<Programme | null> {
  const r = await sql<LigneProgramme>`
    SELECT id, nom, destinataire, motif, modules, statut, cree_par, cree_le::text,
           modifie_par, modifie_le::text, valide_par, valide_le::text
    FROM programmes WHERE id = ${id}`;
  return r.rows[0] ? versProgramme(r.rows[0]) : null;
}

export interface ProgrammeSaisi {
  nom: string;
  destinataire: string;
  motif: string;
  modules: string[];
}

export async function creerProgramme(p: ProgrammeSaisi, par: string): Promise<number> {
  const r = await sql<{ id: number }>`
    INSERT INTO programmes (nom, destinataire, motif, modules, cree_par)
    VALUES (${p.nom}, ${p.destinataire}, ${p.motif}, ${JSON.stringify(p.modules)}::jsonb, ${par})
    RETURNING id`;
  return r.rows[0].id;
}

/**
 * Modification : le programme repasse en brouillon et perd sa validation,
 * quel que soit son statut — un programme validé ne change pas en silence.
 */
export async function modifierProgramme(id: number, p: ProgrammeSaisi, par: string): Promise<boolean> {
  const r = await sql`
    UPDATE programmes
    SET nom = ${p.nom}, destinataire = ${p.destinataire}, motif = ${p.motif},
        modules = ${JSON.stringify(p.modules)}::jsonb,
        statut = 'brouillon', valide_par = NULL, valide_le = NULL,
        modifie_par = ${par}, modifie_le = NOW()
    WHERE id = ${id}`;
  return r.rowCount > 0;
}

/** Validation d'un brouillon ; `false` si le programme n'était pas en brouillon. */
export async function validerProgramme(id: number, par: string): Promise<boolean> {
  const r = await sql`
    UPDATE programmes SET statut = 'valide', valide_par = ${par}, valide_le = NOW()
    WHERE id = ${id} AND statut = 'brouillon'`;
  return r.rowCount > 0;
}

/** Retrait d'un programme validé ou en brouillon : il quitte les postes, il reste lisible ici. */
export async function retirerProgramme(id: number, par: string): Promise<boolean> {
  const r = await sql`
    UPDATE programmes SET statut = 'retire', modifie_par = ${par}, modifie_le = NOW()
    WHERE id = ${id} AND statut <> 'retire'`;
  return r.rowCount > 0;
}

/** Programme sur lequel s'ouvre un code de poste ; `null` s'il n'en porte pas. */
export async function programmeDuCode(acces: number): Promise<number | null> {
  const r = await sql<{ programme_id: number | null }>`SELECT programme_id FROM acces WHERE id = ${acces}`;
  return r.rows[0]?.programme_id ?? null;
}

/** Codes de poste qui ouvrent sur chaque programme, pour l'écran des programmes. */
export async function codesParProgramme(): Promise<Record<number, number>> {
  const r = await sql<{ programme_id: number; n: number }>`
    SELECT programme_id, COUNT(*)::int AS n FROM acces
    WHERE programme_id IS NOT NULL AND actif GROUP BY programme_id`;
  return Object.fromEntries(r.rows.map((l) => [l.programme_id, l.n]));
}
