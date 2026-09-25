import "server-only";
import { requete, sql } from "./db";
import { SEUILS_STAT, type ActionFormation, type ItemTentative, type LegendeTentative, type Tentative } from "./statistiques";

/**
 * Lecture des essais pour les statistiques de réussite (question 78, choix a,
 * 25/09/2026) ; les calculs sont dans `lib/statistiques.ts`.
 *
 * Un essai, c'est :
 *  - toute évaluation conservée d'un agent rattaché (`progression`), réussie
 *    ou non, émise en rapport ou non — sauf si son seul rapport a été annulé :
 *    le pharmacien l'a alors écartée ;
 *  - tout rapport émis (non annulé) dont l'évaluation n'est pas conservée —
 *    l'agent l'a émis sous son identifiant sans s'être rattaché.
 * Une évaluation émise en rapport ne compte qu'une fois : l'horodatage scellé
 * de son résultat les relie.
 */
const ESSAIS = `WITH conservees AS (
    SELECT 'p' || p.id AS cle, p.agent_id, p.module_id, p.cree_le AS le, p.resultat
    FROM progression p
    WHERE p.nature = 'evaluation' AND jsonb_typeof(p.resultat) = 'object'
      AND ($1::text[] IS NULL OR p.module_id = ANY($1))
      AND NOT (
        EXISTS (SELECT 1 FROM rapports r WHERE r.agent_id = p.agent_id AND r.statut = 'annule'
                AND r.resultat->>'horodatageIso' = p.resultat->>'horodatageIso')
        AND NOT EXISTS (SELECT 1 FROM rapports r WHERE r.agent_id = p.agent_id AND r.statut <> 'annule'
                AND r.resultat->>'horodatageIso' = p.resultat->>'horodatageIso'))
  ), emis AS (
    SELECT DISTINCT ON (r.agent_id, r.resultat->>'horodatageIso')
      'r' || r.id AS cle, r.agent_id, r.module_id, r.emis_le AS le, r.resultat
    FROM rapports r
    WHERE r.statut <> 'annule' AND ($1::text[] IS NULL OR r.module_id = ANY($1))
      AND NOT EXISTS (SELECT 1 FROM progression p WHERE p.nature = 'evaluation' AND p.agent_id = r.agent_id
                      AND p.resultat->>'horodatageIso' = r.resultat->>'horodatageIso')
    ORDER BY r.agent_id, r.resultat->>'horodatageIso', r.emis_le
  ), essais AS (
    SELECT * FROM conservees UNION ALL SELECT * FROM emis
  )`;

interface LigneEssai {
  cle: string;
  agent_id: number;
  module_id: string;
  le: Date;
  titre: string;
  score: number;
  seuil: number;
  eliminatoire: boolean;
  niveau_cible: string | null;
  detail?: unknown;
}

const chaines = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

function legendes(v: unknown): LegendeTentative[] | undefined {
  if (!Array.isArray(v)) return undefined;
  return v
    .filter((l): l is Record<string, unknown> => typeof l === "object" && l !== null)
    .map((l) => ({
      numero: Number(l.numero) || 0,
      attendu: typeof l.attendu === "string" ? l.attendu : "",
      verdict: l.verdict === "juste" || l.verdict === "fausse" ? l.verdict : "vide",
    }));
}

/** Un élément du détail scellé, réduit à ce que lisent les statistiques. */
function versItem(d: unknown): ItemTentative | null {
  if (typeof d !== "object" || d === null) return null;
  const x = d as Record<string, unknown>;
  if (typeof x.questionId !== "string") return null;
  return {
    questionId: x.questionId,
    enonce: typeof x.enonce === "string" ? x.enonce : "",
    type: typeof x.type === "string" ? x.type : "",
    correct: x.correct === true,
    note: Number(x.note) || 0,
    max: typeof x.max === "number" && x.max > 0 ? x.max : 1,
    nonJugees: Number(x.nonJugees) || 0,
    choix: chaines(x.choixApprenant),
    attendus: chaines(x.reponsesAttendues),
    ...(Array.isArray(x.propositions) ? { propositions: chaines(x.propositions) } : {}),
    ...(Array.isArray(x.sansJugement) ? { sansJugement: chaines(x.sansJugement) } : {}),
    ...(Array.isArray(x.legendes) ? { legendes: legendes(x.legendes) } : {}),
    sources: chaines(x.sources),
  };
}

/**
 * Les essais des modules demandés (`null` : tous). `details` charge aussi le
 * détail des questions — pour la fiche d'un module, jamais pour le classement,
 * qui n'en a pas besoin.
 */
