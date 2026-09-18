import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { baseConfiguree, codesActifs, lireEtatAcces, marquerUsage, type Role } from "./db";
import { etatDeSession, type EtatAcces } from "./session-etat";
import { effacerEchecs, enregistrerEchec, minutesDeBlocage } from "./limiteur";
import { SECRET_DEVELOPPEMENT } from "./jeton-web";

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
 * et une échéance. Aucun nom, aucun identifiant de personne. Dès qu'une base
 * est configurée, la session est liée à son code d'accès (décision du
 * 18/09/2026, question 16, choix b) : révoquer ou supprimer le code la ferme
 * à la requête suivante.
 */

export type { Role };

export interface Session {
  role: Role;
  /** Libellé du profil, p. ex. « Poste isolateur A ». Jamais un nom d'agent. */
  libelle: string;
  filiere: string | null;
  niveau: string | null;
  /**
   * Identifiant du code d'accès qui a ouvert la session : la session vaut
   * tant que ce code existe, reste actif et n'a pas été révoqué depuis ;
   * sert aussi à retrouver la signature déposée par un pharmacien (code
   * admin). Une session sans lui est fermée dès qu'une base est configurée.
   */
  acces?: number | null;
  /** Ouverture, en secondes epoch : une révocation postérieure ferme la session. */
  debut?: number;
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
  return SECRET_DEVELOPPEMENT;
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

/** Jeton signé (HMAC, secret du site) portant une charge à échéance — sessions et rattachements. */
export function encoderJeton<T extends { exp: number }>(v: T): string {
  const charge = Buffer.from(JSON.stringify(v)).toString("base64url");
  return `${charge}.${signer(charge)}`;
}

export function decoderJeton<T extends { exp: number }>(jeton: string): T | null {
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
    const s = JSON.parse(Buffer.from(charge, "base64url").toString()) as T;
    if (typeof s.exp !== "number" || s.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return s;
  } catch {
    return null;
  }
}

function encoder(s: Session): string {
  return encoderJeton(s);
}

function decoder(jeton: string): Session | null {
  return decoderJeton<Session>(jeton);
}

const etatAcces = cache((id: number): Promise<EtatAcces | null> => lireEtatAcces(id));

export interface EtatSession {
  session: Session | null;
  /** Cookie signé et non expiré, mais code révoqué, remplacé ou supprimé depuis. */
  fermee: boolean;
}

/**
 * Session liée à son code (décision du 18/09/2026, question 16, choix b) :
 * dès qu'une base est configurée, la signature du cookie ne suffit plus ; le
 * code qui a ouvert la session doit exister encore, être actif et n'avoir pas
 * été révoqué depuis. Le filtre d'entrée (`middleware.ts`), sans base, ne
 * vérifie que la signature ; pages, actions et API passent par ici. Une base
 * injoignable n'est jamais prise pour une session fermée : l'erreur remonte.
 * La lecture du code est mémorisée le temps d'une requête.
 */
export async function etatSession(): Promise<EtatSession> {
  const jeton = (await cookies()).get(COOKIE)?.value;
  const decodee = jeton ? decoder(jeton) : null;
  if (!decodee || !baseConfiguree()) return etatDeSession(decodee, baseConfiguree(), undefined);
  const acces = decodee.acces ? await etatAcces(decodee.acces) : undefined;
  return etatDeSession(decodee, true, acces);
}

export async function getSession(): Promise<Session | null> {
  return (await etatSession()).session;
}

export async function ouvrirSession(s: Omit<Session, "exp">): Promise<void> {
  const session: Session = {
    ...s,
    debut: Date.now() / 1000,
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
  | { ok: false; raison: "non-configure" | "code-invalide" | "bloque"; minutes?: number };

/**
 * Connexion par code. Les échecs sont comptés par adresse (empreinte salée,
 * jamais l'adresse en clair) : cinq échecs bloquent un quart d'heure.
 */
export async function connecter(code: string): Promise<ResultatConnexion> {
  if (!baseConfiguree()) return { ok: false, raison: "non-configure" };
  const minutes = await minutesDeBlocage();
  if (minutes > 0) return { ok: false, raison: "bloque", minutes };
  const propre = code.trim().toUpperCase().replace(/\s+/g, "");
  const lignes = await codesActifs();
  for (const l of lignes) {
    if (verifierCode(propre, l.code_hash)) {
      await marquerUsage(l.id);
      await effacerEchecs();
      return {
        ok: true,
        session: {
          role: l.role,
          libelle: l.libelle,
          filiere: l.filiere,
          niveau: l.niveau,
          acces: l.id,
        },
      };
    }
  }
  await enregistrerEchec();
  return { ok: false, raison: "code-invalide" };
}

// ──────────────────────────────────────────────────────────── habilitations

const RANG: Record<Role, number> = { poste: 0, tuteur: 1, admin: 2 };

export function auMoins(role: Role, minimum: Role): boolean {
  return RANG[role] >= RANG[minimum];
}

/**
 * Session exigée dans une action ou une page : redirige vers la connexion
 * sans session, vers l'accueil si le rôle est insuffisant. La protection ne
 * repose jamais sur le fait qu'un écran soit affiché ou non.
 */
export async function sessionRequise(minimum: Role): Promise<Session> {
  const { session: s, fermee } = await etatSession();
  if (!s) redirect(fermee ? "/connexion?erreur=session-fermee" : "/connexion");
  if (!auMoins(s.role, minimum)) redirect("/");
  return s;
}

/**
 * Porte des routes d'API ouvertes à tout rôle : refus 401 dès qu'une base est
 * configurée et qu'aucune session valide n'accompagne l'appel — le filtre
 * d'entrée a laissé passer la signature, la base dit si le code tient encore.
 * Sans base (mode ouvert), rien n'est refusé.
 */
export async function refusApiSansSession(): Promise<NextResponse | null> {
  if (!baseConfiguree()) return null;
  const { session, fermee } = await etatSession();
  if (session) return null;
  return NextResponse.json(
    { erreur: fermee ? "Session fermée : le code d'accès a été retiré." : "Session requise." },
    { status: 401, headers: { "Cache-Control": "no-store" } },
  );
}

export const LIBELLES_ROLE: Record<Role, string> = {
  admin: "Administration",
  tuteur: "Tutorat",
  poste: "Poste de travail",
};

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
