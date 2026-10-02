/**
 * Filtres du journal des actions (02/10/2026, question 90, choix a) : action,
 * période en jours de Paris, cible, et pages de 300 lignes vers les plus
 * anciennes. Lecture pure des paramètres de l'adresse, testée à part ; la
 * requête est dans `lib/journal.ts`.
 */

/** Lignes par page, comme l'écran d'avant, qui n'en montrait que 300 en tout. */
export const PAGE_JOURNAL = 300;

export interface FiltreJournal {
  /** Code d'action exact, tel que le journal l'écrit. */
  action?: string;
  /** Premier et dernier jour, inclus, à l'heure de Paris (AAAA-MM-JJ). */
  du?: string;
  au?: string;
  /** Partie de la cible, sans casse : identifiant de question, de module, de dépôt… */
  cible?: string;
  /** Page suivante : les lignes plus anciennes que celle-ci. */
  avant?: number;
}

const JOUR = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Un jour du calendrier, tel que le donne un champ de date ; sinon rien. */
export function lireJour(brut: unknown): string | undefined {
  if (typeof brut !== "string") return undefined;
  const m = JOUR.exec(brut.trim());
  if (!m) return undefined;
  const [annee, mois, jour] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const d = new Date(Date.UTC(annee, mois - 1, jour));
  return d.getUTCFullYear() === annee && d.getUTCMonth() === mois - 1 && d.getUTCDate() === jour ? m[0] : undefined;
}

function texte(brut: unknown, max: number): string | undefined {
  if (typeof brut !== "string") return undefined;
  const t = brut.trim().slice(0, max);
  return t || undefined;
}

export function lireFiltreJournal(p: Record<string, unknown>): FiltreJournal {
  let du = lireJour(p.du);
  let au = lireJour(p.au);
  // Une période donnée à l'envers est remise dans l'ordre.
  if (du && au && du > au) [du, au] = [au, du];
  const action = texte(p.action, 100);
  const cible = texte(p.cible, 100);
  const avant = typeof p.avant === "string" && /^[1-9]\d{0,11}$/.test(p.avant) ? Number(p.avant) : undefined;
  return {
    ...(action ? { action } : {}),
    ...(du ? { du } : {}),
    ...(au ? { au } : {}),
    ...(cible ? { cible } : {}),
    ...(avant ? { avant } : {}),
  };
}

/** Un filtre au moins, la page mise à part. */
export function filtreActif(f: FiltreJournal): boolean {
  return Boolean(f.action || f.du || f.au || f.cible);
}

/** Motif ILIKE d'une partie de cible : `%`, `_` et `\` y valent pour eux-mêmes. */
export function motifCible(cible: string): string {
  return `%${cible.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

/** Adresse du journal sous ces filtres ; `ajouts` remplace, et `undefined` retire. */
export function adresseJournal(f: FiltreJournal, ajouts: Partial<FiltreJournal> = {}): string {
  const tout: FiltreJournal = { ...f, ...ajouts };
  const q = new URLSearchParams();
  for (const cle of ["action", "du", "au", "cible", "avant"] as const) {
    const v = tout[cle];
    if (v !== undefined && v !== "") q.set(cle, String(v));
  }
  const s = q.toString();
  return s ? `/admin/journal?${s}` : "/admin/journal";
}
