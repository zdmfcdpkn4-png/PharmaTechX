import "server-only";
import { randomBytes } from "node:crypto";
import type { PoolClient, QueryResultRow } from "pg";
import { requete, sql, sqlSur, transaction, type Role } from "./db";
import { formaterNumeroRapport } from "./schema";
import { decider, verdictFinal, type Decision, type Verdict } from "./decision";
import type { ResultatEvaluation } from "@/app/api/evaluation/route";

/**
 * Rapports d'évaluation enregistrés — actifs seulement quand
 * `CONSERVATION_RAPPORTS=nominative` (voir `lib/config.ts`).
 *
 * Un rapport est émis par l'apprenant à partir d'un résultat scellé par le
 * serveur ; il reçoit un numéro, une empreinte, et entre dans le circuit de
 * visas. Son contenu ne change plus : une correction passe par l'annulation
 * (motivée) et une nouvelle émission.
 *
 * Décision (modèle de la console métrologique, `lib/decision.ts`) :
 *   - le verdict brut se recalcule à la lecture, à partir du résultat scellé
 *     et des questions exclues ;
 *   - une question retirée de la banque après signalement est exclue du
 *     calcul ; les exclusions sont fixées au premier acte de décision
 *     (arbitrage ou visa du tuteur) et ne bougent plus ensuite ;
 *   - un verdict indéterminé est tranché par un arbitrage explicite et
 *     motivé du tuteur, conservé à côté du verdict brut ;
 *   - un signalement ouvert sur une question du tirage verrouille les visas.
 */

export type StatutRapport = "emis" | "vise_tuteur" | "clos" | "annule";
export type QualiteVisaBase = "apprenant" | "tuteur" | "pharmacien";

export interface ArbitrageRapport {
  verdict: "acquis" | "non_acquis";
  motif: string;
  nom: string;
  role_session: string;
  libelle_session: string;
  /** ISO 8601. */
  le: string;
  /** Score et verdict brut au moment de l'arbitrage, après exclusions. */
  score: number;
  verdictBrut: Verdict;
}

export interface ExclusionQuestion {
  questionId: string;
  motif: string;
  /** ISO 8601. */
  le: string;
}

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
  arbitrage: ArbitrageRapport | null;
  /** NULL tant que les exclusions ne sont pas fixées. */
  exclusions: ExclusionQuestion[] | null;
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
  /** Image de signature incrustée (visa du pharmacien). */
  signature_id: string | null;
}

export interface RapportComplet extends LigneRapport {
  visas: LigneVisa[];
}

export interface SignalementOuvert {
  question_id: string;
  motif: string;
  cree_le: string;
}

/** Décision d'un rapport, telle qu'elle se lit et s'imprime. */
export interface DecisionRapport {
  decision: Decision;
  verdictFinal: Verdict;
  arbitrage: ArbitrageRapport | null;
  exclusions: ExclusionQuestion[];
  /** `false` : les exclusions affichées sont calculées à l'instant, pas encore fixées. */
  exclusionsFixees: boolean;
  signalementsOuverts: SignalementOuvert[];
  /** Un arbitrage est attendu avant le visa du tuteur. */
  arbitrageRequis: boolean;
}

export const LIBELLES_STATUT_RAPPORT: Record<StatutRapport, string> = {
  emis: "Émis — en attente du visa du tuteur",
  vise_tuteur: "Visé par le tuteur — en attente du pharmacien",
  clos: "Clos — visé par le pharmacien responsable",
  annule: "Annulé",
};

const COLONNES_RAPPORT = `id, numero, module_id, module_titre, critere_id, apprenant_nom, apprenant_qualite,
  tirage, resultat, empreinte, statut, emis_le::text, annule_motif, annule_le::text, arbitrage, exclusions`;

const COLONNES_VISA = `id, rapport_id, qualite, nom, role_session, libelle_session, commentaire, empreinte,
  signe_le::text, signature_id`;

/** Requête en texte clair (`$1`…), hors transaction ou sur un client de transaction. */
type Requeteur = <T extends QueryResultRow = QueryResultRow>(
  texte: string,
  valeurs?: unknown[],
) => Promise<{ rows: T[]; rowCount: number }>;

