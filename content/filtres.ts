/**
 * Barre de filtres commune (02/10/2026, question 91, choix a, lot 3) : celle
 * de la banque, reprise sur les autres listes. Une recherche, deux ou trois
 * listes déroulantes, « Plus de filtres » au-delà, le nombre de lignes
 * retenues, une puce par filtre actif et « Tout effacer ». Les filtres restent
 * dans l'adresse : le retour arrière et un lien envoyé les retrouvent.
 *
 * Module pur : `components/BarreFiltres.tsx` l'affiche, chaque écran lit ses
 * paramètres avec ces fonctions et filtre sa liste avec `content/filtres-listes.ts`,
 * les tests les vérifient.
 */
import { RECHERCHE_MAX, motsRecherche, texteCorrespond } from "./filtres-banque";
import { lireJour as jourDuCalendrier } from "../lib/journal-filtre";

export interface OptionFiltre {
  valeur: string;
  libelle: string;
  /** Ce qu'en dit la puce, quand l'option porte un compte : « Module : Gestion des déchets », sans « (4) ». */
  puce?: string;
}

export interface ChampFiltre {
  /** Paramètre de l'adresse. */
  nom: string;
  /** Intitulé du champ, repris par sa puce. */
  libelle: string;
  /** Liste déroulante (défaut) ou jour du calendrier. */
  type?: "liste" | "jour";
  /** Option vide d'une liste : aucun filtre. */
  tous?: string;
  options?: readonly OptionFiltre[];
  /** Valeur lue dans l'adresse ; vide : aucun filtre. */
  valeur: string;
  /** Liste large, pour des intitulés longs (un module). */
  large?: boolean;
  /** La puce met l'option en minuscule initiale : « État : révoqués ». */
  minuscule?: boolean;
  /** Un tri, pas un filtre (le classement des Statistiques) : il a sa puce, il ne réduit pas la liste. */
  tri?: boolean;
}

export interface RechercheFiltre {
  /** Paramètre de l'adresse ; `q` par défaut (Personnel garde son `agent`). */
  nom?: string;
  /** Texte lu dans l'adresse. */
  valeur: string;
  placeholder: string;
}

/** Premier texte d'un paramètre, espaces resserrés, coupé à `max` caractères ; vide sinon. */
export function lireTexte(brut: unknown, max = RECHERCHE_MAX): string {
  const v = Array.isArray(brut) ? brut[0] : brut;
  return typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

/** La valeur si elle est permise ; vide sinon. */
export function lireChoix(brut: unknown, permises: readonly string[]): string {
  const v = lireTexte(brut, 200);
  return permises.includes(v) ? v : "";
}

/** Un jour du calendrier (AAAA-MM-JJ), tel que le donne un champ de date ; vide sinon. */
export function lireJour(brut: unknown): string {
  return jourDuCalendrier(Array.isArray(brut) ? brut[0] : brut) ?? "";
}

/** Une période donnée à l'envers est remise dans l'ordre. */
export function periode(du: string, au: string): [string, string] {
  return du && au && du > au ? [au, du] : [du, au];
}

/** Le texte contient-il chacun des mots cherchés, sans casse ni accents ? Une recherche vide retient tout. */
export function correspond(texte: string, recherche: string): boolean {
  return texteCorrespond(texte, motsRecherche(recherche));
}

/** La liste est-elle réduite ? Une recherche ou un champ actif, un tri n'y comptant pas. */
export function filtrent(recherche: RechercheFiltre | undefined, champs: readonly ChampFiltre[]): boolean {
  return Boolean(recherche?.valeur) || champs.some((c) => !c.tri && c.valeur !== "");
}

/** Les filtres actifs, en paramètres d'adresse : la recherche d'abord, puis les champs dans leur ordre. */
export function parametresActifs(recherche: RechercheFiltre | undefined, champs: readonly ChampFiltre[]): [string, string][] {
  return [
    ...(recherche?.valeur ? [[recherche.nom ?? "q", recherche.valeur] as [string, string]] : []),
    ...champs.filter((c) => c.valeur !== "").map((c) => [c.nom, c.valeur] as [string, string]),
  ];
}

/** Adresse d'une page sous ces paramètres ; sans paramètre, l'adresse nue. `ancre` : la section où revenir. */
export function adresseFiltree(adresse: string, params: readonly (readonly [string, string])[], ancre = ""): string {
  const s = new URLSearchParams(params.map(([k, v]) => [k, v] as [string, string])).toString();
  return `${s ? `${adresse}?${s}` : adresse}${ancre ? `#${ancre}` : ""}`;
}

function jourFrancais(jour: string): string {
  const [a, m, j] = jour.split("-");
  return `${j}/${m}/${a}`;
}

/** « État : révoqués », « Du 01/10/2026 » : ce que dit la puce d'un champ actif. */
export function libellePuce(c: ChampFiltre): string {
  if (c.type === "jour") return `${c.libelle} ${jourFrancais(c.valeur)}`;
  const option = c.options?.find((x) => x.valeur === c.valeur);
  const o = option?.puce ?? option?.libelle ?? c.valeur;
  return `${c.libelle} : ${c.minuscule ? o.charAt(0).toLowerCase() + o.slice(1) : o}`;
}

export interface Puce {
  cle: string;
  libelle: string;
  /** La même page, sans ce filtre : les autres restent, et les paramètres gardés. */
  href: string;
}

/** Une puce par filtre actif ; chacune retire le sien. */
export function pucesFiltres(
  adresse: string,
  gardes: readonly (readonly [string, string])[],
  recherche: RechercheFiltre | undefined,
  champs: readonly ChampFiltre[],
  ancre = "",
): Puce[] {
  const actifs = parametresActifs(recherche, champs);
  const sans = (cle: string) => adresseFiltree(adresse, [...gardes, ...actifs.filter(([k]) => k !== cle)], ancre);
  const nomRecherche = recherche?.nom ?? "q";
  return [
    ...(recherche?.valeur ? [{ cle: nomRecherche, libelle: `Recherche : « ${recherche.valeur} »`, href: sans(nomRecherche) }] : []),
    ...champs.filter((c) => c.valeur !== "").map((c) => ({ cle: c.nom, libelle: libellePuce(c), href: sans(c.nom) })),
  ];
}

/** « 12 codes sur 41 » sous un filtre, « 41 codes » sans ; l'unité s'accorde au nombre qui la précède. */
export function compteRetenu(retenus: number, total: number, unite: readonly [string, string], filtre: boolean): string {
  const de = (n: number) => (n > 1 ? unite[1] : unite[0]);
  return filtre ? `${retenus} ${de(retenus)} sur ${total}` : `${total} ${de(total)}`;
}
