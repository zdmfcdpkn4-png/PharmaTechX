import "server-only";
import { requete } from "./db";
import type { StatutRapport } from "./rapports";
import type { Verdict } from "./decision";
import type { AncienneteQuiz, BilanCritere, ComptageQuestion, PointMois } from "./pilotage";

/**
 * Requêtes du tableau de bord de pilotage. Chacune agrège **dans la base** :
 * un rapport porte son résultat scellé en JSONB, détail des questions compris,
 * et les charger tous pour compter en mémoire coûterait quelques dizaines de
 * méga-octets à chaque affichage de la page.
 *
 * Le verdict retenu est celui de `verdictFinal` (`lib/decision.ts`) transcrit
 * en SQL : l'arbitrage du tuteur ne s'applique qu'à un verdict brut
 * indéterminé. La règle est écrite une seule fois, ci-dessous.
 */

const VERDICT_RETENU = `CASE
  WHEN r.resultat->>'verdict' = 'indetermine' AND r.arbitrage IS NOT NULL THEN r.arbitrage->>'verdict'
  ELSE r.resultat->>'verdict' END`;

export interface FiltrePilotage {
  /** Modules retenus ; `null` = tous. Résolu depuis filière et niveau par la page. */
  modules: string[] | null;
  /** Critères retenus ; `null` = tous. Résolu depuis le bloc de compétence. */
  criteres: string[] | null;
  /** Rapports émis à partir de cette date ; `null` = depuis toujours. */
  depuis: string | null;
}

export const SANS_FILTRE: FiltrePilotage = { modules: null, criteres: null, depuis: null };

/** `WHERE` commun : rapports non annulés, dans le périmètre demandé. */
const OU = `r.statut <> 'annule'
  AND ($1::text[] IS NULL OR r.module_id = ANY($1))
  AND ($2::text[] IS NULL OR r.critere_id = ANY($2))
  AND ($3::timestamptz IS NULL OR r.emis_le >= $3)`;

const valeurs = (f: FiltrePilotage) => [f.modules, f.criteres, f.depuis];

export interface ComptesPilotage {
  n: number;
  acquis: number;
  non_acquis: number;
  indetermine: number;
  non_concluant: number;
  score_moyen: number | null;
  clos: number;
  annules: number;
  agents: number;
}

export async function comptesPilotage(f: FiltrePilotage): Promise<ComptesPilotage> {
  const r = await requete<{
    n: number; acquis: number; non_acquis: number; indetermine: number; non_concluant: number;
    score_moyen: string | null; clos: number; agents: number;
  }>(
    `SELECT COUNT(*)::int AS n,
       COUNT(*) FILTER (WHERE ${VERDICT_RETENU} = 'acquis')::int        AS acquis,
       COUNT(*) FILTER (WHERE ${VERDICT_RETENU} = 'non_acquis')::int    AS non_acquis,
       COUNT(*) FILTER (WHERE ${VERDICT_RETENU} = 'indetermine')::int   AS indetermine,
       COUNT(*) FILTER (WHERE ${VERDICT_RETENU} = 'non_concluant')::int AS non_concluant,
       AVG((r.resultat->>'score')::numeric)                             AS score_moyen,
       COUNT(*) FILTER (WHERE r.statut = 'clos')::int                   AS clos,
       COUNT(DISTINCT r.agent_id)::int                                  AS agents
     FROM rapports r WHERE ${OU}`,
    valeurs(f),
  );
  const a = await requete<{ annules: number }>(
    `SELECT COUNT(*)::int AS annules FROM rapports r
     WHERE r.statut = 'annule'
       AND ($1::text[] IS NULL OR r.module_id = ANY($1))
       AND ($2::text[] IS NULL OR r.critere_id = ANY($2))
       AND ($3::timestamptz IS NULL OR r.emis_le >= $3)`,
    valeurs(f),
  );
  const l = r.rows[0];
  return {
    n: l.n, acquis: l.acquis, non_acquis: l.non_acquis, indetermine: l.indetermine,
    non_concluant: l.non_concluant, clos: l.clos, agents: l.agents,
    score_moyen: l.score_moyen === null ? null : Math.round(Number(l.score_moyen)),
    annules: a.rows[0].annules,
  };
}

/** Un bilan par critère (à défaut, par module), tel qu'il se lit sur la fiche d'habilitation. */
export async function bilanParCritere(f: FiltrePilotage): Promise<BilanCritere[]> {
  const r = await requete<{
    cle: string; libelle: string; critere_id: string | null; module_id: string; n: number;
    acquis: number; non_acquis: number; indetermine: number; non_concluant: number; score_moyen: string | null;
  }>(
    `SELECT COALESCE(r.critere_id, r.module_id) AS cle,
       MIN(r.module_titre) AS libelle,
       MAX(r.critere_id) AS critere_id,
       MIN(r.module_id) AS module_id,
       COUNT(*)::int AS n,
       COUNT(*) FILTER (WHERE ${VERDICT_RETENU} = 'acquis')::int        AS acquis,
       COUNT(*) FILTER (WHERE ${VERDICT_RETENU} = 'non_acquis')::int    AS non_acquis,
       COUNT(*) FILTER (WHERE ${VERDICT_RETENU} = 'indetermine')::int   AS indetermine,
       COUNT(*) FILTER (WHERE ${VERDICT_RETENU} = 'non_concluant')::int AS non_concluant,
       AVG((r.resultat->>'score')::numeric) AS score_moyen
     FROM rapports r WHERE ${OU}
     GROUP BY 1`,
    valeurs(f),
  );
  return r.rows.map((l) => ({
    ...l,
    score_moyen: l.score_moyen === null ? null : Math.round(Number(l.score_moyen)),
  }));
}