const direct: Requeteur = (texte, valeurs = []) => requete(texte, valeurs);

function sur(client: PoolClient): Requeteur {
  return async (texte, valeurs = []) => {
    const r = await client.query(texte, valeurs);
    return { rows: r.rows, rowCount: r.rowCount ?? 0 };
  };
}

// ──────────────────────────────────────────────────────────────── émission

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

// ───────────────────────────────────────────────────────────────── lecture

export async function listerRapports(filtre: { statut?: StatutRapport } = {}): Promise<LigneRapport[]> {
  const statut = filtre.statut ?? null;
  const r = await direct<LigneRapport>(
    `SELECT ${COLONNES_RAPPORT} FROM rapports
     WHERE ($1::text IS NULL OR statut = $1) ORDER BY emis_le DESC LIMIT 300`,
    [statut],
  );
  return r.rows;
}

export async function lireRapport(id: string): Promise<RapportComplet | null> {
  const r = await direct<LigneRapport>(`SELECT ${COLONNES_RAPPORT} FROM rapports WHERE id = $1`, [id]);
  const ligne = r.rows[0];
  if (!ligne) return null;
  const v = await direct<LigneVisa>(
    `SELECT ${COLONNES_VISA} FROM visas WHERE rapport_id = $1 ORDER BY signe_le`,
    [id],
  );
  return { ...ligne, visas: v.rows };
}

/** Tous les rapports avec leurs visas, du plus récent au plus ancien — registre. */
export async function listerRapportsComplets(): Promise<RapportComplet[]> {
  const r = await direct<LigneRapport>(`SELECT ${COLONNES_RAPPORT} FROM rapports ORDER BY emis_le DESC`);
  if (r.rows.length === 0) return [];
  const v = await direct<LigneVisa>(`SELECT ${COLONNES_VISA} FROM visas ORDER BY signe_le`);
  const parRapport = new Map<string, LigneVisa[]>();
  for (const visa of v.rows) {
    const liste = parRapport.get(visa.rapport_id) ?? [];
    liste.push(visa);
    parRapport.set(visa.rapport_id, liste);
  }
  return r.rows.map((l) => ({ ...l, visas: parRapport.get(l.id) ?? [] }));
}

export async function comptesRapports(): Promise<Record<StatutRapport, number>> {
  const r = await sql<{ statut: StatutRapport; n: number }>`
    SELECT statut, COUNT(*)::int AS n FROM rapports GROUP BY statut`;
  const out: Record<StatutRapport, number> = { emis: 0, vise_tuteur: 0, clos: 0, annule: 0 };
  for (const l of r.rows) out[l.statut] = l.n;
  return out;
}

// ──────────────────────────────────────────────────────────────── décision

function idsDuTirage(r: LigneRapport): string[] {
  return r.resultat.detail.map((d) => d.questionId);
}

async function questionsRetireesParmi(q: Requeteur, ids: string[]): Promise<string[]> {
  if (ids.length === 0) return [];
  const r = await q<{ id: string }>(
    `SELECT id FROM questions WHERE statut = 'retire' AND id = ANY($1::text[])`,
    [ids],
  );
  return r.rows.map((l) => l.id);
}

async function signalementsOuvertsParmi(q: Requeteur, ids: string[]): Promise<SignalementOuvert[]> {
  if (ids.length === 0) return [];
  const r = await q<SignalementOuvert>(
    `SELECT question_id, motif, cree_le::text FROM signalements
     WHERE statut = 'ouvert' AND question_id = ANY($1::text[]) ORDER BY cree_le`,
    [ids],
  );
  return r.rows;
}

/** Exclusions fixées si elles le sont, sinon celles qui le seraient à l'instant. */
async function exclusionsDe(
  q: Requeteur,
  r: LigneRapport,
): Promise<{ liste: ExclusionQuestion[]; fixees: boolean }> {
  if (r.exclusions) return { liste: r.exclusions, fixees: true };
  const retirees = await questionsRetireesParmi(q, idsDuTirage(r));
  const le = new Date().toISOString();
  return {
    liste: retirees.map((questionId) => ({
      questionId,
      motif: "question retirée de la banque après signalement",
      le,
    })),
    fixees: false,
  };
}

