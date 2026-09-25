import type { ReglageModule } from "./reglages";

/**
 * Programme d'une filière, lu et réglé depuis sa page (question 80, choix a,
 * 25/09/2026).
 *
 * Le rattachement d'un module reste enregistré là où il l'était : dans le
 * réglage d'un module du code (`reglages_modules`), dans la ligne d'un module
 * déposé (`modules_deposes`). La page d'une filière n'en est qu'un second
 * accès : elle et l'écran Modules montrent toujours la même chose.
 *
 * Trois règles, que l'écran annonce avant d'enregistrer :
 * - un module ne perd pas ici sa **dernière filière** : sans filière, un
 *   module du code retrouverait en silence celles de la fiche, et un module
 *   déposé passerait au tronc commun, donc dans toutes les filières ;
 * - un module du **tronc commun** ne se coche pas ici : l'y rattacher le
 *   retirerait de toutes les autres filières ;
 * - un module garde **au moins un niveau** : sans niveau, un module du code
 *   retrouverait ceux de la fiche, et un module déposé ne serait proposé à
 *   aucun niveau cible.
 *
 * Module pur : testable sans base.
 */

/** La filière « Socle transversal » : un module qui n'a qu'elle est au tronc commun. */
export const SOCLE = "socle";

/** Ce que la page lit d'un module : ses filières et ses niveaux effectifs. */
export interface ModuleRattache {
  id: string;
  affectation: "poste" | "tronc-commun";
  postes: readonly string[];
  niveaux: readonly string[];
}

/**
 * Niveaux d'une filière, dans l'ordre du référentiel : ceux qui la déclarent
 * comme leur filière, fiche et dépôts confondus.
 */
export function codesDeLaFiliere(niveaux: readonly { code: string | number; filiere: string }[], filiere: string): string[] {
  return niveaux.filter((n) => n.filiere === filiere).map((n) => String(n.code));
}

/** Filières d'un module hors socle : celles qui le font « de poste ». */
export function filieresDePoste(postes: readonly string[]): string[] {
  return postes.filter((f) => f !== SOCLE);
}

/** Le module est au programme de la filière — comme le compose `composerProgramme`. */
export function estDansLaFiliere(m: ModuleRattache, filiere: string): boolean {
  return m.affectation === "poste" && m.postes.includes(filiere);
}

/** La filière est la seule filière de poste du module : la page ne l'en retire pas. */
export function seuleFiliere(m: ModuleRattache, filiere: string): boolean {
  const poste = filieresDePoste(m.postes);
  return m.affectation === "poste" && poste.length === 1 && poste[0] === filiere;
}

export interface Repartition<T> {
  /** Modules de poste rattachés à la filière. */
  dans: T[];
  /** Modules de poste des autres filières : ceux qu'on peut lui ajouter. */
  autres: T[];
  /** Tronc commun, suivi par toutes les filières : listé à part. */
  troncCommun: T[];
}

/** Répartition des modules pour la page d'une filière, dans l'ordre reçu. */
export function repartir<T extends ModuleRattache>(modules: readonly T[], filiere: string): Repartition<T> {
  const r: Repartition<T> = { dans: [], autres: [], troncCommun: [] };
  for (const m of modules) {
    if (m.affectation === "tronc-commun") r.troncCommun.push(m);
    else if (m.postes.includes(filiere)) r.dans.push(m);
    else r.autres.push(m);
  }
  return r;
}

/** Même contenu, quel que soit l'ordre. */
export function memesElements(a: readonly string[], b: readonly string[]): boolean {
  const sa = new Set(a);
  const sb = new Set(b);
  return sa.size === sb.size && [...sa].every((x) => sb.has(x));
}

/** Ce qui est coché sur la ligne d'un module. */
export interface Saisie {
  /** Case « au programme de la filière ». */
  dans: boolean;
  /** Niveaux de la filière cochés pour ce module. */
  niveaux: readonly string[];
}

/** Ce que la page a montré d'une ligne, et ce que le formulaire en renvoie. */
export interface Envoi {
  /** Case « au programme » telle qu'affichée. */
  dansAffiche: boolean;
  /** Case « au programme » telle que renvoyée. */
  dansVoulu: boolean;
  /** Niveaux de la filière cochés à l'affichage. */
  niveauxAffiches: readonly string[];
  /** Niveaux de la filière cochés à l'envoi. */
  niveauxVoulus: readonly string[];
}

/**
 * Saisie d'une ligne, lue comme les seules cases changées : une case que
 * l'on n'a pas touchée laisse le module tel qu'il est au moment de
 * l'enregistrement, même si un autre écran — un autre onglet, un autre
 * administrateur — l'a modifié depuis l'affichage. Sans cela, une page
 * restée ouverte défaisait en silence ce qui avait été fait ailleurs.
 */
