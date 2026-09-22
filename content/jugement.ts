/**
 * Schéma à découvrir, jugé par le tuteur (décision du 22/09/2026, question 52,
 * choix b).
 *
 * Le schéma à compléter porte déjà des caches posés par le créateur de la
 * question. En mode « découvrir », à la manière d'Anki, l'apprenant n'écrit
 * rien : il dit ce que cache chaque numéro, le cache se lève, le mot attendu
 * s'affiche, et la réponse est jugée juste ou fausse, cache par cache :
 *   - en **évaluation**, par le tuteur assis à côté de l'apprenant, qui
 *     confirme ses jugements par son propre code au moment de valider ; le
 *     résultat est scellé en une fois, avec la mention du code qui a jugé ;
 *   - en **entraînement**, par l'apprenant lui-même ; rien n'y vaut preuve.
 *
 * Un cache non jugé compte comme une légende vide : la part « sans réponse »
 * du barème du schéma. Se passer du tuteur ne rapporte donc rien — et ne
 * bloque pas non plus l'apprenant, qui peut valider sans lui.
 *
 * Module pur, partagé par le navigateur et le serveur.
 */

export type Jugement = "juste" | "faux";

/** Qui a jugé les caches d'un résultat, tel que le résultat le scelle. */
export interface JugementScelle {
  /** « Tutorat · Tuteur 1 », « Administration · … », ou « auto-évaluation ». */
  par: string;
  role: "tuteur" | "admin" | "apprenant";
  /** ISO 8601, horloge du serveur. */
  le: string;
}

export function estADecouvrir(q: { type: string; modeReponse?: string }): boolean {
  return q.type === "SCH" && q.modeReponse === "decouvrir";
}

/** Verdict d'une légende à découvrir, dans le vocabulaire des légendes écrites. */
export function verdictDuJugement(j: Jugement | undefined): "juste" | "fausse" | "vide" {
  return j === "juste" ? "juste" : j === "faux" ? "fausse" : "vide";
}

/**
 * Jugements reçus du navigateur, par question puis par légende : seules les
 * valeurs « juste » et « faux » sont retenues, le reste est un cache non jugé.
 */
export function lireJugements(brut: unknown): Record<string, Record<string, Jugement>> {
  const out: Record<string, Record<string, Jugement>> = {};
  if (!brut || typeof brut !== "object" || Array.isArray(brut)) return out;
  for (const [qid, val] of Object.entries(brut as Record<string, unknown>)) {
    if (qid.length > 80 || !val || typeof val !== "object" || Array.isArray(val)) continue;
    const d: Record<string, Jugement> = {};
    for (const [lid, j] of Object.entries(val as Record<string, unknown>)) {
      if (lid.length <= 80 && (j === "juste" || j === "faux")) d[lid] = j;
    }
    out[qid] = d;
  }
  return out;
}

/**
 * Jugements retenus pour les questions à découvrir d'un tirage : ceux de leurs
 * caches, et d'eux seuls. Un jugement porté sur une autre question, ou sur un
 * cache qui n'existe pas, est ignoré.
 */
export function jugementsDuTirage(
  jugements: Record<string, Record<string, Jugement>>,
  questions: { id: string; type: string; modeReponse?: string; legendes?: { id: string }[] }[],
): Record<string, Record<string, Jugement>> {
  const out: Record<string, Record<string, Jugement>> = {};
  for (const q of questions) {
    if (!estADecouvrir(q)) continue;
    const ids = new Set((q.legendes ?? []).map((l) => l.id));
    const d: Record<string, Jugement> = {};
    for (const [lid, j] of Object.entries(jugements[q.id] ?? {})) if (ids.has(lid)) d[lid] = j;
    out[q.id] = d;
  }
  return out;
}

/** Nombre de caches jugés, toutes questions confondues. */
export function nombreDeJugements(jugements: Record<string, Record<string, Jugement>>): number {
  return Object.values(jugements).reduce((s, d) => s + Object.keys(d).length, 0);
}

/**
 * Un résultat d'entraînement ne s'émet pas en rapport. La règle valait déjà
 * dans les faits — l'entraînement corrige une question à la fois — mais rien
 * ne l'imposait au serveur ; l'auto-évaluation des schémas à découvrir la
 * rend nécessaire : sans elle, un apprenant se jugerait lui-même et porterait
 * ce jugement au rapport. Un résultat scellé avant le 22/09/2026 ne porte pas
 * de mode : il reste émissible, comme avant.
 */
export function refusEmissionEntrainement(r: { mode?: string }): string | null {
  return r.mode === "entrainement"
    ? "Ce résultat vient d'un entraînement : il ne vaut pas preuve et ne peut pas être émis. Passez l'évaluation."
    : null;
}
