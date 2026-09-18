import "server-only";
import { requete, sql, type Role } from "@/lib/db";
import { nouvelId } from "./banque-db";
import { filieres as FILIERES, getCritere, maintien, niveaux as NIVEAUX } from "./habilitation";
import { A_PRECISER, type Module, type NiveauHabilitation, type TypeParcours } from "./types";

/**
 * Modules déposés depuis l'administration (décision du 18/09/2026, question
 * 10, à la manière des dépôts du Lecteur QIM · QCM). Le texte de formation
 * des 58 critères reste versionné avec le code ; un module déposé porte un
 * titre, un objectif, une présentation courte, un rattachement facultatif à
 * un critère de la fiche, les profils auxquels il est proposé (filières,
 * niveaux, parcours), son seuil de réussite, et reçoit questions et documents
 * par son identifiant, comme un module du code.
 *
 * Cycle : `brouillon` (visible des tuteurs et administrateurs seulement) →
 * `publie` (au programme des profils choisis) → `retire` (plus proposé,
 * conservé avec ses questions). Aucune donnée nominative : `cree_par` est le
 * rôle et le libellé du code de session.
 */

export type StatutModule = "brouillon" | "publie" | "retire";

export const STATUTS_MODULE: Record<StatutModule, string> = {
  brouillon: "Brouillon",
  publie: "Publié",
  retire: "Retiré",
};

export interface LigneModuleDepose {
  id: string;
  titre: string;
  objectif: string;
  presentation: string;
  critere_id: string | null;
  filieres: string[];
  niveaux: string[];
  parcours: string[];
  seuil: number;
  duree_minutes: number;
  statut: StatutModule;
  cree_par: string;
  cree_le: string;
  edite_le: string;
  publie_le: string | null;
  version: number;
  nb_questions: number;
  nb_valides: number;
  nb_documents: number;
}

export interface ModuleDeposeAEnregistrer {
  titre: string;
  objectif: string;
  presentation: string;
  critereId: string | null;
  filieres: string[];
  niveaux: string[];
  parcours: TypeParcours[];
  seuil: number;
  dureeMinutes: number;
}

const FILIERES_VALIDES = new Set(FILIERES.map((f) => f.id).filter((id) => id !== "socle"));
const NIVEAUX_VALIDES = new Set<string>(NIVEAUX.map((n) => n.code));

/** Filières et niveaux reconnus ; les autres valeurs sont ignorées. */
export function filtrerProfils(filieres: unknown, niveaux: unknown): { filieres: string[]; niveaux: string[] } {
  const f = Array.isArray(filieres) ? filieres.filter((x): x is string => typeof x === "string" && FILIERES_VALIDES.has(x)) : [];
  const n = Array.isArray(niveaux) ? niveaux.filter((x): x is string => typeof x === "string" && NIVEAUX_VALIDES.has(x)) : [];
  return { filieres: [...new Set(f)], niveaux: [...new Set(n)] };
}

export function filtrerParcours(parcours: unknown): TypeParcours[] {
  const p = Array.isArray(parcours)
    ? parcours.filter((x): x is TypeParcours => x === "integration" || x === "maintien")
    : [];
  return p.length > 0 ? [...new Set(p)] : ["integration", "maintien"];
}

const COLONNES = `
  m.id, m.titre, m.objectif, m.presentation, m.critere_id, m.filieres, m.niveaux, m.parcours,
  m.seuil, m.duree_minutes, m.statut, m.cree_par, m.cree_le::text, m.edite_le::text,
  m.publie_le::text, m.version,
  (SELECT COUNT(*)::int FROM questions q WHERE q.module_id = m.id AND q.statut <> 'retire') AS nb_questions,
  (SELECT COUNT(*)::int FROM questions q WHERE q.module_id = m.id AND q.statut = 'valide') AS nb_valides,
  (SELECT COUNT(*)::int FROM depots d WHERE d.module_id = m.id) AS nb_documents`;

export async function listerModulesDeposes(statut?: StatutModule): Promise<LigneModuleDepose[]> {
  const r = await requete<LigneModuleDepose>(
    `SELECT ${COLONNES} FROM modules_deposes m
     WHERE ($1::text IS NULL OR m.statut = $1)
     ORDER BY (m.statut = 'publie') DESC, m.cree_le DESC`,
    [statut ?? null],
  );
  return r.rows;
}

export async function lireModuleDepose(id: string): Promise<LigneModuleDepose | null> {
  const r = await requete<LigneModuleDepose>(`SELECT ${COLONNES} FROM modules_deposes m WHERE m.id = $1`, [id]);
  return r.rows[0] ?? null;
}

