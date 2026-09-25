import "server-only";
import { requete, sql, type Role } from "@/lib/db";
import { nouvelId } from "./banque-db";
import { filieres as FILIERES, getCritere, maintien, niveaux as NIVEAUX } from "./habilitation";
import { getReferentiel, identifiantsConnus } from "./referentiel-db";
import { A_PRECISER, type Module, type NiveauHabilitation, type TypeParcours } from "./types";
import { listeConnue, niveauxConnus, parcoursConnus, reglageVide, type ReglageModule } from "./reglages";

/**
 * Modules déposés depuis l'administration (décision du 18/09/2026, question
 * 10, à la manière des dépôts du Lecteur QIM · QCM). Le texte de formation
 * des 53 critères reste versionné avec le code ; un module déposé porte un
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
  /** Identifiant de badge : vide = jamais renseigné, `SANS_BADGE` = retiré. */
  badge: string;
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
  badge: string;
}

/** Valeurs de formulaire ramenées à des chaînes distinctes et bornées. */
function chainesDistinctes(brut: unknown, connues?: Set<string>): string[] {
  const l = Array.isArray(brut)
    ? brut.filter((x): x is string => typeof x === "string" && x.length > 0 && x.length <= 40)
    : [];
  return [...new Set(connues ? l.filter((x) => connues.has(x)) : l)].slice(0, 40);
}

/**
 * Filières et niveaux reconnus **au moment de la saisie** ; les autres valeurs
 * sont ignorées. Les listes viennent du référentiel servi aux écrans (fiche
 * versionnée + dépôts actifs, `content/referentiel-db.ts`) : une filière
 * déposée est donc acceptée, ce que la liste figée du code refusait.
 */
export async function filtrerProfils(
  filieres: unknown,
  niveaux: unknown,
): Promise<{ filieres: string[]; niveaux: string[] }> {
  const { filieres: F, niveaux: N } = await getReferentiel().catch(() => ({
    filieres: FILIERES,
    niveaux: NIVEAUX,
  }));
  const valides = new Set(F.map((f) => f.id).filter((id) => id !== "socle"));
  const codes = new Set<string>(N.map((n) => String(n.code)));
  return { filieres: chainesDistinctes(filieres, valides), niveaux: chainesDistinctes(niveaux, codes) };
}

/**
 * Relecture d'une ligne déjà enregistrée : on ne refiltre pas contre le
 * référentiel courant. Les valeurs ont été validées à l'écriture, et une
 * filière retirée depuis ne doit pas disparaître en silence du module qui la
 * cite — elle doit rester visible pour être corrigée.
 */
function profilsEnregistres(filieres: unknown, niveaux: unknown): { filieres: string[]; niveaux: string[] } {
  return { filieres: chainesDistinctes(filieres), niveaux: chainesDistinctes(niveaux) };
}

export function filtrerParcours(parcours: unknown): TypeParcours[] {
  const p = Array.isArray(parcours)
    ? parcours.filter((x): x is TypeParcours => x === "integration" || x === "maintien")
    : [];
  return p.length > 0 ? [...new Set(p)] : ["integration", "maintien"];
}

/** Question de sa banque : du module, ou aussi posée dans le module (question 74). */
const POSEE_ICI = `(q.module_id = m.id OR EXISTS (SELECT 1 FROM questions_modules qm WHERE qm.question_id = q.id AND qm.module_id = m.id))`;

