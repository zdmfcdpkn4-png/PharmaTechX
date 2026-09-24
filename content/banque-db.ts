import "server-only";
import { randomBytes } from "node:crypto";
import { requete, sql, transaction, sqlSur, type Role } from "@/lib/db";
import type { Legende } from "./schema";
import { lireBlocs, lireIdentifiants } from "./rattachement-question";
import type { QuestionAuCompte } from "./arbre-banque";
import type {
  MiseEnSituation,
  ModeReponse,
  NiveauQuestion,
  Question,
  Reference,
  TypeQuestion,
} from "./types";

/**
 * Banque de questions déposée en base par les tuteurs et administrateurs.
 *
 * Elle complète — sans la remplacer — la banque versionnée avec le code
 * (`content/modules/*.ts`). Une question déposée est rattachée à un module,
 * rédigé ou non : c'est ainsi que les 51 emplacements « à rédiger » reçoivent
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
  /** Réservée à l'évaluation (question 18) : jamais posée en entraînement. */
  reservee: boolean;
  /** Obligatoire (question 63) : posée à chaque évaluation qui peut conclure. */
  obligatoire: boolean;
  niveau_question: NiveauQuestion | null;
  refs: Reference[];
  statut: StatutQuestion;
  depot_id: string | null;
  rang: number;
  cree_par: string;
  cree_le: string;
  valide_par: string | null;
  valide_le: string | null;
  /** Validée par son auteur courant — l'administration seule le peut (23/09/2026). */
  valide_par_auteur: boolean;
  edite_le: string;
  version: number;
  /** Règle des quatre yeux (question 12) : code créateur et dernier code éditeur. */
  cree_par_acces: number | null;
  edite_par: string | null;
  edite_par_acces: number | null;
  image_largeur: number | null;
  image_hauteur: number | null;
  image_alt: string | null;
  situation_titre: string | null;
  /**
   * Question 74 (choix c, 24/09/2026) : modules où la question est aussi
   * posée, son module d'origine (`module_id`) mis à part — elle entre dans
   * leur tirage et figure sous chacun dans l'arborescence.
   */
  aussi_dans: string[];
  /** Étiquettes de blocs de compétence (classement ; question 74). */
  blocs: number[];
  /** Étiquettes de profil (question 74) : filières et niveaux d'habilitation auxquels le tirage la limite ; vides : aucune limite. */
  profil_filieres: string[];
  profil_niveaux: string[];
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
  /** Module du dépôt s'il n'en sert qu'un ; `null` s'il en sert plusieurs (question 57) — chaque question porte le sien. */
  module_id: string | null;
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
  reservee: boolean;
  obligatoire: boolean;
  niveauQuestion: NiveauQuestion | null;
  refs: Reference[];
  statut: StatutQuestion;
  depotId?: string | null;
  /** Modules où elle est aussi posée (question 74) ; absent : aucun. */
  aussiDans?: string[];
  /** Étiquettes de blocs et de profil (question 74) ; absentes : aucune. */
  blocs?: number[];
  profilFilieres?: string[];
  profilNiveaux?: string[];
}

export function nouvelId(prefixe = "q"): string {
  return `${prefixe}-${randomBytes(6).toString("base64url")}`;
}

const COLONNES = `
  q.id, q.module_id, q.situation_id, q.format, q.enonce, q.options, q.legendes,
  q.mode_reponse, q.image_id, q.justification, q.eliminatoire, q.reservee, q.obligatoire, q.niveau_question, q.refs, q.statut,
  q.depot_id, q.rang, q.cree_par, q.cree_le::text, q.valide_par, q.valide_le::text, q.valide_par_auteur,
  q.edite_le::text, q.version, q.cree_par_acces, q.edite_par, q.edite_par_acces,
  i.largeur AS image_largeur, i.hauteur AS image_hauteur, i.alt AS image_alt,
  s.titre AS situation_titre, q.blocs, q.profil_filieres, q.profil_niveaux,
  COALESCE((SELECT array_agg(qm.module_id ORDER BY qm.module_id) FROM questions_modules qm
            WHERE qm.question_id = q.id AND qm.module_id <> q.module_id), '{}'::text[]) AS aussi_dans`;