/** Décision d'un rapport à partir de son résultat scellé et d'exclusions données. */
export function decisionDe(
  r: Pick<LigneRapport, "resultat" | "arbitrage">,
  exclusions: ExclusionQuestion[],
): { decision: Decision; verdictFinal: Verdict } {
  const decision = decider(r.resultat.detail, r.resultat.seuilReussite, {
    exclues: exclusions.map((e) => e.questionId),
    minQuestions: r.resultat.minQuestions,
  });
  return { decision, verdictFinal: verdictFinal(decision, r.arbitrage) };
}

/** Décision lisible d'un rapport, avec ce qui verrouille encore ses visas. */
export async function contexteDecision(r: RapportComplet): Promise<DecisionRapport> {
  const { liste, fixees } = await exclusionsDe(direct, r);
  const { decision, verdictFinal: vf } = decisionDe(r, liste);
  const enCours = r.statut === "emis" || r.statut === "vise_tuteur";
  const signalementsOuverts = enCours ? await signalementsOuvertsParmi(direct, idsDuTirage(r)) : [];
  return {
    decision,
    verdictFinal: vf,
    arbitrage: r.arbitrage,
    exclusions: liste,
    exclusionsFixees: fixees,
    signalementsOuverts,
    arbitrageRequis: r.statut === "emis" && decision.verdictBrut === "indetermine" && !r.arbitrage,
  };
}

/** Fixe les exclusions d'un rapport si elles ne le sont pas encore ; rend la liste retenue. */
async function fixerExclusions(q: Requeteur, r: LigneRapport): Promise<ExclusionQuestion[]> {
  const { liste, fixees } = await exclusionsDe(q, r);
  if (!fixees) {
    await q(`UPDATE rapports SET exclusions = $1::jsonb WHERE id = $2`, [JSON.stringify(liste), r.id]);
  }
  return liste;
}

async function verrouiller(q: Requeteur, id: string): Promise<LigneRapport> {
  const r = await q<LigneRapport>(`SELECT ${COLONNES_RAPPORT} FROM rapports WHERE id = $1 FOR UPDATE`, [id]);
  const ligne = r.rows[0];
  if (!ligne || ligne.statut === "annule") throw new Error("rapport-indisponible");
  return ligne;
}

/**
 * Arbitrage du tuteur : ne s'applique qu'à un rapport émis dont le verdict
 * brut, exclusions fixées, est indéterminé. Le verdict brut reste conservé.
 */
export async function arbitrer(
  id: string,
  a: { verdict: "acquis" | "non_acquis"; motif: string; nom: string; roleSession: Role; libelleSession: string },
): Promise<void> {
  await transaction(async (client) => {
    const q = sur(client);
    const r = await verrouiller(q, id);
    if (r.statut !== "emis") throw new Error("rapport-deja-vise");
    if (r.arbitrage) throw new Error("deja-arbitre");
    // Un signalement ouvert peut encore retirer une question du calcul.
    if ((await signalementsOuvertsParmi(q, idsDuTirage(r))).length > 0) throw new Error("signalement-ouvert");
    const exclusions = await fixerExclusions(q, r);
    const { decision } = decisionDe(r, exclusions);
    if (decision.verdictBrut !== "indetermine") throw new Error("arbitrage-inutile");
    const arbitrage: ArbitrageRapport = {
      verdict: a.verdict,
      motif: a.motif,
      nom: a.nom,
      role_session: a.roleSession,
      libelle_session: a.libelleSession,
      le: new Date().toISOString(),
      score: decision.score,
      verdictBrut: decision.verdictBrut,
    };
    await q(`UPDATE rapports SET arbitrage = $1::jsonb WHERE id = $2`, [JSON.stringify(arbitrage), id]);
  });
}

