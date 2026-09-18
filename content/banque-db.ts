import "server-only";
import { randomBytes } from "node:crypto";
import { requete, sql, transaction, sqlSur, type Role } from "@/lib/db";
import type { Legende } from "./schema";
import type {
  MiseEnSituation,
  ModeReponse,
  Question,
  Reference,
  TypeQuestion,
} from "./types";

/**
 * Banque de questions déposée en base par les tuteurs et administrateurs.
 *
 * Elle complète — sans la remplacer — la banque versionnée avec le code
 * (`content/modules/*.ts`). Une question déposée est rattachée à un module,
 * rédigé ou non : c'est ainsi que les 56 emplacements « à rédiger » reçoivent
 * leurs premières questions sans redéploiement.
 *
 * Cycle de vie (repris du Lecteur QIM · QCM) : `a_verifier` à l'import ou à
 * la création, `valide` après relecture par un tuteur ou un administrateur
 * — seul ce statut entre dans les tirages —, `retire` quand la question ne
 * doit plus être posée (l'historique la garde).
 *
 * Ce module est serveur uniquement : les bonnes réponses ne quittent jamais
 * le serveur avant soumission.
 */

export type StatutQuestion = "a_verifier" | "valide" | "retire";

export interface OptionBase {
  id: string;
  texte: string;
  vrai: boolean;
}

export interface LigneQuestion {
  id: string;
  module_id: string;
  situation_id: string | null;
  format: TypeQuestion;
  enonce: string;
  options: OptionBase[];
  legendes: Legende[];
  mode_reponse: ModeReponse;
  image_id: string | null;
  justification: string;
  eliminatoire: boolean;
  refs: Reference[];
  statut: StatutQuestion;
  depot_id: string | null;
  rang: number;
  cree_par: string;
  cree_le: string;
  valide_par: string | null;
  valide_le: string | null;
  edite_le: string;
  version: number;
  image_largeur: number | null;
  image_hauteur: number | null;
  image_alt: string | null;
  situation_titre: string | null;
}

export interface LigneSituation {
  id: string;
  module_id: string;
  titre: string;
  contexte: string;
  cree_le: string;
  edite_le: string;
  nb_questions: number;
}

export interface LigneDepotQuestions {
  id: string;
  nom: string;
  module_id: string;
  nb: number;
  nb_a_verifier: number;
  depose_par: string;
  depose_le: string;
}

/** Ce qu'il faut pour créer ou remplacer une question. */
export interface QuestionAEnregistrer {
  moduleId: string;
  situationId: string | null;
  format: TypeQuestion;
  enonce: string;
  options: OptionBase[];
  legendes: Legende[];
  modeReponse: ModeReponse;
  imageId: string | null;
  justification: string;
  eliminatoire: boolean;
  refs: Reference[];
  statut: StatutQuestion;
  depotId?: string | null;
}

export function nouvelId(prefixe = "q"): string {
  return `${prefixe}-${randomBytes(6).toString("base64url")}`;
}

const COLONNES = `
  q.id, q.module_id, q.situation_id, q.format, q.enonce, q.options, q.legendes,
  q.mode_reponse, q.image_id, q.justification, q.eliminatoire, q.refs, q.statut,
  q.depot_id, q.rang, q.cree_par, q.cree_le::text, q.valide_par, q.valide_le::text,
  q.edite_le::text, q.version,
  i.largeur AS image_largeur, i.hauteur AS image_hauteur, i.alt AS image_alt,
  s.titre AS situation_titre`;

const JOINTURES = `
  FROM questions q
  LEFT JOIN images i ON i.id = q.image_id
  LEFT JOIN situations s ON s.id = q.situation_id`;

