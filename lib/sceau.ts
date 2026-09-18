import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/**
 * Sceau d'un résultat d'évaluation.
 *
 * Le résultat est calculé par le serveur puis détenu par le navigateur, en
 * mémoire de l'onglet, jusqu'à ce que l'apprenant émette son rapport. Pour
 * qu'un résultat enregistré soit bien celui que le serveur a corrigé — et non
 * une version retouchée dans le navigateur —, le serveur le signe (HMAC sur
 * sa forme canonique) à la correction et vérifie la signature à l'émission.
 *
 * L'empreinte (SHA-256 de la forme canonique) est ce qui figure sur le rapport
 * et dans chaque visa : elle atteste que ce qui est signé est ce qui a été émis.
 */

function secret(): string {
  const s = process.env.AUTH_SECRET;
  return s && s.length >= 16 ? s : "developpement-non-securise-definir-AUTH_SECRET";
}

/** JSON à clés triées, indépendant de l'ordre d'insertion. */
export function canonique(valeur: unknown): string {
  return JSON.stringify(trier(valeur));
}

function trier(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(trier);
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(o)
        .sort()
        .filter((k) => o[k] !== undefined)
        .map((k) => [k, trier(o[k])]),
    );
  }
  return v;
}

export function sceller(valeur: unknown): string {
  return createHmac("sha256", secret()).update(canonique(valeur)).digest("base64url");
}

export function sceauValide(valeur: unknown, sceau: string): boolean {
  const attendu = sceller(valeur);
  if (attendu.length !== sceau.length) return false;
  return timingSafeEqual(Buffer.from(attendu), Buffer.from(sceau));
}

export function empreinte(valeur: unknown): string {
  return createHash("sha256").update(canonique(valeur)).digest("hex");
}