export function saisieDepuisEnvoi(
  m: ModuleRattache,
  filiere: string,
  niveauxDeLaFiliere: readonly string[],
  e: Envoi,
): Saisie {
  const deLaFiliere = new Set(niveauxDeLaFiliere);
  const affiches = new Set(e.niveauxAffiches.filter((n) => deLaFiliere.has(n)));
  const voulus = new Set(e.niveauxVoulus.filter((n) => deLaFiliere.has(n)));
  const niveaux = new Set(m.niveaux.filter((n) => deLaFiliere.has(n)));
  for (const n of voulus) if (!affiches.has(n)) niveaux.add(n);
  for (const n of affiches) if (!voulus.has(n)) niveaux.delete(n);
  return {
    dans: e.dansVoulu !== e.dansAffiche ? e.dansVoulu : estDansLaFiliere(m, filiere),
    niveaux: niveauxDeLaFiliere.filter((n) => niveaux.has(n)),
  };
}

export type Refus = "derniere-filiere" | "tronc-commun" | "aucun-niveau";

export interface Changement {
  postes: string[];
  niveaux: string[];
}

/**
 * Filières et niveaux d'un module après la saisie faite sur la page d'une
 * filière ; `null` quand rien ne change.
 *
 * - Ajouté : la filière s'ajoute à ses filières, et ses niveaux cochés aux
 *   siens.
 * - Retiré : la filière quitte ses filières, et ses niveaux quittent ceux du
 *   module — un niveau appartient à une filière, et un profil se compose
 *   d'une filière et de l'un de ses niveaux. S'il ne lui en restait aucun, le
 *   module garde ceux-là : le retirer ne doit pas le laisser sans niveau.
 * - Resté : seuls ses niveaux de la filière suivent les cases.
 * - Resté hors de la filière : rien ne change, cases de niveau comprises.
 *
 * Les niveaux hors de la filière gardent leur place ; ceux de la filière
 * suivent l'ordre de la filière.
 */
export function changementDuModule(
  m: ModuleRattache,
  filiere: string,
  niveauxDeLaFiliere: readonly string[],
  saisie: Saisie,
): { changement: Changement | null } | { refus: Refus } {
  const avant = estDansLaFiliere(m, filiere);
  if (!saisie.dans && !avant) return { changement: null };
  if (saisie.dans && m.affectation === "tronc-commun") return { refus: "tronc-commun" };
  const deLaFiliere = new Set(niveauxDeLaFiliere);
  if (!saisie.dans) {
    if (seuleFiliere(m, filiere)) return { refus: "derniere-filiere" };
    const restants = m.niveaux.filter((n) => !deLaFiliere.has(n));
    return {
      changement: {
        postes: m.postes.filter((f) => f !== filiere),
        niveaux: restants.length > 0 ? restants : [...m.niveaux],
      },
    };
  }
  const coches = new Set(saisie.niveaux.filter((n) => deLaFiliere.has(n)));
  const niveaux = [
    ...m.niveaux.filter((n) => !deLaFiliere.has(n)),
    ...niveauxDeLaFiliere.filter((n) => coches.has(n)),
  ];
  if (niveaux.length === 0 && m.niveaux.length > 0) return { refus: "aucun-niveau" };
  const postes = avant ? [...m.postes] : [...m.postes, filiere];
  if (avant && memesElements(niveaux, m.niveaux)) return { changement: null };
  return { changement: { postes, niveaux } };
}

/**
 * Réglage d'un module du code après un changement : seuil et parcours
 * inchangés ; filières et niveaux égaux à ceux de la fiche retombent sur la
 * fiche, pour ne pas afficher d'écart qui n'en est pas un.
 */
export function reglageApres(
  existant: ReglageModule | undefined,
  fiche: { postes: readonly string[]; niveaux: readonly string[] },
  apres: Changement,
): ReglageModule {
  return {
    seuil: existant?.seuil ?? null,
    parcours: existant?.parcours ?? null,
    filieres: memesElements(apres.postes, fiche.postes) ? null : apres.postes,
    niveaux: memesElements(apres.niveaux, fiche.niveaux) ? null : apres.niveaux,
  };
}

export interface ProgrammeAuNiveau {
  niveau: string;
  /** Modules de la filière proposés à ce niveau cible. */
  filiere: number;
  /** Modules du tronc commun proposés à ce niveau cible. */
  troncCommun: number;
}

/**
 * Ce qu'un profil de la filière voit à chaque niveau cible : les modules
 * qui portent ce niveau, de la filière et du tronc commun — la règle de
 * `modulesDuProfil` (`content/ordres.ts`).
 */
export function programmeParNiveau(
  dans: readonly ModuleRattache[],
  troncCommun: readonly ModuleRattache[],
  niveauxDeLaFiliere: readonly string[],
): ProgrammeAuNiveau[] {
  return niveauxDeLaFiliere.map((niveau) => ({
    niveau,
    filiere: dans.filter((m) => m.niveaux.includes(niveau)).length,
    troncCommun: troncCommun.filter((m) => m.niveaux.includes(niveau)).length,
  }));
}
