import { metiers, metierOuDefaut } from "./habilitation";

/**
 * Ordre des niveaux d'habilitation (tâche 66, recommandation retenue le
 * 23/09/2026).
 *
 * Chaque métier range ses niveaux par rang croissant, sur tous les écrans qui
 * lisent le référentiel. Les niveaux de la fiche valent 10, 20, 30… dans
 * l'ordre de la fiche : un niveau ajouté se glisse entre deux, 45 entre N2 et
 * N3. Un rang déposé positif l'emporte, pour un niveau de la fiche aussi.
 * Un rang nul laisse un niveau de la fiche à sa place, et range un niveau
 * ajouté après ceux qui en ont un : c'est la place que le site donnait à tous
 * les niveaux ajoutés jusqu'ici, qui ne bougent donc pas.
 *
 * L'ordre n'a aucun sens pour le tirage : le plafond d'un niveau cible se lit
 * au barème, code par code (`content/bareme.ts`).
 */

/** Écart entre deux niveaux de la fiche : la place d'en glisser neuf entre eux. */
export const PAS_RANG_FICHE = 10;

/** Rang d'un niveau de la fiche (10 pour le premier), `null` pour un niveau ajouté. */
export function rangDeFiche(code: string, codesFiche: readonly string[]): number | null {
  const i = codesFiche.indexOf(code);
  return i < 0 ? null : (i + 1) * PAS_RANG_FICHE;
}

/** Rang qui ordonne ce niveau ; `null` : aucun, le niveau vient après les classés de son métier. */
export function rangEffectif(
  code: string,
  rangDepose: number | null | undefined,
  codesFiche: readonly string[],
): number | null {
  if (typeof rangDepose === "number" && Number.isFinite(rangDepose) && rangDepose > 0) return rangDepose;
  return rangDeFiche(code, codesFiche);
}

/**
 * Niveaux rangés par métier (dans l'ordre de `metiers`), puis par rang
 * effectif ; à rang égal ou sans rang, l'ordre d'arrivée tient.
 */
export function ordonnerNiveaux<N extends { code: string; metier?: string }>(
  niveaux: readonly N[],
  rangs: ReadonlyMap<string, number>,
  codesFiche: readonly string[],
): N[] {
  const placeMetier = (n: N) => metiers.findIndex((m) => m.id === metierOuDefaut(n.metier).id);
  const SANS_RANG = Number.MAX_SAFE_INTEGER;
  return niveaux
    .map((n, i) => ({
      n,
      i,
      m: placeMetier(n),
      r: rangEffectif(String(n.code), rangs.get(String(n.code)), codesFiche) ?? SANS_RANG,
    }))
    .sort((a, b) => a.m - b.m || a.r - b.r || a.i - b.i)
    .map((x) => x.n);
}

/** « N1a 10, N1b 20… » : la clé de lecture des rangs, rappelée au Référentiel. */
export function rappelRangsFiche(codesFiche: readonly string[]): string {
  return codesFiche.map((c, i) => `${c} ${(i + 1) * PAS_RANG_FICHE}`).join(", ");
}
