import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/**
 * Codes d'accès : fabrication et hachage.
 *
 * Isolé de `lib/auth.ts` pour rester importable hors d'un contexte de requête :
 * l'amorçage du premier administrateur (`lib/db.ts`) a besoin du hachage avant
 * qu'aucune session n'existe, et `lib/auth.ts` dépend déjà de `lib/db.ts`.
 * Ce module ne connaît ni cookie, ni base, ni Next : rien que du calcul.
 *
 * Les codes sont stockés hachés (scrypt, sel tiré par code) : la base ne permet
 * pas de les relire. Perdu, un code se remplace, il ne se retrouve pas.
 */

/**
 * Saisie d'un code : espaces retirés, capitales. La connexion et la
 * confirmation d'un acte irréversible passent par ici, faute de quoi un code
 * accepté à l'entrée pourrait être refusé à la confirmation.
 */
export function normaliserCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, "");
}

export function hacherCode(code: string): string {
  const sel = randomBytes(16);
  const dk = scryptSync(code.normalize("NFKC"), sel, 32);
  return `scrypt$${sel.toString("hex")}$${dk.toString("hex")}`;
}

export function verifierCode(code: string, stocke: string): boolean {
  const [algo, selHex, dkHex] = stocke.split("$");
  if (algo !== "scrypt" || !selHex || !dkHex) return false;
  const attendu = Buffer.from(dkHex, "hex");
  const calcule = scryptSync(
    code.normalize("NFKC"),
    Buffer.from(selHex, "hex"),
    attendu.length,
  );
  return timingSafeEqual(attendu, calcule);
}

/** Code lisible, sans caractères ambigus (0/O, 1/I/l). */
export function genererCode(longueur = 10): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const buf = randomBytes(longueur);
  let out = "";
  for (let i = 0; i < longueur; i++) out += alphabet[buf[i] % alphabet.length];
  return out.match(/.{1,5}/g)!.join("-");
}
