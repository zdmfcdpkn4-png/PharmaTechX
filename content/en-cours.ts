/**
 * Session d'évaluation en cours, conservée en base pour être reprise
 * (transposé de la « session en cours » du Lecteur QIM · QCM) : les
 * identifiants des questions posées, jamais leur contenu, et les réponses
 * saisies. À la reprise, chaque identifiant doit encore exister dans la
 * banque, et c'est la version courante de la question qui est reprise.
 * Module pur, partagé par le navigateur (sauvegarde) et le serveur (contrôle).
 */
export interface EtatEnCours {
  questionIds: string[];
  mode: "evaluation" | "entrainement";
  difficulte: "decouverte" | "habilitation" | "complet";
  /** Libellé du tirage à la reprise (« Habilitation · 10 questions »). */
  libelle: string;
  reponses: Record<string, string[]>;
  /** Jugement par proposition : vrai, faux, ou « nsp » — « je ne sais pas » (question 35). */
  qim: Record<string, Record<string, boolean | "nsp">>;
  legendes: Record<string, Record<string, string>>;
  /** Entraînement : question courante et corrections déjà reçues. */
  indexCourant: number;
  corrections: Record<string, unknown>;
  /** ISO 8601, posé par le navigateur à la sauvegarde. */
  maj: string;
}

/** Taille maximale d'un état sérialisé, en caractères. */
export const TAILLE_MAX_ETAT = 200_000;

function chaines(v: unknown, max: number, longueur = 80): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.length <= longueur).slice(0, max) : [];
}

function objet(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

/** État contrôlé champ par champ ; `null` si la forme n'est pas celle attendue. */
export function normaliserEtatEnCours(brut: unknown): EtatEnCours | null {
  const b = objet(brut);
  const questionIds = chaines(b.questionIds, 200);
  if (questionIds.length === 0) return null;
  const mode = b.mode === "entrainement" ? "entrainement" : b.mode === "evaluation" ? "evaluation" : null;
  const difficulte = b.difficulte === "decouverte" || b.difficulte === "habilitation" || b.difficulte === "complet" ? b.difficulte : null;
  if (!mode || !difficulte) return null;
  const reponses: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(objet(b.reponses))) if (questionIds.includes(k)) reponses[k] = chaines(v, 50);
  const qim: Record<string, Record<string, boolean | "nsp">> = {};
  for (const [k, v] of Object.entries(objet(b.qim))) {
    if (!questionIds.includes(k)) continue;
    const d: Record<string, boolean | "nsp"> = {};
    for (const [o, val] of Object.entries(objet(v))) {
      if (o.length > 80) continue;
      if (typeof val === "boolean" || val === "nsp") d[o] = val;
    }
    qim[k] = d;
  }
  const legendes: Record<string, Record<string, string>> = {};
  for (const [k, v] of Object.entries(objet(b.legendes))) {
    if (!questionIds.includes(k)) continue;
    const d: Record<string, string> = {};
    for (const [l, val] of Object.entries(objet(v))) if (typeof val === "string" && l.length <= 80) d[l] = val.slice(0, 200);
    legendes[k] = d;
  }
  const corrections: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(objet(b.corrections))) if (questionIds.includes(k) && v && typeof v === "object") corrections[k] = v;
  const indexCourant = typeof b.indexCourant === "number" && Number.isInteger(b.indexCourant) ? Math.min(Math.max(0, b.indexCourant), questionIds.length - 1) : 0;
  const maj = typeof b.maj === "string" && !Number.isNaN(Date.parse(b.maj)) ? b.maj : new Date().toISOString();
  const etat: EtatEnCours = {
    questionIds,
    mode,
    difficulte,
    libelle: typeof b.libelle === "string" ? b.libelle.slice(0, 80) : "",
    reponses,
    qim,
    legendes,
    indexCourant,
    corrections,
    maj,
  };
  return JSON.stringify(etat).length <= TAILLE_MAX_ETAT ? etat : null;
}

/** Nombre de questions déjà renseignées dans un état (pour l'annoncer à la reprise). */
export function questionsRenseignees(e: EtatEnCours): number {
  return e.questionIds.filter(
    (id) =>
      (e.reponses[id]?.length ?? 0) > 0 ||
      Object.keys(e.qim[id] ?? {}).length > 0 ||
      Object.values(e.legendes[id] ?? {}).some((v) => v.trim() !== ""),
  ).length;
}