const COLONNES = `
  m.id, m.titre, m.objectif, m.presentation, m.critere_id, m.filieres, m.niveaux, m.parcours,
  m.seuil, m.duree_minutes, m.statut, m.cree_par, m.cree_le::text, m.edite_le::text,
  m.publie_le::text, m.version, m.badge,
  (SELECT COUNT(*)::int FROM questions q WHERE ${POSEE_ICI} AND q.statut <> 'retire') AS nb_questions,
  (SELECT COUNT(*)::int FROM questions q WHERE ${POSEE_ICI} AND q.statut = 'valide') AS nb_valides,
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
      seuil, duree_minutes, badge, cree_par)
    VALUES (${ident}, ${m.titre}, ${m.objectif}, ${m.presentation}, ${m.critereId},
      ${JSON.stringify(m.filieres)}::jsonb, ${JSON.stringify(m.niveaux)}::jsonb, ${JSON.stringify(m.parcours)}::jsonb,
      ${m.seuil}, ${m.dureeMinutes}, ${m.badge}, ${par})
    ON CONFLICT (id) DO UPDATE SET
      titre = EXCLUDED.titre, objectif = EXCLUDED.objectif, presentation = EXCLUDED.presentation,
      critere_id = EXCLUDED.critere_id, filieres = EXCLUDED.filieres, niveaux = EXCLUDED.niveaux,
      parcours = EXCLUDED.parcours, seuil = EXCLUDED.seuil, duree_minutes = EXCLUDED.duree_minutes,
      badge = EXCLUDED.badge,
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
      raison: `Ce module porte encore ${l.nb_questions} question(s) et ${l.nb_documents} document(s) : retirez-le, ou déplacez-les d'abord. Une question seulement « aussi posée » ici se décoche dans son éditeur.`,
    };
  }
  await sql`DELETE FROM modules_deposes WHERE id = ${id}`;
  // Rattachements de questions retirées : sans module, ils ne mènent plus nulle part (question 74).
  await sql`DELETE FROM questions_modules WHERE module_id = ${id}`;
  // Ses actions d'amélioration n'ont plus de fiche où se lire (question 78).
  await sql`DELETE FROM actions_formation WHERE module_id = ${id}`;
  return { ok: true };
}

/** Un module déposé lu comme un module du modèle de contenu (sans ses questions). */
export function versModule(l: LigneModuleDepose): Module {
  const critere = l.critere_id ? getCritere(l.critere_id) : undefined;
  const { filieres, niveaux } = profilsEnregistres(l.filieres, l.niveaux);
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
    badge: l.badge || undefined,
  };
}

// ─────────────────────────────────────────── seuils réglés des modules du code

export async function lireReglagesSeuils(): Promise<Record<string, number>> {
  const r = await sql<{ module_id: string; seuil: number | null }>`SELECT module_id, seuil FROM reglages_modules`;
  return Object.fromEntries(r.rows.filter((x) => x.seuil !== null).map((x) => [x.module_id, x.seuil as number]));
}

/**
 * Réglages complets des modules du code (question 36, choix a) : seuil, mais
 * aussi filières, niveaux et parcours quand ils s'écartent de la fiche.
 */
export async function lireReglagesModules(): Promise<Record<string, ReglageModule>> {
  const r = await sql<{
    module_id: string;
    seuil: number | null;
    filieres: unknown;
    niveaux: unknown;
    parcours: unknown;
  }>`SELECT module_id, seuil, filieres, niveaux, parcours FROM reglages_modules`;
  // Relu contre le même référentiel que celui de l'enregistrement, dépôts compris.
  const connus = await identifiantsConnus();
  const out: Record<string, ReglageModule> = {};
  for (const x of r.rows) {
    out[x.module_id] = {
      seuil: x.seuil,
      filieres: listeConnue(x.filieres, connus.filieres),
      niveaux: niveauxConnus(x.niveaux, connus.niveaux),
      parcours: parcoursConnus(x.parcours),
    };
  }
  return out;
}

/**
 * Réglage d'un module du code. Un réglage vide est supprimé : le module
 * revient à ce que dit la fiche d'habilitation.
 */
export async function enregistrerReglageModule(
  moduleId: string,
  reglage: ReglageModule,
  acteur: { role: Role; libelle: string },
): Promise<void> {
  if (reglageVide(reglage)) {
    await sql`DELETE FROM reglages_modules WHERE module_id = ${moduleId}`;
    return;
  }
  const par = `${acteur.role} · ${acteur.libelle}`;
  const json = (v: string[] | null | undefined) => (v && v.length > 0 ? JSON.stringify(v) : null);
  await sql`
    INSERT INTO reglages_modules (module_id, seuil, filieres, niveaux, parcours, modifie_par)
    VALUES (${moduleId}, ${reglage.seuil ?? null}, ${json(reglage.filieres)}, ${json(reglage.niveaux)}, ${json(reglage.parcours)}, ${par})
    ON CONFLICT (module_id) DO UPDATE SET
      seuil = EXCLUDED.seuil,
      filieres = EXCLUDED.filieres,
      niveaux = EXCLUDED.niveaux,
      parcours = EXCLUDED.parcours,
      modifie_par = EXCLUDED.modifie_par,
      modifie_le = NOW()`;
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
