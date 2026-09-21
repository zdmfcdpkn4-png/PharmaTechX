/**
 * Composition de la file d'attente de l'accès rapide (paquet A, 21/09/2026).
 *
 * Module **pur** : `lib/*` est `server-only`, et l'ordre des items doit se
 * vérifier par un test unitaire, sans base ni session — c'est le critère 7 de
 * `docs/ACCES-RAPIDE.md` (« l'ordre des items ne dépend d'aucun historique »).
 * Les profils sont donc redéclarés ici ; leur concordance avec `Role`
 * (`lib/db.ts`) est tenue à la compilation par l'indexation de `ORDRE` avec
 * `session.role` dans le gabarit racine.
 *
 * Deux écarts assumés par rapport à la spécification du 19/09/2026, tous deux
 * consignés au § 9 de ce document :
 *
 *   1. « Identifiants d'agents » et « Codes d'accès » n'y figurent plus. Ce
 *      sont des écrans, pas des files d'attente : le nombre qu'on leur
 *      accolerait (l'effectif, le nombre de codes) n'appelle aucun acte. Or
 *      c'est le compteur qui informe. Ils restent dans « Aller à ».
 *   2. « Verdicts à arbitrer » passe du profil d'administration au tutorat :
 *      l'arbitrage est l'acte du tuteur (`app/admin/rapports/[id]/page.tsx`,
 *      `peutArbitrer`), et l'administration l'exerce aussi. Les deux profils
 *      portent donc la même liste, dans le même ordre ; seuls les compteurs
 *      diffèrent, parce que le visa du pharmacien demande un code
 *      d'administration.
 */
export type ProfilAcces = "poste" | "tuteur" | "admin";

/** Compteurs bruts, calculés côté serveur par `lib/attente.ts`. */
export interface ComptesAttente {
  signalements: number;
  questionsAVerifier: number;
  rapportsAViser: number;
  verdictsAArbitrer: number;
}

export const AUCUN_COMPTE: ComptesAttente = {
  signalements: 0,
  questionsAVerifier: 0,
  rapportsAViser: 0,
  verdictsAArbitrer: 0,
};

export interface ItemAttente {
  cle: keyof ComptesAttente;
  libelle: string;
  href: string;
  nombre: number;
}

/** Au-delà, ce n'est plus un raccourci (§ 6.3 de la spécification). */
export const PLAFOND_A_FAIRE = 5;

interface DefinitionItem {
  cle: keyof ComptesAttente;
  libelle: string;
  href: string;
  /** L'écran n'existe que si la conservation des rapports est active. */
  conservation?: boolean;
}

/**
 * L'ordre de ces tableaux **est** l'ordre affiché. Il ne dépend ni des
 * compteurs, ni de l'usage, ni de l'heure : c'est ce qui permet à la main
 * d'aller au deuxième item sans lire. Ne pas le trier.
 */
const ORDRE: Record<ProfilAcces, DefinitionItem[]> = {
  // Un apprenant n'a pas de file d'attente ; lui en montrer une vide lui
  // apprendrait seulement qu'il est surveillé.
  poste: [],
  tuteur: [
    { cle: "rapportsAViser", libelle: "Rapports à viser", href: "/admin/rapports", conservation: true },
    { cle: "verdictsAArbitrer", libelle: "Verdicts à arbitrer", href: "/admin/rapports", conservation: true },
    { cle: "signalements", libelle: "Signalements ouverts", href: "/admin/signalements" },
    { cle: "questionsAVerifier", libelle: "Questions à vérifier", href: "/admin/questions?statut=a_verifier" },
  ],
  admin: [
    { cle: "rapportsAViser", libelle: "Rapports à viser", href: "/admin/rapports", conservation: true },
    { cle: "verdictsAArbitrer", libelle: "Verdicts à arbitrer", href: "/admin/rapports", conservation: true },
    { cle: "signalements", libelle: "Signalements ouverts", href: "/admin/signalements" },
    { cle: "questionsAVerifier", libelle: "Questions à vérifier", href: "/admin/questions?statut=a_verifier" },
  ],
};

/**
 * La file d'attente d'un profil. Un item à zéro **reste dans la liste** : un
 * item qui va et vient détruit la mémoire spatiale, et « 0 » est justement le
 * renseignement qui évite le déplacement.
 */
export function itemsAFaire(
  profil: ProfilAcces,
  comptes: ComptesAttente,
  conservation: boolean,
): ItemAttente[] {
  return ORDRE[profil]
    .filter((d) => !d.conservation || conservation)
    .slice(0, PLAFOND_A_FAIRE)
    .map((d) => ({ cle: d.cle, libelle: d.libelle, href: d.href, nombre: comptes[d.cle] }));
}

/** Vrai si au moins un item est non nul : c'est ce qui allume la pastille du déclencheur. */
export function fileNonVide(items: ItemAttente[]): boolean {
  return items.some((i) => i.nombre > 0);
}

/**
 * Nom accessible d'un item : le compteur doit être dans le nom, pas seulement
 * à côté (WCAG 4.1.2). « Signalements ouverts, 3 en attente », « …, aucun ».
 */
export function nomAccessible(item: { libelle: string; nombre: number }): string {
  return `${item.libelle}, ${item.nombre === 0 ? "aucun" : `${item.nombre} en attente`}`;
}
