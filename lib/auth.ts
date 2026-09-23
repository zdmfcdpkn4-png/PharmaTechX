import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import {
  baseConfiguree,
  codesActifs,
  lireEtatAcces,
  lireHachageAcces,
  marquerUsage,
  type Role,
} from "./db";
import { etatDeSession, type EtatAcces } from "./session-etat";
import { inactif, type Activite } from "./inactivite";
import { effacerEchecs, enregistrerEchec, minutesDeBlocage } from "./limiteur";
import { SECRET_DEVELOPPEMENT } from "./jeton-web";
import { genererCode, hacherCode, normaliserCode, verifierCode } from "./codes";
import type { IdentiteTesteur } from "./essai";

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
  /**
   * Quatre heures sans activité (23/09/2026, `lib/inactivite.ts`) : identifiant
   * aléatoire auquel se lie le cookie d'activité, et activité connue à
   * l'ouverture. Sans eux (session d'avant cette version), l'ouverture fait
   * foi.
   */
  sid?: string;
  vu?: number;
  /** Échéance, en secondes epoch. */
  exp: number;
  /**
   * Mode test (23/09/2026) : identité du tuteur ou de l'administrateur qui
   * parcourt le site en apprenant, rétablie à la fin du test (`lib/essai.ts`).
   */
  essai?: IdentiteTesteur;
}

const COOKIE = "fp_session";
const COOKIE_ACTIVITE = "fp_activite";
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

// Fabrication et hachage des codes : `lib/codes.ts`, réexporté ici pour que
// les appelants continuent de s'adresser à un seul module.
export { genererCode, hacherCode, normaliserCode, verifierCode };

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
  const signee = jeton ? decoder(jeton) : null;
  // Quatre heures sans activité : le filtre d'entrée l'a refusée avec son
  // motif ; ici, à la seconde près, elle ne vaut simplement plus.
  const decodee = signee && !inactif(signee, await lireActivite()) ? signee : null;
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
    sid: nouveauSid(),
    vu: Math.floor(Date.now() / 1000),
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

/**
 * Remplace la session en cours sans en changer l'ouverture ni l'échéance
 * (mode test, 23/09/2026) : une révocation du code postérieure à l'ouverture
 * doit toujours fermer la session, et entrer en test ne prolonge rien.
 */
export async function remplacerSession(s: Session): Promise<void> {
  const reste = s.exp - Math.floor(Date.now() / 1000);
  if (reste <= 0) return fermerSession();
  (await cookies()).set(COOKIE, encoder(s), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: reste,
  });
}

// ──────────────────────────────────────────────── activité (quatre heures)

/** Identifiant aléatoire d'une session ou d'un rattachement, auquel l'activité se lie. */
export function nouveauSid(): string {
  return randomBytes(12).toString("base64url");
}

/** Cookie d'activité, signé : dernière activité et jetons qu'elle entretient. Null s'il manque ou ne vaut rien. */
export async function lireActivite(): Promise<Activite | null> {
  const jeton = (await cookies()).get(COOKIE_ACTIVITE)?.value;
  return jeton ? decoderJeton<Activite & { exp: number }>(jeton) : null;
}

/**
 * Note l'activité de l'utilisateur pour les jetons nommés — session et, s'il
 * vaut, rattachement. Seul ce cookie est écrit : réécrire la session ou le
 * rattachement ici pourrait rétablir ce qu'un « quitter » ou un « Se
 * détacher » concurrent vient d'effacer (`lib/inactivite.ts`).
 */
export async function noterActivite(sids: (string | undefined)[]): Promise<void> {
  const maintenant = Math.floor(Date.now() / 1000);
  const liste = sids.filter((x): x is string => typeof x === "string" && x.length > 0);
  (await cookies()).set(
    COOKIE_ACTIVITE,
    encoderJeton({ vu: maintenant, sids: liste, exp: maintenant + DUREE_HEURES * 3600 }),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: DUREE_HEURES * 3600,
    },
  );
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
  const propre = normaliserCode(code);
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

// ───────────────────────────────────────────── confirmation d'un acte grave

export type Confirmation = "ok" | "code-invalide" | "bloque" | "indisponible";

/**
 * Ré-authentification au moment d'un acte irréversible : le porteur de la
 * session retape le code qui l'a ouverte.
 *
 * Une session d'administration ouverte est, en zone, une session laissée sur
 * une tablette : le rôle dit ce qu'on a le droit de faire, il ne dit pas qui
 * est devant l'écran. La confirmation le demande.
 *
 * Le code est comparé à l'empreinte du code de la session — pas à n'importe
 * quel code d'administration : confirmer, c'est prouver que l'on est bien le
 * porteur de cette session-là. Les échecs passent par le limiteur de la
 * connexion, sans quoi la même devinette serait comptée d'un côté et libre de
 * l'autre ; une confirmation juste efface le compteur, comme une connexion.
 */
export async function confirmerCodeDeSession(
  s: Session,
  saisi: string,
): Promise<Confirmation> {
  if (!baseConfiguree() || !s.acces) return "indisponible";
  if ((await minutesDeBlocage()) > 0) return "bloque";
  const hache = await lireHachageAcces(s.acces);
  if (!hache) return "indisponible";
  if (!verifierCode(normaliserCode(saisi), hache)) {
    await enregistrerEchec();
    return "code-invalide";
  }
  await effacerEchecs();
  return "ok";
}

export type ConfirmationTutorat =
  | { ok: true; role: "tuteur" | "admin"; libelle: string }
  | { ok: false; raison: "code-invalide" | "bloque" | "indisponible" | "meme-code"; minutes?: number };

/**
 * Jugement d'un schéma à découvrir (décision du 22/09/2026, question 52,
 * choix b) : le tuteur, assis à côté de l'apprenant, confirme ses jugements
 * en tapant **son** code sur le poste de l'apprenant.
 *
 * À la différence de `confirmerCodeDeSession`, le code attendu n'est pas
 * celui de la session — c'est celui de l'apprenant, ou du poste : c'est
 * n'importe quel code actif de tutorat ou d'administration, sauf celui qui a
 * ouvert la session, qui jugerait sa propre évaluation. Un code de poste ne
 * juge pas. Les échecs passent par le limiteur de la connexion : sans cela,
 * ce champ servirait à deviner les codes de tutorat sans limite. Une saisie
 * vide n'est pas une devinette et n'est pas comptée.
 *
 * Le code prouve qu'il a été tapé, pas que le tuteur a regardé : c'est la
 * limite assumée du choix b, écrite dans `docs/DECISIONS.md`.
 */
export async function confirmerCodeDeTutorat(s: Session | null, saisi: string): Promise<ConfirmationTutorat> {
  if (!baseConfiguree()) return { ok: false, raison: "indisponible" };
  const minutes = await minutesDeBlocage();
  if (minutes > 0) return { ok: false, raison: "bloque", minutes };
  const propre = normaliserCode(saisi);
  if (!propre) return { ok: false, raison: "code-invalide" };
  const lignes = (await codesActifs()).filter((l) => l.role === "tuteur" || l.role === "admin");
  for (const l of lignes) {
    if (!verifierCode(propre, l.code_hash)) continue;
    if (s?.acces && s.acces === l.id) return { ok: false, raison: "meme-code" };
    await effacerEchecs();
    return { ok: true, role: l.role as "tuteur" | "admin", libelle: l.libelle };
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