export async function lireEssais(modules: string[] | null, { details = false } = {}): Promise<Tentative[]> {
  const r = await requete<LigneEssai>(
    `${ESSAIS}
     SELECT cle, agent_id, module_id, le,
       COALESCE(resultat->>'moduleTitre', module_id) AS titre,
       ROUND(COALESCE((resultat->>'score')::numeric, 0))::int AS score,
       COALESCE((resultat->>'seuilReussite')::int, 80) AS seuil,
       COALESCE((resultat->>'echecEliminatoire')::boolean, FALSE) AS eliminatoire,
       resultat->'cible'->>'niveau' AS niveau_cible
       ${details ? ", resultat->'detail' AS detail" : ""}
     FROM essais`,
    [modules],
  );
  return r.rows.map((l) => ({
    cle: l.cle,
    agent: l.agent_id,
    moduleId: l.module_id,
    moduleTitre: l.titre,
    le: new Date(l.le).toISOString(),
    score: l.score,
    seuil: l.seuil,
    echecEliminatoire: l.eliminatoire,
    niveauCible: l.niveau_cible,
    ...(details
      ? { items: (Array.isArray(l.detail) ? l.detail : []).map(versItem).filter((i): i is ItemTentative => i !== null) }
      : {}),
  }));
}

export interface RepereBanque {
  question_id: string;
  n: number;
  /** Agents distincts : aucun taux sous l'effectif, même sur cinq essais d'un seul agent. */
  agents: number;
  justes: number;
  /** Indice de discrimination (corrélation point-bisériale corrigée) ; `null` sous l'effectif ou sans variance. */
  r: number | null;
}

/**
 * Réussite et discrimination de chaque question, tous modules confondus,
 * calculées dans la base : la banque les affiche sans charger le détail de
 * tous les essais. Même définition que `analyserQuestions` : la réussite de
 * la question contre le score de l'essai sans elle.
 */
export async function reperesBanque(): Promise<Map<string, RepereBanque>> {
  const r = await requete<{ question_id: string; n: number; agents: number; justes: number; r: number | null }>(
    `${ESSAIS}, items AS (
       SELECT e.cle, e.agent_id, x->>'questionId' AS question_id,
         CASE WHEN (x->>'correct')::boolean THEN 1.0 ELSE 0.0 END::float8 AS juste,
         COALESCE((x->>'note')::numeric, 0) AS note,
         COALESCE((x->>'max')::numeric, 1) AS max
       FROM essais e,
         LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(e.resultat->'detail') = 'array'
                                          THEN e.resultat->'detail' ELSE '[]'::jsonb END) x
     ), totaux AS (
       SELECT items.*, SUM(note) OVER (PARTITION BY cle) AS obtenus, SUM(max) OVER (PARTITION BY cle) AS total
       FROM items
     )
     SELECT question_id, COUNT(*)::int AS n, COUNT(DISTINCT agent_id)::int AS agents, SUM(juste)::int AS justes,
       CASE WHEN COUNT(*) >= $2 AND COUNT(DISTINCT agent_id) >= $2 THEN
         corr(juste, CASE WHEN total - max > 0 THEN ((obtenus - note) / (total - max))::float8 END)
       END AS r
     FROM totaux WHERE question_id IS NOT NULL GROUP BY question_id`,
    [null, SEUILS_STAT.effectif],
  );
  return new Map(
    r.rows.map((l) => [l.question_id, { ...l, r: l.r === null ? null : Math.round(Number(l.r) * 100) / 100 }]),
  );
}

// ───────────────────────────────────────────────── actions d'amélioration

interface LigneAction {
  id: number;
  module_id: string;
  faite_le: string;
  description: string;
  auteur: string;
}

const versAction = (l: LigneAction): ActionFormation => ({
  id: l.id,
  moduleId: l.module_id,
  le: l.faite_le,
  description: l.description,
  auteur: l.auteur,
});

export async function actionsDuModule(moduleId: string): Promise<ActionFormation[]> {
  const r = await sql<LigneAction>`
    SELECT id, module_id, faite_le::text AS faite_le, description, auteur
    FROM actions_formation WHERE module_id = ${moduleId} ORDER BY faite_le, id`;
  return r.rows.map(versAction);
}

export async function ajouterAction(a: { moduleId: string; le: string; description: string; auteur: string }): Promise<number> {
  const r = await sql<{ id: number }>`
    INSERT INTO actions_formation (module_id, faite_le, description, auteur)
    VALUES (${a.moduleId}, ${a.le}::date, ${a.description}, ${a.auteur}) RETURNING id`;
  return r.rows[0].id;
}

/** Suppression d'une action saisie par erreur ; `null` si elle n'existe pas. */
export async function supprimerAction(id: number): Promise<ActionFormation | null> {
  const r = await sql<LigneAction>`
    DELETE FROM actions_formation WHERE id = ${id}
    RETURNING id, module_id, faite_le::text AS faite_le, description, auteur`;
  return r.rows[0] ? versAction(r.rows[0]) : null;
}