/** Conversion d'une ligne en question du modèle de contenu. */
export function versQuestion(l: LigneQuestion): Question {
  const base: Question = {
    id: l.id,
    enonce: l.enonce,
    type: l.format,
    options: l.format === "SCH" ? [] : l.options.map((o) => ({ id: o.id, texte: o.texte })),
    bonnesReponses: l.format === "SCH" ? [] : l.options.filter((o) => o.vrai).map((o) => o.id),
    justification: l.justification,
    eliminatoire: l.eliminatoire,
    references: l.refs,
    origine: "base",
  };
  if (l.format === "SCH") {
    base.legendes = l.legendes;
    base.modeReponse = l.mode_reponse;
    if (l.image_id) {
      base.image = {
        id: l.image_id,
        url: `/api/images/${l.image_id}`,
        largeur: l.image_largeur ?? 0,
        hauteur: l.image_hauteur ?? 0,
        alt: l.image_alt ?? "",
      };
    }
  }
  return base;
}

/** Questions validées d'un module, isolées et par mise en situation. */
export async function questionsValideesDuModule(
  moduleId: string,
): Promise<{ questions: Question[]; misesEnSituation: MiseEnSituation[] }> {
  const r = await requete<LigneQuestion>(
    `SELECT ${COLONNES} ${JOINTURES} WHERE q.module_id = $1 AND q.statut = 'valide'
     ORDER BY q.rang, q.cree_le`,
    [moduleId],
  );
  const isolees: Question[] = [];
  const parSituation = new Map<string, Question[]>();
  for (const l of r.rows) {
    const q = versQuestion(l);
    if (l.situation_id) {
      const liste = parSituation.get(l.situation_id) ?? [];
      liste.push(q);
      parSituation.set(l.situation_id, liste);
    } else {
      isolees.push(q);
    }
  }
  const misesEnSituation: MiseEnSituation[] = [];
  if (parSituation.size > 0) {
    const ids = [...parSituation.keys()];
    const s = await sql<{ id: string; titre: string; contexte: string }>`
      SELECT id, titre, contexte FROM situations WHERE id = ANY(${ids}::text[])`;
    for (const sit of s.rows) {
      misesEnSituation.push({
        id: sit.id,
        titre: sit.titre,
        contexte: sit.contexte,
        questions: parSituation.get(sit.id) ?? [],
      });
    }
  }
  return { questions: isolees, misesEnSituation };
}

/** Nombre de questions validées et à vérifier par module. */
export async function comptesParModule(): Promise<
  Record<string, { valides: number; aVerifier: number }>
> {
  const r = await sql<{ module_id: string; statut: StatutQuestion; n: number }>`
    SELECT module_id, statut, COUNT(*)::int AS n FROM questions
    WHERE statut IN ('valide','a_verifier') GROUP BY module_id, statut`;
  const out: Record<string, { valides: number; aVerifier: number }> = {};
  for (const l of r.rows) {
    const e = (out[l.module_id] ??= { valides: 0, aVerifier: 0 });
    if (l.statut === "valide") e.valides = l.n;
    else e.aVerifier = l.n;
  }
  return out;
}

export async function listerQuestions(filtre: {
  moduleId?: string;
  statut?: StatutQuestion;
} = {}): Promise<LigneQuestion[]> {
  const moduleId = filtre.moduleId ?? null;
  const statut = filtre.statut ?? null;
  const r = await requete<LigneQuestion>(
    `SELECT ${COLONNES} ${JOINTURES}
     WHERE ($1::text IS NULL OR q.module_id = $1)
       AND ($2::text IS NULL OR q.statut = $2)
     ORDER BY q.module_id, q.rang, q.cree_le`,
    [moduleId, statut],
  );
  return r.rows;
}

export async function lireQuestion(id: string): Promise<LigneQuestion | null> {
  const r = await requete<LigneQuestion>(`SELECT ${COLONNES} ${JOINTURES} WHERE q.id = $1`, [id]);
  return r.rows[0] ?? null;
}

