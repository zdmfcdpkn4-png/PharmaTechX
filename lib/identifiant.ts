/**
 * Identifiant d'agent — le pseudonyme sous lequel un rapport est enregistré
 * (décision du 18/09/2026, question 6, choix a). Généré par le site à la
 * création (`AG-001`, `AG-002`…), jamais choisi : rien n'y laisse entrer un
 * nom. La correspondance identifiant ↔ agent est tenue par le pharmacien
 * hors du site.
 *
 * Module sans dépendance serveur : utilisé par le navigateur (saisie à
 * l'émission), par les actions et par les tests.
 */

export const PREFIXE_IDENTIFIANT = "AG-";

/** Trois chiffres au moins ; au-delà de 999, la longueur suit. */
export const FORMAT_IDENTIFIANT = /^AG-\d{3,}$/;

/** `AG-007` pour le numéro 7. */
export function formaterIdentifiant(numero: number): string {
  return `${PREFIXE_IDENTIFIANT}${String(numero).padStart(3, "0")}`;
}

/**
 * Normalise une saisie (« ag 7 », « AG-07 », « 7 ») en `AG-007`, ou rend
 * `null` si rien d'exploitable n'est saisi.
 */
export function normaliserIdentifiant(saisie: string): string | null {
  const brut = String(saisie ?? "").trim().toUpperCase().replace(/\s+/g, "");
  const m = /^(?:AG-?)?(\d{1,9})$/.exec(brut);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isInteger(n) || n < 1) return null;
  return formaterIdentifiant(n);
}
