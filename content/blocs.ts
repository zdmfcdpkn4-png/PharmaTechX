import type { BlocCompetence } from "./habilitation";

/**
 * Blocs de compétence servis aux écrans (question 81, choix a, 26/09/2026) :
 * la fiche d'habilitation corrigée et complétée par les blocs déposés en
 * base, comme les filières et les niveaux (question 38, choix b).
 *
 * - Un dépôt qui porte le numéro d'un bloc de la fiche le **corrige** : titre,
 *   référence, filière. Un bloc de la fiche ne se désactive pas — ses
 *   critères, versionnés avec le site, en dépendent.
 * - Un dépôt d'un numéro nouveau **ajoute** un bloc, qui reçoit des modules
 *   déposés ; désactivé, il quitte les listes.
 *
 * Module pur : testable sans base.
 */

export interface BlocDepose {
  numero: number;
  titre: string;
  reference: string;
  filiere: string;
  actif: boolean;
}

export interface BlocServi extends BlocCompetence {
  /** `code` : tel que la fiche le donne ; `base` : corrigé ou ajouté. */
  origine: "code" | "base";
  /** Bloc de la fiche d'habilitation. */
  fiche: boolean;
  /** Proposé dans les listes ; un bloc de la fiche l'est toujours. */
  actif: boolean;
}

/**
 * La fiche corrigée, puis les blocs ajoutés, par numéro croissant. `tous`
 * garde les blocs ajoutés désactivés, pour pouvoir les rouvrir.
 */
export function fusionnerBlocs(
  fiche: readonly BlocCompetence[],
  deposes: readonly BlocDepose[],
  tous = false,
): BlocServi[] {
  const parNumero = new Map(deposes.map((d) => [d.numero, d]));
  const deLaFiche = new Set(fiche.map((b) => b.numero));
  const servis: BlocServi[] = fiche.map((b) => {
    const d = parNumero.get(b.numero);
    return d
      ? { numero: b.numero, titre: d.titre, reference: d.reference, filiere: d.filiere, origine: "base", fiche: true, actif: true }
      : { ...b, origine: "code", fiche: true, actif: true };
  });
  for (const d of deposes) {
    if (deLaFiche.has(d.numero) || (!d.actif && !tous)) continue;
    servis.push({
      numero: d.numero,
      titre: d.titre,
      reference: d.reference,
      filiere: d.filiere,
      origine: "base",
      fiche: false,
      actif: d.actif,
    });
  }
  return servis.sort((a, b) => a.numero - b.numero);
}

/** Numéro proposé pour un bloc ajouté : le suivant du plus grand connu. */
export function numeroSuivant(blocs: readonly { numero: number }[]): number {
  return blocs.reduce((max, b) => Math.max(max, b.numero), 0) + 1;
}

/** « 1 à 7 », ou « 1 à 7, 9 » quand la suite a des trous : la plage des blocs, pour une aide. */
export function plageDesBlocs(blocs: readonly { numero: number }[]): string {
  const n = [...new Set(blocs.map((b) => b.numero))].sort((a, b) => a - b);
  const morceaux: string[] = [];
  for (let i = 0; i < n.length; ) {
    let j = i;
    while (j + 1 < n.length && n[j + 1] === n[j] + 1) j++;
    morceaux.push(j - i >= 2 ? `${n[i]} à ${n[j]}` : n.slice(i, j + 1).join(", "));
    i = j + 1;
  }
  return morceaux.join(", ");
}
