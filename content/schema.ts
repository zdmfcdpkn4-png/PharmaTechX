/**
 * Schéma à compléter — comparaison des légendes écrites.
 *
 * Repris du Lecteur QIM · QCM (`domain/schema.ts`) : une réponse juste refusée
 * sur un accent ou une majuscule décourage plus sûrement qu'une question
 * difficile. On normalise donc largement, mais on ne devine jamais : « noyau »
 * ne vaut pas « nucléole », et les variantes acceptées sont écrites par le
 * tuteur dans le mot attendu, séparées par une barre verticale
 * (« TCP | tube contourné proximal »).
 *
 * Ce fichier est pur (aucune dépendance serveur) : il est testable tel quel.
 */

/**
 * Repère d'une légende sur l'image, en pourcentage de sa largeur et de sa
 * hauteur (0–100), pour survivre à tout redimensionnement.
 *
 * `x`, `y` : le point désigné sur le schéma. `cache` : le rectangle qui
 * recouvre le mot d'origine à l'affichage ; absent quand l'image est déjà
 * muette (schéma vierge, photo sans légende).
 */
export interface Repere {
  x: number;
  y: number;
  cache?: { x: number; y: number; w: number; h: number };
}

/** Une légende à écrire : le mot attendu (avec ses variantes) et sa place. */
export interface Legende {
  id: string;
  /** Mot attendu ; variantes acceptées séparées par « | ». */
  attendu: string;
  repere: Repere;
}

/**
 * Articles et élisions retirés en tête de réponse : « le noyau » vaut
 * « noyau », « l'os » vaut « os ». Un article est un mot entier.
 */
const ARTICLES = /^(?:(?:l[ae]s?|un[e]?|des|du|de\s+l[ae]s?|de)\s+|(?:l|d|de\s+l)['’]\s*)/;

/**
 * Réponse écrite ramenée à sa forme comparable : minuscules, sans accent, sans
 * ponctuation ni tiret, espaces réduits, article initial retiré.
 */
export function normaliser(s: string): string {
  const base = s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[-–—_/]+/g, " ")
    .replace(/[.,;:!?()[\]«»"]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return base.replace(ARTICLES, "").trim();
}

/** Variantes acceptées d'une légende : le mot attendu et celles écrites après « | ». */
export function variantes(attendu: string): string[] {
  return attendu.split("|").map((x) => x.trim()).filter((x) => x !== "");
}

/** Le mot attendu sans ses variantes : ce qui s'affiche à la correction. */
export function motAttendu(attendu: string): string {
  return attendu.split("|")[0].trim();
}

function comparable(s: string): string {
  return normaliser(s).replace(/\s+/g, "");
}

/** La réponse écrite correspond-elle au mot attendu ou à l'une de ses variantes ? */
export function legendeJuste(saisie: string, attendu: string): boolean {
  const n = comparable(saisie);
  if (!n) return false;
  return variantes(attendu).some((v) => comparable(v) === n);
}

/** Verdict d'une légende : vide = non répondue, sinon juste ou fausse. */
export function verdictLegende(saisie: string | undefined, attendu: string): "juste" | "fausse" | "vide" {
  const t = typeof saisie === "string" ? saisie : "";
  if (!t.trim()) return "vide";
  return legendeJuste(t, attendu) ? "juste" : "fausse";
}

/**
 * Les légendes dans l'ordre où elles se lisent : de haut en bas, puis de
 * gauche à droite. C'est l'ordre des repères numérotés à l'écran.
 */
export function ordreLecture<T extends { repere: Repere }>(legendes: readonly T[]): number[] {
  return legendes
    .map((l, i) => ({ i, y: l.repere.y, x: l.repere.x }))
    .sort((a, b) => a.y - b.y || a.x - b.x || a.i - b.i)
    .map((r) => r.i);
}

export function borner(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/** Au dixième de pour-cent : assez fin pour un mot, lisible dans un texte de dépôt. */
export function arrondir(v: number): number {
  return Math.round(v * 10) / 10;
}

/** Largeur d'un cache posé d'un clic, en % de la largeur de l'image. */
export const CACHE_LARGEUR = 14;
export const CACHE_MIN = { w: 2, h: 1.5 };

export type Cache = NonNullable<Repere["cache"]>;

export function contenir(c: Cache): Cache {
  const w = borner(c.w, CACHE_MIN.w, 100);
  const h = borner(c.h, CACHE_MIN.h, 100);
  return {
    x: arrondir(borner(c.x, 0, 100 - w)),
    y: arrondir(borner(c.y, 0, 100 - h)),
    w: arrondir(w),
    h: arrondir(h),
  };
}

export function centre(c: Cache): { x: number; y: number } {
  return { x: arrondir(c.x + c.w / 2), y: arrondir(c.y + c.h / 2) };
}

/** Cache par défaut autour d'un point, environ trois fois plus large que haut à l'écran. */
export function cacheParDefaut(x: number, y: number, ratio: number): Cache {
  const w = CACHE_LARGEUR;
  const h = borner((w * (ratio > 0 ? ratio : 1)) / 3, 2.5, 14);
  return contenir({ x: x - w / 2, y: y - h / 2, w, h });
}

/** Pose une légende en un point : cache par défaut autour, repère à son centre. */
export function poser(x: number, y: number, ratio: number): Repere {
  const cache = cacheParDefaut(borner(x, 0, 100), borner(y, 0, 100), ratio);
  return { ...centre(cache), cache };
}

/** Un schéma est prêt quand chaque légende est posée et porte un mot. */
export function schemaPret(legendes: readonly Legende[]): boolean {
  return legendes.length > 0 && legendes.every((l) => motAttendu(l.attendu) !== "");
}
