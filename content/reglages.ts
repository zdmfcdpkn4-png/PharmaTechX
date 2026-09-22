/**
 * Réglages d'un module du code (décision du 19/09/2026, question 36, choix a).
 *
 * Le texte des 53 critères reste versionné avec le site, mais son
 * **rattachement** ne l'est plus : filières, niveaux, et présence au parcours
 * d'intégration ou de maintien se règlent depuis l'administration, comme pour
 * un module déposé. La fiche d'habilitation reste la source : un réglage est
 * un **écart assumé** à la fiche, que l'écran signale, et qui se retire d'un
 * clic pour revenir à ce que dit la fiche.
 *
 * Module pur : la règle d'application est testable sans base.
 */

import type { Module, NiveauHabilitation, TypeParcours } from "./types";

export interface ReglageModule {
  /** Seuil de réussite (%) ; absent, le seuil par défaut du barème s'applique. */
  seuil?: number | null;
  /** Filières du critère ; absent, celles de la fiche. */
  filieres?: string[] | null;
  /** Niveaux visés ; absent, ceux de la fiche. */
  niveaux?: NiveauHabilitation[] | null;
  /** Parcours — intégration, maintien ; absent, ceux de la fiche. */
  parcours?: TypeParcours[] | null;
}

/** Liste de codes retenue si elle est non vide et tirée des valeurs connues. */
export function listeConnue(brut: unknown, connues: readonly string[]): string[] | null {
  if (!Array.isArray(brut)) return null;
  const retenus = brut.filter((v): v is string => typeof v === "string" && connues.includes(v));
  return retenus.length > 0 ? [...new Set(retenus)] : null;
}

export function parcoursConnus(brut: unknown): TypeParcours[] | null {
  return listeConnue(brut, ["integration", "maintien"]) as TypeParcours[] | null;
}

/** Niveaux retenus parmi ceux de la fiche. */
export function niveauxConnus(brut: unknown, connus: readonly string[]): NiveauHabilitation[] | null {
  return listeConnue(brut, connus) as NiveauHabilitation[] | null;
}

/** `true` si le réglage ne porte aucun écart : il n'y a rien à enregistrer. */
export function reglageVide(r: ReglageModule): boolean {
  return (
    (r.seuil === undefined || r.seuil === null) &&
    !r.filieres?.length &&
    !r.niveaux?.length &&
    !r.parcours?.length
  );
}

/**
 * Module tel qu'il vaut une fois son réglage appliqué. Un module rattaché à
 * une filière au moins cesse d'être au tronc commun, et inversement : sans
 * quoi un module « de poste » sans filière disparaîtrait de tout programme.
 */
export function appliquerReglage(m: Module, r: ReglageModule | undefined, seuilDefaut: number): Module {
  // Le seuil d'un module du code est celui réglé pour lui, sinon le seuil par
  // défaut du barème — jamais la valeur écrite dans le fichier du module, qui
  // n'est qu'un point de départ (règle posée à la question 10).
  if (!r) return { ...m, seuilReussite: seuilDefaut };
  const postes = r.filieres ?? m.postes;
  const horsSocle = postes.filter((f) => f !== "socle");
  return {
    ...m,
    seuilReussite: r.seuil ?? seuilDefaut,
    postes,
    niveaux: r.niveaux ?? m.niveaux,
    parcours: r.parcours ?? m.parcours,
    affectation: r.filieres ? (horsSocle.length > 0 ? "poste" : "tronc-commun") : m.affectation,
  };
}

/** Ce qui s'écarte de la fiche, en clair, pour l'écran d'administration. */
export function ecartsDeLaFiche(m: Module, r: ReglageModule | undefined, seuilDefaut?: number): string[] {
  if (!r) return [];
  const ecarts: string[] = [];
  const memes = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));
  if (typeof r.seuil === "number" && r.seuil !== (seuilDefaut ?? m.seuilReussite)) ecarts.push(`seuil ${r.seuil} %`);
  if (r.filieres && !memes(r.filieres, m.postes)) ecarts.push(`filières : ${r.filieres.join(", ")}`);
  if (r.niveaux && !memes(r.niveaux, m.niveaux)) ecarts.push(`niveaux : ${r.niveaux.join(", ")}`);
  if (r.parcours && !memes(r.parcours, m.parcours)) {
    ecarts.push(`parcours : ${r.parcours.map((p) => (p === "integration" ? "intégration" : "maintien")).join(", ")}`);
  }
  return ecarts;
}