/**
 * Visa du tuteur puis du pharmacien. Chacun est refusé tant qu'un signalement
 * est ouvert sur une question du tirage ; celui du tuteur exige en outre que
 * le verdict soit tranché (arbitrage si indéterminé). Le visa du pharmacien
 * incruste sa signature (`signatureId`) et clôt le rapport.
 */
export async function viser(
  id: string,
  v: {
    qualite: "tuteur" | "pharmacien";
    nom: string;
    commentaire: string;
    roleSession: Role;
    libelleSession: string;
    signatureId?: string | null;
  },
): Promise<void> {
  await transaction(async (client) => {
    const q = sur(client);
    const r = await verrouiller(q, id);
    const attendu: StatutRapport = v.qualite === "tuteur" ? "emis" : "vise_tuteur";
    if (r.statut !== attendu) throw new Error(v.qualite === "tuteur" ? "deja-vise" : "tuteur-d-abord");
    const ouverts = await signalementsOuvertsParmi(q, idsDuTirage(r));
    if (ouverts.length > 0) throw new Error("signalement-ouvert");
    if (v.qualite === "tuteur") {
      const exclusions = await fixerExclusions(q, r);
      const { decision } = decisionDe(r, exclusions);
      if (decision.verdictBrut === "indetermine" && !r.arbitrage) throw new Error("arbitrage-requis");
      if (decision.verdictBrut === "non_concluant") throw new Error("non-concluant");
    }
    await q(
      `INSERT INTO visas (rapport_id, qualite, nom, role_session, libelle_session, commentaire, empreinte, signature_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        id,
        v.qualite,
        v.nom,
        v.roleSession,
        v.libelleSession,
        v.commentaire,
        r.empreinte,
        v.qualite === "pharmacien" ? (v.signatureId ?? null) : null,
      ],
    );
    const statut: StatutRapport = v.qualite === "pharmacien" ? "clos" : "vise_tuteur";
    await q(`UPDATE rapports SET statut = $1 WHERE id = $2`, [statut, id]);
  });
}

export async function annulerRapport(id: string, motif: string): Promise<void> {
  await sql`UPDATE rapports SET statut = 'annule', annule_motif = ${motif}, annule_le = NOW() WHERE id = ${id}`;
}

// ─────────────────────────────────────────────────────── répertoire personnel

export interface LigneRepertoire {
  apprenant_nom: string;
  apprenant_qualite: string;
  critere: string;
  module_titre: string;
  id: string;
  numero: string;
  emis_le: string;
  statut: StatutRapport;
  resultat: ResultatEvaluation;
  arbitrage: ArbitrageRapport | null;
  exclusions: ExclusionQuestion[] | null;
  nb_rapports: number;
  nb_clos: number;
}

/**
 * Une ligne par agent et par critère : le dernier rapport non annulé, avec le
 * nombre de rapports émis et clos. Équivalent de « Parc & historique » de la
 * console métrologique, le parc étant ici le personnel.
 */
export async function repertoirePersonnel(): Promise<LigneRepertoire[]> {
  const r = await direct<LigneRepertoire>(`
    WITH actifs AS (
      SELECT apprenant_nom, apprenant_qualite, COALESCE(critere_id, module_id) AS critere,
             module_titre, id, numero, emis_le, statut, resultat, arbitrage, exclusions,
             COUNT(*) OVER (PARTITION BY apprenant_nom, COALESCE(critere_id, module_id))::int AS nb_rapports,
             SUM(CASE WHEN statut = 'clos' THEN 1 ELSE 0 END)
               OVER (PARTITION BY apprenant_nom, COALESCE(critere_id, module_id))::int AS nb_clos,
             ROW_NUMBER() OVER (PARTITION BY apprenant_nom, COALESCE(critere_id, module_id) ORDER BY emis_le DESC) AS rang
      FROM rapports WHERE statut <> 'annule'
    )
    SELECT apprenant_nom, apprenant_qualite, critere, module_titre, id, numero, emis_le::text, statut,
           resultat, arbitrage, exclusions, nb_rapports, nb_clos
    FROM actifs WHERE rang = 1
    ORDER BY apprenant_nom, critere`);
  return r.rows;
}
