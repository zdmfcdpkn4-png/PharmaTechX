import "server-only";
import { cookies } from "next/headers";
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { baseConfiguree, codesActifs, marquerUsage, type Role } from "./db";

/**
 * Contrôle d'accès par rôle.
 *
 * Trois rôles, et rien qui désigne une personne :
 *   - `admin`  : gestion complète du site et des dépôts
 *   - `tuteur` : dépôts, ordonnancement des modules, gestion des codes de poste
 *   - `poste`  : un code par profil de poste, créé par un admin ou un tuteur
 *
 * Les codes sont stockés hachés (scrypt, sel par code) : la base ne permet pas
 * de les relire. Perdu, un code se remplace, il ne se retrouve pas.
 *
 * La session est un cookie signé HMAC contenant le rôle, le libellé du profil
 * et une échéance. Aucun nom, aucun identifiant de personne.
 */

export type { Role };

export interface Session {
  role: Role;
  /** Libellé du profil, p. ex. « Poste isolateur A ». Jamais un nom d'agent. */
  libelle: string;
  filiere: string | null;
  niveau: string | null;
  /** Échéance, en secondes epoch. */
  exp: number;
}

const COOKIE = "fp_session";
const DUREE_HEURES = 12;

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (s && s.length >= 16) return s;
  // Sans secret configuré, les sessions ne survivent pas à un redéploiement.
  // C'est volontairement bruyant : le contrôle d'accès n'est pas encore sûr.
  return "developpement-non-securise-definir-AUTH_SECRET";
}

export function secretConfigure(): boolean {
  return Boolean(process.env.AUTH_SECRET && process.env.AUTH_SECRET.length >= 16);
}

// ───────────────────────────────────────────────────────── hachage des codes

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

// ──────────────────────────────────────────────────────────────── sessions

function signer(charge: string): string {
  return createHmac("sha256", secret()).update(charge).digest("base64url");
}

function encoder(s: Session): string {
  const charge = Buffer.from(JSON.stringify(s)).toString("base64url");
  return `${charge}.${signer(charge)}`;
}

function decoder(jeton: string): Session | null {
  const [charge, sig] = jeton.split(".");
  if (!charge || !sig) return null;
  const attendue = signer(charge);
  if (
    sig.length !== attendue.length ||
    !timingSafeEqual(Buffer.from(sig), Buffer.from(attendue))
  ) {
    return null;
  }
  try {
    const s = JSON.parse(Buffer.from(charge, "base64url").toString()) as Session;
    if (typeof s.exp !== "number" || s.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return s;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<Session | null> {
  const jeton = (await cookies()).get(COOKIE)?.value;
  return jeton ? decoder(jeton) : null;
}

export async function ouvrirSession(s: Omit<Session, "exp">): Promise<void> {
  const session: Session = {
    ...s,
    exp: Math.floor(Date.now() / 1000) + DUREE_HEURES * 3600,
  };
  (await cookies()).set(COOKIE, encoder(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: DUREE_HEURES * 3600,
  });
}

export async function fermerSession(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

// ────────────────────────────────────────────────────────────── connexion

export type ResultatConnexion =
  | { ok: true; session: Omit<Session, "exp"> }
  | { ok: false; raison: "non-configure" | "code-invalide" };

export async function connecter(code: string): Promise<ResultatConnexion> {
  if (!baseConfiguree()) return { ok: false, raison: "non-configure" };
  const propre = code.trim().toUpperCase().replace(/\s+/g, "");
  const lignes = await codesActifs();
  for (const l of lignes) {
    if (verifierCode(propre, l.code_hash)) {
      await marquerUsage(l.id);
      return {
        ok: true,
        session: {
          role: l.role,
          libelle: l.libelle,
          filiere: l.filiere,
          niveau: l.niveau,
        },
      };
    }
  }
  return { ok: false, raison: "code-invalide" };
}

// ──────────────────────────────────────────────────────────── habilitations

const RANG: Record<Role, number> = { poste: 0, tuteur: 1, admin: 2 };

export function auMoins(role: Role, minimum: Role): boolean {
  return RANG[role] >= RANG[minimum];
}

/** Qui peut créer ou révoquer un code d'un rôle donné. */
export function peutGererRole(acteur: Role, cible: Role): boolean {
  if (acteur === "admin") return true;
  // Le tuteur ne gère que les accès de poste, jamais admin ni tuteur.
  if (acteur === "tuteur") return cible === "poste";
  return false;
}

/**
 * Tant qu'aucune base n'est configurée, le site reste ouvert et signale que le
 * contrôle d'accès est inactif. Une fois la base en place, l'accès est requis.
 */
export async function sessionOuAcccesLibre(): Promise<Session | "libre" | null> {
  if (!baseConfiguree()) return "libre";
  return await getSession();
}