export async function serieMensuelle(f: FiltrePilotage): Promise<PointMois[]> {
  const r = await requete<{ mois: string; n: number; acquis: number; score_moyen: string | null }>(
    `SELECT to_char(r.emis_le, 'YYYY-MM') AS mois,
       COUNT(*)::int AS n,
       COUNT(*) FILTER (WHERE ${VERDICT_RETENU} = 'acquis')::int AS acquis,
       AVG((r.resultat->>'score')::numeric) AS score_moyen
     FROM rapports r WHERE ${OU}
     GROUP BY 1 ORDER BY 1`,
    valeurs(f),
  );
  return r.rows.map((l) => ({
    mois: l.mois, n: l.n, acquis: l.acquis,
    score_moyen: l.score_moyen === null ? null : Math.round(Number(l.score_moyen)),
  }));
}

export async function scoresPilotage(f: FiltrePilotage): Promise<number[]> {
  const r = await requete<{ score: number }>(
    `SELECT (r.resultat->>'score')::int AS score FROM rapports r WHERE ${OU}`,
    valeurs(f),
  );
  return r.rows.map((l) => l.score);
}

export interface QuestionManquee extends ComptageQuestion {
  enonce: string;
  module_id: string | null;
  statut: string | null;
}

/**
 * Taux de réussite par question, tiré du détail scellé des rapports. Une
 * question retirée de la banque reste comptée : elle a bien été posée, et
 * c'est le passé qu'on lit ici.
 */
export async function questionsManquees(f: FiltrePilotage): Promise<QuestionManquee[]> {
  const r = await requete<{
    question_id: string; posees: number; reussies: number; enonce: string | null;
    module_id: string | null; statut: string | null;
  }>(
    `WITH detail AS (
       SELECT d->>'questionId' AS question_id,
              (d->>'correct')::boolean AS correct,
              COALESCE(d->>'enonce', '') AS enonce
       FROM rapports r, LATERAL jsonb_array_elements(r.resultat->'detail') d
       WHERE ${OU}
     )
     SELECT x.question_id,
            COUNT(*)::int AS posees,
            COUNT(*) FILTER (WHERE x.correct)::int AS reussies,
            MIN(x.enonce) AS enonce,
            MAX(q.module_id) AS module_id,
            MAX(q.statut) AS statut
     FROM detail x LEFT JOIN questions q ON q.id = x.question_id
     GROUP BY x.question_id`,
    valeurs(f),
  );
  return r.rows.map((l) => ({ ...l, enonce: l.enonce ?? "" }));
}

export interface RapportEnAttente {
  id: string;
  numero: string;
  /** Pour ouvrir le module depuis la ligne (tâche 69). */
  module_id: string;
  module_titre: string;
  agent_identifiant: string;
  emis_le: string;
  statut: StatutRapport;
  verdict_brut: Verdict;
  arbitre: boolean;
  /** Un signalement ouvert sur une question du tirage verrouille visas et arbitrage. */
  verrouille: boolean;
}

export async function rapportsEnAttente(f: FiltrePilotage): Promise<RapportEnAttente[]> {
  const r = await requete<RapportEnAttente>(
    `SELECT r.id, r.numero, r.module_id, r.module_titre, r.agent_identifiant, r.emis_le::text, r.statut,
       (r.resultat->>'verdict') AS verdict_brut,
       (r.arbitrage IS NOT NULL) AS arbitre,
       EXISTS (
         SELECT 1 FROM signalements s
         WHERE s.statut = 'ouvert'
           AND s.question_id IN (SELECT d->>'questionId' FROM jsonb_array_elements(r.resultat->'detail') d)
       ) AS verrouille
     FROM rapports r
     WHERE ${OU} AND r.statut IN ('emis','vise_tuteur')
     ORDER BY r.emis_le`,
    valeurs(f),
  );
  return r.rows;
}

/** Agents en répertoire : actifs et clos. Indépendant du filtre, c'est l'effectif. */
export async function effectifAgents(): Promise<{ actifs: number; total: number }> {
  const r = await requete<{ actifs: number; total: number }>(
    `SELECT COUNT(*) FILTER (WHERE actif)::int AS actifs, COUNT(*)::int AS total FROM agents`,
  );
  return r.rows[0] ?? { actifs: 0, total: 0 };
}

/**
 * Dernier quiz **validé** (rapport clos) de chaque agent sur chaque module,
 * et son ancienneté en mois calendaires.
 *
 * Seuls les rapports clos comptent : un rapport émis mais non visé n'est pas
 * une validation. L'âge se calcule avec `AGE()`, donc en mois de calendrier
 * et non en tranches de trente jours.
 */
export async function anciennetesQuiz(f: FiltrePilotage): Promise<AncienneteQuiz[]> {
  const r = await requete<AncienneteQuiz>(
    `SELECT r.agent_identifiant, r.module_id, r.module_titre, r.critere_id,
       MAX(r.emis_le)::text AS dernier_le,
       (EXTRACT(YEAR FROM AGE(NOW(), MAX(r.emis_le))) * 12
        + EXTRACT(MONTH FROM AGE(NOW(), MAX(r.emis_le))))::int AS mois
     FROM rapports r
     WHERE r.statut = 'clos'
       AND ($1::text[] IS NULL OR r.module_id = ANY($1))
       AND ($2::text[] IS NULL OR r.critere_id = ANY($2))
       AND ($3::timestamptz IS NULL OR r.emis_le >= $3)
     GROUP BY r.agent_identifiant, r.module_id, r.module_titre, r.critere_id
     ORDER BY MAX(r.emis_le)`,
    valeurs(f),
  );
  return r.rows;
}
