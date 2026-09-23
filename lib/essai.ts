import type { Role } from "./db";

/**
 * Mode test (23/09/2026, choix a) : un tuteur ou un administrateur parcourt le
 * site comme un apprenant, sous « Utilisateur test », jusqu'au rapport émis,
 * sans rien écrire en base. Règles pures, testées ; la session est posée par
 * `lib/auth.ts`, et chaque écriture est neutralisée là où elle se fait.
 */

export const LIBELLE_ESSAI = "Utilisateur test";
/** Identifiant porté par le rapport d'essai, à la place d'un identifiant d'agent. */
export const IDENTIFIANT_ESSAI = "ESSAI";
export const MENTION_ESSAI = "ESSAI — sans valeur de preuve";

/** Identité du testeur, mise de côté pendant le test et rétablie à la fin. */
export interface IdentiteTesteur {
  role: Extract<Role, "tuteur" | "admin">;
  libelle: string;
  filiere: string | null;
  niveau: string | null;
}

interface SessionMinimale {
  role: Role;
  libelle: string;
  filiere: string | null;
  niveau: string | null;
  essai?: IdentiteTesteur;
}

/**
 * Session d'essai : vue d'apprenant (rôle de poste, sans filière ni niveau,
 * choisis à l'écran comme le ferait un agent). Null pour un poste ou une
 * session déjà en test. Ouverture et échéance ne changent pas.
 */
export function sessionDEssai<S extends SessionMinimale>(s: S): S | null {
  if (s.essai || s.role === "poste") return null;
  return {
    ...s,
    role: "poste",
    libelle: LIBELLE_ESSAI,
    filiere: null,
    niveau: null,
    essai: { role: s.role, libelle: s.libelle, filiere: s.filiere, niveau: s.niveau },
  };
}

/** Fin du test : l'identité du testeur revient. Null hors test. */
export function sessionRetablie<S extends SessionMinimale>(s: S): S | null {
  if (!s.essai) return null;
  const { essai, ...reste } = s;
  return { ...reste, role: essai.role, libelle: essai.libelle, filiere: essai.filiere, niveau: essai.niveau } as S;
}

/**
 * Numéro d'un rapport d'essai : hors de la séquence RAP (aucun numéro
 * consommé), daté à la seconde, heure de Paris — ESSAI-AAAAMMJJ-HHMMSS.
 */
export function numeroEssai(d: Date): string {
  const parties = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const v = (t: Intl.DateTimeFormatPartTypes) => parties.find((x) => x.type === t)?.value ?? "00";
  return `${IDENTIFIANT_ESSAI}-${v("year")}${v("month")}${v("day")}-${v("hour")}${v("minute")}${v("second")}`;
}
