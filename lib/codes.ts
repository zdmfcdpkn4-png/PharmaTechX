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

/**
 * Types de profil d'un code d'accès (02/10/2026, question 95, choix a) : le libellé n'est plus
 * saisi. On choisit le type, et le site nomme le code TYPE-n, au premier numéro jamais donné pour
 * ce type, à partir de 0 — PHARMACIEN-0, PHARMACIEN-1, PREPARATEUR-0… Plus de champ libre où
 * glisser un nom. Liste fermée, celle de la demande ; ce que son « … » laissait ouvert est la
 * question 96.
 */
export const TYPES_CODE = [
  { id: "PHARMACIEN", libelle: "Pharmacien" },
  { id: "PREPARATEUR", libelle: "Préparateur" },
  { id: "OPQ", libelle: "OPQ" },
  { id: "ASH", libelle: "ASH" },
] as const;

export type TypeCode = (typeof TYPES_CODE)[number]["id"];

/** Le type envoyé par le formulaire, s'il est de la liste, casse comprise ; null sinon. */
export function lireTypeCode(brut: unknown): TypeCode | null {
  return TYPES_CODE.find((t) => t.id === brut)?.id ?? null;
}

/** Nom d'un code : son type et son numéro. */
export function libelleDuCode(type: TypeCode, numero: number): string {
  return `${type}-${numero}`;
}

/**
 * Motif des libellés au format d'un type, numéro capturé : lu par PostgreSQL (sans tenir compte
 * de la casse) pour qu'un nom venu d'ailleurs — un code renommé dans la base — ne soit pas redonné.
 */
export function motifLibelle(type: TypeCode): string {
  return `^${type}-([0-9]{1,9})$`;
}