/** La question est posée dans le module `$n` : son module d'origine, ou l'un de ceux où elle l'est aussi (question 74). */
const POSEE_DANS = (n: number) =>
  `(q.module_id = $${n} OR EXISTS (SELECT 1 FROM questions_modules qm WHERE qm.question_id = q.id AND qm.module_id = $${n}))`;

const JOINTURES = `
  FROM questions q
  LEFT JOIN images i ON i.id = q.image_id
  LEFT JOIN situations s ON s.id = q.situation_id`;

/** Rattachements et étiquettes relus tels qu'écrits, quoi que la base renvoie (question 74). */
function normaliser(l: LigneQuestion): LigneQuestion {
  return {
    ...l,
    aussi_dans: lireIdentifiants(l.aussi_dans),
    blocs: lireBlocs(l.blocs),
    profil_filieres: lireIdentifiants(l.profil_filieres),
    profil_niveaux: lireIdentifiants(l.profil_niveaux),
  };
}

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
    reservee: l.reservee,
    obligatoire: l.obligatoire,
    niveauQuestion: l.niveau_question ?? null,
    references: l.refs,
    origine: "base",
  };
  // Étiquettes de profil (question 74) : elles limitent le tirage, et partent donc avec la question.
  const filieres = lireIdentifiants(l.profil_filieres);
  const niveaux = lireIdentifiants(l.profil_niveaux);
  if (filieres.length > 0 || niveaux.length > 0) base.profils = { filieres, niveaux };
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
    // Origine d'abord, puis les questions aussi posées ici (question 74), chacune dans son ordre.
    `SELECT ${COLONNES} ${JOINTURES} WHERE ${POSEE_DANS(1)} AND q.statut = 'valide'
     ORDER BY (q.module_id <> $1), q.rang, q.cree_le`,
    [moduleId],
  );
  const isolees: Question[] = [];
  const parSituation = new Map<string, Question[]>();
  for (const l of r.rows.map(normaliser)) {
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

/**
 * Par module : questions validées, à vérifier, et validées réservées à
 * l'évaluation — celles de sa banque, origine et rattachements (question 74) :
 * une question posée dans deux modules compte dans chacun. Pour un total de
 * la banque, `totauxQuestions`, qui la compte une fois.
 */
export async function comptesParModule(): Promise<
  Record<string, { valides: number; aVerifier: number; reservees: number }>
> {
  const r = await sql<{ module_id: string; statut: StatutQuestion; reservee: boolean; n: number }>`
    SELECT m.module_id, q.statut, q.reservee, COUNT(*)::int AS n
    FROM questions q
      CROSS JOIN LATERAL (
        SELECT q.module_id UNION SELECT qm.module_id FROM questions_modules qm WHERE qm.question_id = q.id
      ) m(module_id)
    WHERE q.statut IN ('valide','a_verifier') GROUP BY m.module_id, q.statut, q.reservee`;
  const out: Record<string, { valides: number; aVerifier: number; reservees: number }> = {};
  for (const l of r.rows) {
    const e = (out[l.module_id] ??= { valides: 0, aVerifier: 0, reservees: 0 });
    if (l.statut === "valide") {
      e.valides += l.n;
      if (l.reservee) e.reservees += l.n;
    } else {
      e.aVerifier += l.n;
    }
  }
  return out;
}

/**
 * Chaque question validée ou à vérifier, avec les modules où elle est posée :
 * de quoi cumuler une branche de la banque sans compter deux fois une
 * question posée dans deux de ses modules (question 74, `cumulDistinct`).
 */
export async function questionsAuCompte(): Promise<QuestionAuCompte[]> {
  const r = await sql<{ statut: "valide" | "a_verifier"; reservee: boolean; module_id: string; aussi: string[] | null }>`
    SELECT q.statut, q.reservee, q.module_id,
      (SELECT array_agg(qm.module_id) FROM questions_modules qm WHERE qm.question_id = q.id) AS aussi
    FROM questions q WHERE q.statut IN ('valide','a_verifier')`;
  return r.rows.map((l) => ({ statut: l.statut, reservee: l.reservee, modules: [l.module_id, ...(l.aussi ?? [])] }));
}

/** Questions validées et à vérifier de toute la banque, chacune une fois, quel que soit le nombre de ses modules. */
export async function totauxQuestions(): Promise<{ valides: number; aVerifier: number }> {
  const r = await sql<{ statut: StatutQuestion; n: number }>`
    SELECT statut, COUNT(*)::int AS n FROM questions WHERE statut IN ('valide','a_verifier') GROUP BY statut`;
  return {
    valides: r.rows.find((l) => l.statut === "valide")?.n ?? 0,
    aVerifier: r.rows.find((l) => l.statut === "a_verifier")?.n ?? 0,
  };
}

export async function listerQuestions(filtre: {
  moduleId?: string;
  statut?: StatutQuestion;
} = {}): Promise<LigneQuestion[]> {
  const moduleId = filtre.moduleId ?? null;
  const statut = filtre.statut ?? null;
  const r = await requete<LigneQuestion>(
    `SELECT ${COLONNES} ${JOINTURES}
     WHERE ($1::text IS NULL OR ${POSEE_DANS(1)})
       AND ($2::text IS NULL OR q.statut = $2)
     ORDER BY q.module_id, q.rang, q.cree_le`,
    [moduleId, statut],
  );
  return r.rows.map(normaliser);
}

export async function lireQuestion(id: string): Promise<LigneQuestion | null> {
  const r = await requete<LigneQuestion>(`SELECT ${COLONNES} ${JOINTURES} WHERE q.id = $1`, [id]);
  return r.rows[0] ? normaliser(r.rows[0]) : null;
}

export async function enregistrerQuestion(
  q: QuestionAEnregistrer,
  acteur: { role: Role; libelle: string; acces?: number | null },
  id?: string,
): Promise<string> {
  const ident = id ?? nouvelId();
  const options = JSON.stringify(q.options);
  const legendes = JSON.stringify(q.legendes);
  const refs = JSON.stringify(q.refs);
  const par = `${acteur.role} · ${acteur.libelle}`;
  const acces = acteur.acces ?? null;
  // Étiquettes et rattachements (question 74) : absents de l'enregistrement, ceux en base sont gardés.
  const etiquettes = q.blocs !== undefined || q.profilFilieres !== undefined || q.profilNiveaux !== undefined;
  const blocs = JSON.stringify(q.blocs ?? []);
  const profilFilieres = JSON.stringify(q.profilFilieres ?? []);
  const profilNiveaux = JSON.stringify(q.profilNiveaux ?? []);
  const aussiDans = q.aussiDans?.filter((m) => m !== q.moduleId);
  await transaction(async (client) => {
    const s = sqlSur(client);
    await s`
    INSERT INTO questions (id, module_id, situation_id, format, enonce, options, legendes,
      mode_reponse, image_id, justification, eliminatoire, reservee, obligatoire, niveau_question, refs, statut, depot_id, cree_par,
      valide_par, valide_le, cree_par_acces, edite_par, edite_par_acces, blocs, profil_filieres, profil_niveaux)
    VALUES (${ident}, ${q.moduleId}, ${q.situationId}, ${q.format}, ${q.enonce},
      ${options}::jsonb, ${legendes}::jsonb, ${q.modeReponse}, ${q.imageId},
      ${q.justification}, ${q.eliminatoire}, ${q.reservee}, ${q.obligatoire}, ${q.niveauQuestion}, ${refs}::jsonb, ${q.statut}, ${q.depotId ?? null},
      ${par}, ${q.statut === "valide" ? par : null}, ${q.statut === "valide" ? new Date() : null},
      ${acces}, ${par}, ${acces}, ${blocs}::jsonb, ${profilFilieres}::jsonb, ${profilNiveaux}::jsonb)
    ON CONFLICT (id) DO UPDATE SET
      edite_par = EXCLUDED.edite_par,
      edite_par_acces = EXCLUDED.edite_par_acces,
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
      reservee = EXCLUDED.reservee,
      obligatoire = EXCLUDED.obligatoire,
      niveau_question = EXCLUDED.niveau_question,
      refs = EXCLUDED.refs,
      statut = EXCLUDED.statut,
      valide_par = CASE WHEN EXCLUDED.statut = 'valide' THEN EXCLUDED.valide_par ELSE NULL END,
      valide_le = CASE WHEN EXCLUDED.statut = 'valide' THEN NOW() ELSE NULL END,
      valide_par_auteur = FALSE,
      blocs = CASE WHEN ${etiquettes}::boolean THEN EXCLUDED.blocs ELSE questions.blocs END,
      profil_filieres = CASE WHEN ${etiquettes}::boolean THEN EXCLUDED.profil_filieres ELSE questions.profil_filieres END,
      profil_niveaux = CASE WHEN ${etiquettes}::boolean THEN EXCLUDED.profil_niveaux ELSE questions.profil_niveaux END,
      edite_le = NOW(),
      version = questions.version + 1`;
    if (aussiDans) {
      await s`DELETE FROM questions_modules WHERE question_id = ${ident}`;
      for (const m of new Set(aussiDans)) {
        await s`INSERT INTO questions_modules (question_id, module_id) VALUES (${ident}, ${m}) ON CONFLICT DO NOTHING`;
      }
    }
  });
  return ident;
}

export async function changerStatutQuestion(
  id: string,
  statut: StatutQuestion,
  acteur: { role: Role; libelle: string; acces?: number | null },
  parAuteur = false,
): Promise<void> {
  const par = `${acteur.role} · ${acteur.libelle}`;
  await sql`
    UPDATE questions SET statut = ${statut},
      valide_par = CASE WHEN ${statut} = 'valide' THEN ${par} ELSE valide_par END,
      valide_le = CASE WHEN ${statut} = 'valide' THEN NOW() ELSE valide_le END,
      valide_par_auteur = CASE WHEN ${statut} = 'valide' THEN ${parAuteur} ELSE valide_par_auteur END,
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
  d: { nom: string; moduleId: string | null; nb: number; nbAVerifier: number },
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

/**
 * Textes des questions validées, par module — énoncé et propositions : ce
 * que la proposition de module compare à une question déposée (question 57).
 */
export async function textesValidesParModule(): Promise<Map<string, string[]>> {
  const r = await sql<{ module_id: string; enonce: string; options: OptionBase[] | null }>`
    SELECT module_id, enonce, options FROM questions WHERE statut = 'valide'`;
  const out = new Map<string, string[]>();
  for (const l of r.rows) {
    const textes = out.get(l.module_id) ?? [];
    textes.push(l.enonce, ...(Array.isArray(l.options) ? l.options.map((o) => o.texte) : []));
    out.set(l.module_id, textes);
  }
  return out;
}

/** Insère d'un bloc les questions d'un dépôt, dans une transaction. */
export async function insererLot(
  questions: QuestionAEnregistrer[],
  acteur: { role: Role; libelle: string; acces?: number | null },
): Promise<string[]> {
  const par = `${acteur.role} · ${acteur.libelle}`;
  const acces = acteur.acces ?? null;
  return transaction(async (client) => {
    const s = sqlSur(client);
    const ids: string[] = [];
    let rang = 0;
    for (const q of questions) {
      const id = nouvelId();
      await s`
        INSERT INTO questions (id, module_id, situation_id, format, enonce, options, legendes,
          mode_reponse, image_id, justification, eliminatoire, reservee, obligatoire, niveau_question, refs, statut, depot_id, rang, cree_par,
          cree_par_acces, edite_par, edite_par_acces)
        VALUES (${id}, ${q.moduleId}, ${q.situationId}, ${q.format}, ${q.enonce},
          ${JSON.stringify(q.options)}::jsonb, ${JSON.stringify(q.legendes)}::jsonb,
          ${q.modeReponse}, ${q.imageId}, ${q.justification}, ${q.eliminatoire}, ${q.reservee}, ${q.obligatoire}, ${q.niveauQuestion},
          ${JSON.stringify(q.refs)}::jsonb, ${q.statut}, ${q.depotId ?? null}, ${rang++}, ${par},
          ${acces}, ${par}, ${acces})`;
      ids.push(id);
    }
    return ids;
  });
}

// ─────────────────────────────────────────────────────────── signalements

export interface LigneSignalement {
  id: number;
  /** Question signalée ; vide pour une fiche de synthèse (question 60). */
  question_id: string | null;
  /** Fiche de synthèse signalée (question 60) ; vide pour une question. */
  depot_id: number | null;
  fiche_titre: string | null;
  fiche_url: string | null;
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

/**
 * Signalement d'une fiche de synthèse (question 60, choix a) : même table, la
 * question laissée vide. Les verrous des rapports ne lisent que `question_id`.
 */
export async function enregistrerSignalementFiche(s: {
  depotId: number;
  moduleId: string;
  motif: string;
  note: string;
}): Promise<void> {
  await sql`
    INSERT INTO signalements (question_id, depot_id, module_id, motif, note)
    VALUES (NULL, ${s.depotId}, ${s.moduleId}, ${s.motif}, ${s.note})`;
}

export async function listerSignalements(): Promise<LigneSignalement[]> {
  const r = await sql<LigneSignalement>`
    SELECT s.id, s.question_id, s.depot_id, s.module_id, s.motif, s.note, s.statut, s.cree_le::text,
           s.traite_par, s.traite_le::text, s.reponse, q.enonce,
           d.titre AS fiche_titre, d.url AS fiche_url
    FROM signalements s
      LEFT JOIN questions q ON q.id = s.question_id
      LEFT JOIN depots d ON d.id = s.depot_id
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

/**
 * Signalements ouverts, par question (question 54, choix a + b) : la banque
 * les montre là où la question se corrige, et non plus sur le seul écran des
 * signalements.
 */
export async function signalementsOuvertsParQuestion(): Promise<Record<string, number>> {
  const r = await sql<{ question_id: string; n: number }>`
    SELECT question_id, COUNT(*)::int AS n FROM signalements
    WHERE statut = 'ouvert' AND question_id IS NOT NULL GROUP BY question_id`;
  return Object.fromEntries(r.rows.map((l) => [l.question_id, l.n]));
}

/** Signalements ouverts d'une question, du plus récent au plus ancien. */
export async function signalementsOuvertsDe(questionId: string): Promise<LigneSignalement[]> {
  const r = await sql<LigneSignalement>`
    SELECT s.id, s.question_id, s.depot_id, s.module_id, s.motif, s.note, s.statut, s.cree_le::text,
           s.traite_par, s.traite_le::text, s.reponse, NULL::text AS enonce,
           NULL::text AS fiche_titre, NULL::text AS fiche_url
    FROM signalements s
    WHERE s.question_id = ${questionId} AND s.statut = 'ouvert'
    ORDER BY s.cree_le DESC`;
  return r.rows;
}

/**
 * Questions qu'un signalement écarte du tirage (question 62, choix a), parmi
 * celles données. `ouvertes` : au signalement ouvert — le tirage les écarte.
 * `tolerees` : les mêmes, plus celles dont le signalement a été clos depuis
 * moins de sept jours ; le contrôle du tirage les tient encore pour
 * signalées, pour qu'une clôture survenue pendant l'épreuve, ou avant la
 * reprise d'une évaluation interrompue, ne fasse pas refuser le tirage.
 */
export async function questionsSignalees(ids: string[]): Promise<{ ouvertes: string[]; tolerees: string[] }> {
  if (ids.length === 0) return { ouvertes: [], tolerees: [] };
  const r = await sql<{ question_id: string; ouvert: boolean }>`
    SELECT question_id, bool_or(statut = 'ouvert') AS ouvert FROM signalements
    WHERE question_id = ANY(${ids}::text[])
      AND (statut = 'ouvert' OR traite_le > NOW() - INTERVAL '7 days')
    GROUP BY question_id`;
  return {
    ouvertes: r.rows.filter((l) => l.ouvert).map((l) => l.question_id),
    tolerees: r.rows.map((l) => l.question_id),
  };
}