export async function enregistrerModuleDepose(
  m: ModuleDeposeAEnregistrer,
  acteur: { role: Role; libelle: string },
  id?: string,
): Promise<string> {
  const ident = id ?? nouvelId("mod");
  const par = `${acteur.role} · ${acteur.libelle}`;
  await sql`
    INSERT INTO modules_deposes (id, titre, objectif, presentation, critere_id, filieres, niveaux, parcours,
      seuil, duree_minutes, cree_par)
    VALUES (${ident}, ${m.titre}, ${m.objectif}, ${m.presentation}, ${m.critereId},
      ${JSON.stringify(m.filieres)}::jsonb, ${JSON.stringify(m.niveaux)}::jsonb, ${JSON.stringify(m.parcours)}::jsonb,
      ${m.seuil}, ${m.dureeMinutes}, ${par})
    ON CONFLICT (id) DO UPDATE SET
      titre = EXCLUDED.titre, objectif = EXCLUDED.objectif, presentation = EXCLUDED.presentation,
      critere_id = EXCLUDED.critere_id, filieres = EXCLUDED.filieres, niveaux = EXCLUDED.niveaux,
      parcours = EXCLUDED.parcours, seuil = EXCLUDED.seuil, duree_minutes = EXCLUDED.duree_minutes,
      edite_le = NOW(), version = modules_deposes.version + 1`;
  return ident;
}

export async function changerStatutModule(id: string, statut: StatutModule): Promise<void> {
  await sql`
    UPDATE modules_deposes SET statut = ${statut}, edite_le = NOW(),
      publie_le = CASE WHEN ${statut} = 'publie' THEN COALESCE(publie_le, NOW()) ELSE publie_le END
    WHERE id = ${id}`;
}

/** Suppression refusée tant que des questions ou des documents s'y rattachent. */
export async function supprimerModuleDepose(id: string): Promise<{ ok: true } | { ok: false; raison: string }> {
  const l = await lireModuleDepose(id);
  if (!l) return { ok: false, raison: "Module inconnu." };
  if (l.nb_questions > 0 || l.nb_documents > 0) {
    return {
      ok: false,
      raison: `Ce module porte encore ${l.nb_questions} question(s) et ${l.nb_documents} document(s) : retirez-le, ou déplacez-les d'abord.`,
    };
  }
  await sql`DELETE FROM modules_deposes WHERE id = ${id}`;
  return { ok: true };
}

/** Un module déposé lu comme un module du modèle de contenu (sans ses questions). */
export function versModule(l: LigneModuleDepose): Module {
  const critere = l.critere_id ? getCritere(l.critere_id) : undefined;
  const { filieres, niveaux } = filtrerProfils(l.filieres, l.niveaux);
  return {
    id: l.id,
    titre: l.titre,
    objectif: l.objectif || `Module déposé par les tuteurs : ${l.titre}.`,
    bloc: critere?.bloc ?? A_PRECISER,
    affectation: filieres.length === 0 ? "tronc-commun" : "poste",
    critereId: critere?.id ?? A_PRECISER,
    postes: filieres,
    niveaux: niveaux as NiveauHabilitation[],
    parcours: filtrerParcours(l.parcours),
    dureeMinutes: l.duree_minutes,
    redige: true,
    sections: l.presentation.trim() ? [{ titre: "Présentation", corps: l.presentation }] : [],
    ressources: [],
    questions: [],
    misesEnSituation: [],
    seuilReussite: l.seuil,
    periodiciteMois: maintien.periodiciteMois,
    bibliographie: [],
    origine: "base",
    filieres,
    statut: l.statut,
  };
}

// ─────────────────────────────────────────── seuils réglés des modules du code

export async function lireReglagesSeuils(): Promise<Record<string, number>> {
  const r = await sql<{ module_id: string; seuil: number }>`SELECT module_id, seuil FROM reglages_modules`;
  return Object.fromEntries(r.rows.map((x) => [x.module_id, x.seuil]));
}

/** Seuil réglé pour un module du code ; `null` rétablit le seuil par défaut du barème. */
export async function enregistrerReglageSeuil(
  moduleId: string,
  seuil: number | null,
  acteur: { role: Role; libelle: string },
): Promise<void> {
  if (seuil === null) {
    await sql`DELETE FROM reglages_modules WHERE module_id = ${moduleId}`;
    return;
  }
  const par = `${acteur.role} · ${acteur.libelle}`;
  await sql`
    INSERT INTO reglages_modules (module_id, seuil, modifie_par) VALUES (${moduleId}, ${seuil}, ${par})
    ON CONFLICT (module_id) DO UPDATE SET seuil = EXCLUDED.seuil, modifie_par = EXCLUDED.modifie_par, modifie_le = NOW()`;
}
