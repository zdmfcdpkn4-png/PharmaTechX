/**
 * Vérification d'un jeton signé (session de rôle) avec les seules API Web :
 * ce module sert au middleware, qui tourne hors de Node, et à `lib/auth.ts`
 * pour le secret de repli. Même format que `encoderJeton` : charge en
 * base64url, point, signature HMAC-SHA-256 en base64url.
 */

/** Sans AUTH_SECRET : les sessions ne survivent pas à un redéploiement, et c'est voulu. */
export const SECRET_DEVELOPPEMENT = "developpement-non-securise-definir-AUTH_SECRET";

export function secretEffectif(env: string | undefined): string {
  return env && env.length >= 16 ? env : SECRET_DEVELOPPEMENT;
}

function base64url(octets: Uint8Array): string {
  let s = "";
  for (const b of octets) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function signerWeb(charge: string, secret: string): Promise<string> {
  const cle = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", cle, new TextEncoder().encode(charge));
  return base64url(new Uint8Array(sig));
}

/** Comparaison à temps constant sur la longueur commune. */
function egal(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

/**
 * Charge d'un jeton à la signature exacte et à l'échéance non passée ; null
 * sinon. Seuls les nombres et les chaînes ASCII s'y lisent sûrement : `atob`
 * rend des octets, pas de l'UTF-8, et un libellé accentué en sort altéré —
 * le filtre d'entrée n'y lit que l'échéance et l'activité.
 */
export async function lireJetonWeb(
  jeton: string,
  secretEnv: string | undefined,
  maintenant = Date.now(),
): Promise<Record<string, unknown> | null> {
  const [charge, sig, ...reste] = jeton.split(".");
  if (!charge || !sig || reste.length > 0) return null;
  const attendue = await signerWeb(charge, secretEffectif(secretEnv));
  if (!egal(sig, attendue)) return null;
  try {
    const s = JSON.parse(atob(charge.replace(/-/g, "+").replace(/_/g, "/"))) as Record<string, unknown>;
    return typeof s.exp === "number" && s.exp >= Math.floor(maintenant / 1000) ? s : null;
  } catch {
    return null;
  }
}

/** Signature exacte et échéance non passée. */
export async function jetonValide(jeton: string, secretEnv: string | undefined, maintenant = Date.now()): Promise<boolean> {
  return (await lireJetonWeb(jeton, secretEnv, maintenant)) !== null;
}
