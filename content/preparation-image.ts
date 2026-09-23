/**
 * Préparation d'une image avant l'envoi (23/09/2026, sur le modèle du quiz de
 * Flore) — la part qui décide, sans navigateur, testée par
 * `test/preparation-image.test.ts`. Le décodage et le ré-encodage sont dans
 * `components/preparerImage.ts`.
 *
 * Une photo de téléphone fait 12 Mpx et 3 à 5 Mo : telle quelle, le serveur
 * la refuserait (2 Mo au plus), et aucun écran n'en affiche plus de 2 000 px.
 * Une photo est donc toujours ré-encodée — ce qui retire aussi son orientation
 * EXIF, que le serveur ignore en lisant les dimensions, et ses métadonnées :
 * lieu de la prise de vue, appareil, date. Un PNG (capture, schéma au trait)
 * reste tel quel tant qu'il tient dans les limites, pour garder ses traits
 * nets.
 */

/** Taille maximale d'une image acceptée par le serveur (`lib/images.ts`). */
export const IMAGE_MAX_OCTETS = 2 * 1024 * 1024;

/** Plus grand côté conservé, en pixels. */
export const COTE_MAX = 2000;

/** Dimensions après réduction : le plus grand côté ramené à `max`, proportions gardées. */
export function dimensionsReduites(w: number, h: number, max = COTE_MAX): { w: number; h: number } {
  const k = Math.min(1, max / Math.max(w, h));
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) };
}

/**
 * L'image doit-elle être ré-encodée avant l'envoi ? Toujours, sauf un PNG
 * qui tient déjà sous la taille et sous le côté maximaux.
 */
export function aReencoder(type: string, octets: number, w: number, h: number): boolean {
  if (type === "image/png") return octets > IMAGE_MAX_OCTETS || Math.max(w, h) > COTE_MAX;
  return true;
}

/**
 * Nom du fichier ré-encodé en JPEG : même base, extension `.jpg`. L'appariement
 * du dépôt ignore l'extension : « Image : sas.heic » trouve encore « sas.jpg ».
 */
export function nomJpeg(nom: string): string {
  const base = nom.replace(/\.[a-z0-9]+$/i, "");
  return `${base || "image"}.jpg`;
}

/** Qualités JPEG essayées dans l'ordre, jusqu'à passer sous la limite. */
export const QUALITES_JPEG = [0.85, 0.75, 0.65, 0.5] as const;

export interface BilanImage {
  /** Ré-encodée : réduite, et débarrassée de ses métadonnées. */
  reencodee: boolean;
  avant: number;
  apres: number;
}

function mo(octets: number): string {
  return `${(octets / (1024 * 1024)).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Mo`;
}

/** Bilan en clair de la préparation, pour l'écran. */
export function bilanPreparation(liste: readonly BilanImage[]): string {
  if (liste.length === 0) return "";
  const n = liste.length;
  const prete = `${n} image${n > 1 ? "s" : ""} prête${n > 1 ? "s" : ""}`;
  const faites = liste.filter((b) => b.reencodee);
  if (faites.length === 0) return `${prete}.`;
  const avant = faites.reduce((s, b) => s + b.avant, 0);
  const apres = faites.reduce((s, b) => s + b.apres, 0);
  const r = faites.length;
  return `${prete} — ${r} réduite${r > 1 ? "s" : ""} (${mo(avant)} → ${mo(apres)}), métadonnées retirées.`;
}
