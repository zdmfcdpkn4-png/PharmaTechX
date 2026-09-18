import "server-only";
import { randomBytes } from "node:crypto";
import { sql, sqlSur, transaction, type Role } from "./db";
import { formaterNumeroRapport } from "./schema";
import type { ResultatEvaluation } from "@/app/api/evaluation/route";

/**
 * Rapports d'évaluation enregistrés — actifs seulement quand
 * `CONSERVATION_RAPPORTS=nominative` (voir `lib/config.ts`).
 *
 * Un rapport est émis par l'apprenant à partir d'un résultat scellé par le
 * serveur ; il reçoit un numéro, une empreinte, et entre dans le circuit de
 * visas. Son contenu ne change plus : une correction passe par l'annulation
 * (motivée) et une nouvelle émission.
 */

export type StatutRapport = "emis" | "vise_tuteur" | "clos" | "annule";
export type QualiteVisaBase = "apprenant" | "tuteur" | "pharmacien";

export interface LigneRapport {
  id: string;
  numero: string;
  module_id: string;
  module_titre: string;
  critere_id: string | null;
  apprenant_nom: string;
  apprenant_qualite: string;
  tirage: string;
  resultat: ResultatEvaluation;
  empreinte: string;
  statut: StatutRapport;
  emis_le: string;
  annule_motif: string | null;
  annule_le: string | null;
}

export interface LigneVisa {
  id: number;
  rapport_id: string;
  qualite: QualiteVisaBase;
  nom: string;
  role_session: string;
  libelle_session: string;
  commentaire: string;
  empreinte: string;
  signe_le: string;
}

export interface RapportComplet extends LigneRapport {
  visas: LigneVisa[];
}

export const LIBELLES_STATUT_RAPPORT: Record<StatutRapport, string> = {
  emis: "Émis — en attente du visa du tuteur",
  vise_tuteur: "Visé par le tuteur — en attente du pharmacien",
  clos: "Clos — visé par le pharmacien responsable",
  annule: "Annulé",
};

export async function emettreRapport(e: {
  resultat: ResultatEvaluation;
  empreinte: string;
  apprenantNom: string;
  apprenantQualite: string;
  roleSession: Role | "aucun";
  libelleSession: string;
}): Promise<{ id: string; numero: string; emisLe: Date }> {
  return transaction(async (client) => {
    const s = sqlSur(client);
    const seq = await s<{ n: string }>`SELECT nextval('rapports_numero_seq')::text AS n`;
    const numero = formaterNumeroRapport(new Date().getFullYear(), Number(seq.rows[0].n));
    const id = randomBytes(9).toString("base64url");
    const r = e.resultat;
    const emis = await s<{ emis_le: Date }>`
      INSERT INTO rapports (id, numero, module_id, module_titre, critere_id, apprenant_nom,
        apprenant_qualite, tirage, resultat, empreinte)
      VALUES (${id}, ${numero}, ${r.moduleId}, ${r.moduleTitre}, ${r.critereId}, ${e.apprenantNom},
        ${e.apprenantQualite}, ${r.tirage}, ${JSON.stringify(r)}::jsonb, ${e.empreinte})
      RETURNING emis_le`;
    await s`
      INSERT INTO visas (rapport_id, qualite, nom, role_session, libelle_session, commentaire, empreinte)
      VALUES (${id}, 'apprenant', ${e.apprenantNom}, ${e.roleSession}, ${e.libelleSession},
        'Atteste avoir lu le module et passé l''évaluation dans les conditions décrites.', ${e.empreinte})`;
    return { id, numero, emisLe: emis.rows[0].emis_le };
  });
}

export async function listerRapports(filtre: { statut?: StatutRapport } = {}): Promise<LigneRapport[]> {
  const statut = filtre.statut ?? null;
  const r = await sql<LigneRapport>`
    SELECT id, numero, module_id, module_titre, critere_id, apprenant_nom, apprenant_qualite,
           tirage, resultat, empreinte, statut, emis_le::text, annule_motif, annule_le::text
    FROM rapports
    WHERE (${statut}::text IS NULL OR statut = ${statut})
    ORDER BY emis_le DESC LIMIT 300`;
  return r.rows;
}

export async function lireRapport(id: string): Promise<RapportComplet | null> {
  const r = await sql<LigneRapport>`
    SELECT id, numero, module_id, module_titre, critere_id, apprenant_nom, apprenant_qualite,
           tirage, resultat, empreinte, statut, emis_le::text, annule_motif, annule_le::text
    FROM rapports WHERE id = ${id}`;
  const ligne = r.rows[0];
  if (!ligne) return null;
  const v = await sql<LigneVisa>`
    SELECT id, rapport_id, qualite, nom, role_session, libelle_session, commentaire, empreinte, signe_le::text
    FROM visas WHERE rapport_id = ${id} ORDER BY signe_le`;
  return { ...ligne, visas: v.rows };
}

export async function viser(
  id: string,
  v: { qualite: "tuteur" | "pharmacien"; nom: string; commentaire: string; roleSession: Role; libelleSession: string },
): Promise<void> {
  await transaction(async (client) => {
    const s = sqlSur(client);
    const r = await s<{ empreinte: string; statut: StatutRapport }>`
      SELECT empreinte, statut FROM rapports WHERE id = ${id} FOR UPDATE`;
    const ligne = r.rows[0];
    if (!ligne || ligne.statut === "annule") throw new Error("rapport-indisponible");
    await s`
      INSERT INTO visas (rapport_id, qualite, nom, role_session, libelle_session, commentaire, empreinte)
      VALUES (${id}, ${v.qualite}, ${v.nom}, ${v.roleSession}, ${v.libelleSession}, ${v.commentaire}, ${ligne.empreinte})`;
    const statut: StatutRapport = v.qualite === "pharmacien" ? "clos" : "vise_tuteur";
    await s`UPDATE rapports SET statut = ${statut} WHERE id = ${id}`;
  });
}

export async function annulerRapport(id: string, motif: string): Promise<void> {
  await sql`UPDATE rapports SET statut = 'annule', annule_motif = ${motif}, annule_le = NOW() WHERE id = ${id}`;
}

export async function comptesRapports(): Promise<Record<StatutRapport, number>> {
  const r = await sql<{ statut: StatutRapport; n: number }>`
    SELECT statut, COUNT(*)::int AS n FROM rapports GROUP BY statut`;
  const out: Record<StatutRapport, number> = { emis: 0, vise_tuteur: 0, clos: 0, annule: 0 };
  for (const l of r.rows) out[l.statut] = l.n;
  return out;
}