export async function enregistrerQuestion(
  q: QuestionAEnregistrer,
  acteur: { role: Role; libelle: string },
  id?: string,
): Promise<string> {
  const ident = id ?? nouvelId();
  const options = JSON.stringify(q.options);
  const legendes = JSON.stringify(q.legendes);
  const refs = JSON.stringify(q.refs);
  const par = `${acteur.role} · ${acteur.libelle}`;
  await sql`
    INSERT INTO questions (id, module_id, situation_id, format, enonce, options, legendes,
      mode_reponse, image_id, justification, eliminatoire, refs, statut, depot_id, cree_par,
      valide_par, valide_le)
    VALUES (${ident}, ${q.moduleId}, ${q.situationId}, ${q.format}, ${q.enonce},
      ${options}::jsonb, ${legendes}::jsonb, ${q.modeReponse}, ${q.imageId},
      ${q.justification}, ${q.eliminatoire}, ${refs}::jsonb, ${q.statut}, ${q.depotId ?? null},
      ${par}, ${q.statut === "valide" ? par : null}, ${q.statut === "valide" ? new Date() : null})
    ON CONFLICT (id) DO UPDATE SET
      module_id = EXCLUDED.module_id,
      situation_id = EXCLUDED.situation_id,
      format = EXCLUDED.format,
      enonce = EXCLUDED.enonce,
      options = EXCLUDED.options,
      legendes = EXCLUDED.legendes,
      mode_reponse = EXCLUDED.mode_reponse,
      image_id = COALESCE(EXCLUDED.image_id, questions.image_id),
      justification = EXCLUDED.justification,
      eliminatoire = EXCLUDED.eliminatoire,
      refs = EXCLUDED.refs,
      statut = EXCLUDED.statut,
      valide_par = CASE WHEN EXCLUDED.statut = 'valide' THEN EXCLUDED.valide_par ELSE NULL END,
      valide_le = CASE WHEN EXCLUDED.statut = 'valide' THEN NOW() ELSE NULL END,
      edite_le = NOW(),
      version = questions.version + 1`;
  return ident;
}

export async function changerStatutQuestion(
  id: string,
  statut: StatutQuestion,
  acteur: { role: Role; libelle: string },
): Promise<void> {
  const par = `${acteur.role} · ${acteur.libelle}`;
  await sql`
    UPDATE questions SET statut = ${statut},
      valide_par = CASE WHEN ${statut} = 'valide' THEN ${par} ELSE valide_par END,
      valide_le = CASE WHEN ${statut} = 'valide' THEN NOW() ELSE valide_le END,
      edite_le = NOW()
    WHERE id = ${id}`;
}

export async function supprimerQuestion(id: string): Promise<void> {
  await sql`DELETE FROM questions WHERE id = ${id}`;
}

export async function detacherImage(id: string): Promise<void> {
  await sql`UPDATE questions SET image_id = NULL, edite_le = NOW() WHERE id = ${id}`;
}

// ───────────────────────────────────────────────────────── mises en situation

export async function listerSituations(moduleId?: string): Promise<LigneSituation[]> {
  const m = moduleId ?? null;
  const r = await sql<LigneSituation>`
    SELECT s.id, s.module_id, s.titre, s.contexte, s.cree_le::text, s.edite_le::text,
           (SELECT COUNT(*)::int FROM questions q WHERE q.situation_id = s.id) AS nb_questions
    FROM situations s
    WHERE (${m}::text IS NULL OR s.module_id = ${m})
    ORDER BY s.module_id, s.cree_le`;
  return r.rows;
}

export async function enregistrerSituation(
  s: { moduleId: string; titre: string; contexte: string },
  id?: string,
): Promise<string> {
  const ident = id ?? nouvelId("mes");
  await sql`
    INSERT INTO situations (id, module_id, titre, contexte)
    VALUES (${ident}, ${s.moduleId}, ${s.titre}, ${s.contexte})
    ON CONFLICT (id) DO UPDATE SET
      module_id = EXCLUDED.module_id, titre = EXCLUDED.titre,
      contexte = EXCLUDED.contexte, edite_le = NOW()`;
  return ident;
}

export async function supprimerSituation(id: string): Promise<void> {
  await sql`DELETE FROM situations WHERE id = ${id}`;
}

// ───────────────────────────────────────────────────────────────── dépôts

