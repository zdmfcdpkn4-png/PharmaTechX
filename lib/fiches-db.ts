import "server-only";
import { requete, sql, type Role } from "./db";
import type { StatutFiche } from "@/content/fiches";

/**
 * Fiches de synthèse en base (questions 59 et 60, 23/09/2026) : des documents
 * de nature « synthese », rattachés à un module, qui se valident comme des
 * questions et se signalent comme elles. Voir `content/fiches.ts`.
 */

export interface LigneFiche {
  id: number;
  titre: string;
  url: string;
  module_id: string;
  statut: StatutFiche;
  depose_le: string;
  depose_par: string;
  depose_par_acces: number | null;
  edite_par: string | null;
  edite_par_acces: number | null;
  edite_le: string | null;
  valide_par: string | null;
  valide_le: string | null;
  valide_par_auteur: boolean;
  /** Signalements ouverts sur la fiche (question 60). */
  signalements_ouverts: number;
}

const COLONNES = `d.id, d.titre, d.url, d.module_id, d.statut, d.depose_le::text, d.depose_par, d.depose_par_acces,
  d.edite_par, d.edite_par_acces, d.edite_le::text, d.valide_par, d.valide_le::text, d.valide_par_auteur,
  (SELECT COUNT(*)::int FROM signalements s WHERE s.depot_id = d.id AND s.statut = 'ouvert') AS signalements_ouverts`;

/** Fiches d'un module, ou fiches d'un statut sur tous les modules ; les plus récentes d'abord. */
export async function listerFiches(filtre: { moduleId?: string; statut?: StatutFiche }): Promise<LigneFiche[]> {
  const conditions = ["d.nature = 'synthese'", "d.module_id IS NOT NULL"];
  const valeurs: unknown[] = [];
  if (filtre.moduleId) {
    valeurs.push(filtre.moduleId);
    conditions.push(`d.module_id = $${valeurs.length}`);
  }
  if (filtre.statut) {
    valeurs.push(filtre.statut);
    conditions.push(`d.statut = $${valeurs.length}`);
  }
  const r = await requete<LigneFiche>(
    `SELECT ${COLONNES} FROM depots d WHERE ${conditions.join(" AND ")} ORDER BY d.depose_le DESC`,
    valeurs,
  );
  return r.rows;
}

export async function lireFiche(id: number): Promise<LigneFiche | null> {
  const r = await requete<LigneFiche>(
    `SELECT ${COLONNES} FROM depots d WHERE d.id = $1 AND d.nature = 'synthese' AND d.module_id IS NOT NULL`,
    [id],
  );
  return r.rows[0] ?? null;
}

/** Nombre de fiches à vérifier : il s'ajoute aux questions dans la file « à vérifier ». */
export async function compterFichesAVerifier(): Promise<number> {
  const r = await sql<{ n: number }>`
    SELECT COUNT(*)::int AS n FROM depots
    WHERE nature = 'synthese' AND module_id IS NOT NULL AND statut = 'a_verifier'`;
  return r.rows[0]?.n ?? 0;
}

/** Valide une fiche à vérifier ; `parAuteur` trace la validation par son auteur d'administration. */
export async function validerFiche(
  id: number,
  acteur: { role: Role; libelle: string; acces?: number | null },
  parAuteur: boolean,
): Promise<void> {
  await sql`
    UPDATE depots SET statut = 'valide', valide_par = ${`${acteur.role} · ${acteur.libelle}`},
      valide_par_acces = ${acteur.acces ?? null}, valide_le = NOW(), valide_par_auteur = ${parAuteur}
    WHERE id = ${id} AND nature = 'synthese' AND statut = 'a_verifier'`;
}

/**
 * Retire une fiche, ou la remet « à vérifier ». Remise à vérifier, elle perd
 * sa validation : il en faudra une nouvelle, et c'est elle que citeront les
 * rapports suivants.
 */
export async function changerStatutFiche(id: number, statut: "a_verifier" | "retire"): Promise<void> {
  if (statut === "retire") {
    await sql`UPDATE depots SET statut = 'retire' WHERE id = ${id} AND nature = 'synthese'`;
    return;
  }
  await sql`
    UPDATE depots SET statut = 'a_verifier', valide_par = NULL, valide_par_acces = NULL, valide_le = NULL,
      valide_par_auteur = FALSE
    WHERE id = ${id} AND nature = 'synthese'`;
}

/**
 * Version corrigée d'une fiche : le nouveau fichier la remplace, la fiche
 * repart « à vérifier » et son correcteur en devient l'auteur courant. Le
 * fichier précédent est gardé : un rapport émis avant la correction pointe
 * encore sur lui.
 */
export async function remplacerFichierFiche(
  id: number,
  url: string,
  acteur: { role: Role; libelle: string; acces?: number | null },
): Promise<void> {
  await sql`
    UPDATE depots SET url = ${url}, statut = 'a_verifier', edite_par = ${`${acteur.role} · ${acteur.libelle}`},
      edite_par_acces = ${acteur.acces ?? null}, edite_le = NOW(),
      valide_par = NULL, valide_par_acces = NULL, valide_le = NULL, valide_par_auteur = FALSE
    WHERE id = ${id} AND nature = 'synthese'`;
}