export async function enregistrerDepotQuestions(
  d: { nom: string; moduleId: string; nb: number; nbAVerifier: number },
  acteur: { role: Role; libelle: string },
): Promise<string> {
  const id = nouvelId("dep");
  await sql`
    INSERT INTO depots_questions (id, nom, module_id, nb, nb_a_verifier, depose_par)
    VALUES (${id}, ${d.nom}, ${d.moduleId}, ${d.nb}, ${d.nbAVerifier}, ${`${acteur.role} · ${acteur.libelle}`})`;
  return id;
}

export async function listerDepotsQuestions(): Promise<LigneDepotQuestions[]> {
  const r = await sql<LigneDepotQuestions>`
    SELECT id, nom, module_id, nb, nb_a_verifier, depose_par, depose_le::text
    FROM depots_questions ORDER BY depose_le DESC LIMIT 100`;
  return r.rows;
}

/** Insère d'un bloc les questions d'un dépôt, dans une transaction. */
export async function insererLot(
  questions: QuestionAEnregistrer[],
  acteur: { role: Role; libelle: string },
): Promise<string[]> {
  const par = `${acteur.role} · ${acteur.libelle}`;
  return transaction(async (client) => {
    const s = sqlSur(client);
    const ids: string[] = [];
    let rang = 0;
    for (const q of questions) {
      const id = nouvelId();
      await s`
        INSERT INTO questions (id, module_id, situation_id, format, enonce, options, legendes,
          mode_reponse, image_id, justification, eliminatoire, refs, statut, depot_id, rang, cree_par)
        VALUES (${id}, ${q.moduleId}, ${q.situationId}, ${q.format}, ${q.enonce},
          ${JSON.stringify(q.options)}::jsonb, ${JSON.stringify(q.legendes)}::jsonb,
          ${q.modeReponse}, ${q.imageId}, ${q.justification}, ${q.eliminatoire},
          ${JSON.stringify(q.refs)}::jsonb, ${q.statut}, ${q.depotId ?? null}, ${rang++}, ${par})`;
      ids.push(id);
    }
    return ids;
  });
}

// ─────────────────────────────────────────────────────────── signalements

export interface LigneSignalement {
  id: number;
  question_id: string;
  module_id: string;
  motif: string;
  note: string;
  statut: "ouvert" | "traite" | "rejete";
  cree_le: string;
  traite_par: string | null;
  traite_le: string | null;
  reponse: string | null;
  enonce: string | null;
}

export { MOTIFS_SIGNALEMENT } from "./signalements";

export async function enregistrerSignalement(s: {
  questionId: string;
  moduleId: string;
  motif: string;
  note: string;
}): Promise<void> {
  await sql`
    INSERT INTO signalements (question_id, module_id, motif, note)
    VALUES (${s.questionId}, ${s.moduleId}, ${s.motif}, ${s.note})`;
}

export async function listerSignalements(): Promise<LigneSignalement[]> {
  const r = await sql<LigneSignalement>`
    SELECT s.id, s.question_id, s.module_id, s.motif, s.note, s.statut, s.cree_le::text,
           s.traite_par, s.traite_le::text, s.reponse, q.enonce
    FROM signalements s LEFT JOIN questions q ON q.id = s.question_id
    ORDER BY (s.statut = 'ouvert') DESC, s.cree_le DESC LIMIT 200`;
  return r.rows;
}

export async function traiterSignalement(
  id: number,
  statut: "traite" | "rejete",
  reponse: string,
  acteur: { role: Role; libelle: string },
): Promise<void> {
  await sql`
    UPDATE signalements SET statut = ${statut}, reponse = ${reponse},
      traite_par = ${`${acteur.role} · ${acteur.libelle}`}, traite_le = NOW()
    WHERE id = ${id}`;
}

export async function compterSignalementsOuverts(): Promise<number> {
  const r = await sql<{ n: number }>`SELECT COUNT(*)::int AS n FROM signalements WHERE statut = 'ouvert'`;
  return r.rows[0]?.n ?? 0;
}
