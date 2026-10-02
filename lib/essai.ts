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
  vues?: MemoireVues;
}

/**
 * Interrupteur de la vue apprenant (02/10/2026, question 94, choix a) : un
 * administrateur passe de sa vue à celle de l'apprenant test, et en revient,
 * d'un clic. Chaque vue reprend là où on l'a quittée : la session garde la page
 * quittée de chaque côté et le profil de l'apprenant, choisi une fois. Le test
 * et sa fin les recopient tels quels : ils valent jusqu'à la fin de la session.
 */
export interface MemoireVues {
  /** Page d'administration quittée pour la vue apprenant. */
  admin?: string;
  /** Page de l'apprenant quittée pour revenir à l'administration. */
  apprenant?: string;
  /** Profil de l'apprenant test, rouvert au retour ; null : choisi à l'écran. */
  filiere?: string | null;
  niveau?: string | null;
}

/**
 * Profil choisi au départ du test (24/09/2026) : le programme s'ouvre sur
 * cette filière et ce niveau, et le niveau devient le niveau cible des
 * évaluations, comme avec un code de poste. Null : choisis à l'écran.
 */
export interface ProfilEssai {
  filiere: string | null;
  niveau: string | null;
}

/**
 * Session d'essai : vue d'apprenant (rôle de poste ; filière et niveau du
 * profil choisi, sinon choisis à l'écran comme le ferait un agent). Null pour
 * un poste ou une session déjà en test. Ouverture et échéance ne changent pas.
 */
export function sessionDEssai<S extends SessionMinimale>(
  s: S,
  profil: ProfilEssai = { filiere: null, niveau: null },
): S | null {
  if (s.essai || s.role === "poste") return null;
  return {
    ...s,
    role: "poste",
    libelle: LIBELLE_ESSAI,
    filiere: profil.filiere,
    niveau: profil.niveau,
    essai: { role: s.role, libelle: s.libelle, filiere: s.filiere, niveau: s.niveau },
  };
}

/** Fin du test : l'identité du testeur revient. Null hors test. */
export function sessionRetablie<S extends SessionMinimale>(s: S): S | null {
  if (!s.essai) return null;
  const { essai, ...reste } = s;
  return { ...reste, role: essai.role, libelle: essai.libelle, filiere: essai.filiere, niveau: essai.niveau } as S;
}

/** Au-delà, une adresse n'est gardée que par son chemin : la session est un cookie. */
const ADRESSE_MAX = 600;

/**
 * Une adresse du site — chemin, paramètres, ancre —, jamais une adresse
 * externe (`//hôte`, `/\hôte`) ni un caractère hors de l'ASCII imprimable ;
 * trop longue, son seul chemin. Null sinon.
 */
export function adresseDuSite(brut: unknown): string | null {
  if (typeof brut !== "string" || !/^\/(?![/\\])[\x21-\x5b\x5d-\x7e]*$/.test(brut)) return null;
  if (brut.length <= ADRESSE_MAX) return brut;
  const chemin = brut.split(/[?#]/)[0];
  return chemin.length <= ADRESSE_MAX ? chemin : null;
}

/** Filières de poste (le socle n'en est pas une) et niveaux du référentiel servi. */
export interface ProfilsConnus {
  filieres: readonly string[];
  niveaux: readonly string[];
}

/** Filière et niveau s'ils sont connus du référentiel ; null chacun sinon (choisi à l'écran). */
function profilConnu(filiere: unknown, niveau: unknown, connus: ProfilsConnus): ProfilEssai {
  return {
    filiere: typeof filiere === "string" && connus.filieres.includes(filiere) ? filiere : null,
    niveau: typeof niveau === "string" && connus.niveaux.includes(niveau) ? niveau : null,
  };
}

/** Le profil que porte une adresse (`?filiere=…&niveau=…`, question 55) : les deux connus, ou aucun. */
function profilDeLAdresse(adresse: string, connus: ProfilsConnus): ProfilEssai | null {
  const p = new URL(adresse, "http://site.invalid").searchParams;
  const profil = profilConnu(p.get("filiere"), p.get("niveau"), connus);
  return profil.filiere && profil.niveau ? profil : null;
}

/**
 * La page, sans son ancre : l'action rend la vue d'arrivée par une redirection, que Next applique sans
 * l'ancre ; l'interrupteur la montre depuis le haut (`components/InterrupteurVue.tsx`).
 */
function sansAncre(adresse: string | null): string | null {
  return adresse === null ? null : adresse.split("#")[0];
}

/** L'adresse sans filière ni niveau : au retour, la session porte le profil. */
function sansProfil(adresse: string): string {
  const u = new URL(adresse, "http://site.invalid");
  u.searchParams.delete("filiere");
  u.searchParams.delete("niveau");
  return `${u.pathname}${u.search}`;
}

/** Ce que l'interrupteur envoie au clic (`components/InterrupteurVue.tsx`). */
export interface DemandeBascule {
  /** Page affichée. */
  ici: unknown;
  /**
   * Profil affiché par le programme de l'apprenant (« Composer le programme »),
   * quand il est à l'écran : choisi là, il n'est pas dans l'adresse.
   */
  ecran?: { filiere: unknown; niveau: unknown } | null;
}

/**
 * Un clic sur l'interrupteur de la vue apprenant (question 94, choix a) : la
 * session de l'autre vue et la page où la reprendre. Null hors administration —
 * le tutorat teste par la page « Tester en apprenant ».
 *
 * - Vers l'apprenant : la page d'administration quittée est gardée ; le test
 *   s'ouvre sur le profil gardé, à la page gardée, sinon sur le programme
 *   (« / »), profil à choisir à l'écran.
 * - Vers l'administration : sont gardés la page de l'apprenant et le profil
 *   qu'elle affichait — celui du programme s'il est à l'écran (l'adresse perd
 *   alors le sien, qui pourrait le contredire), sinon celui de l'adresse,
 *   sinon celui du test.
 *
 * Une page est gardée sans son ancre : on reprend la page, pas l'endroit de
 * la page.
 *
 * Un profil gardé que le référentiel ne connaît plus redevient « à choisir à
 * l'écran ». Ouverture et échéance ne changent pas (`sessionDEssai`).
 */
export function basculerVue<S extends SessionMinimale>(
  s: S,
  demande: DemandeBascule,
  connus: ProfilsConnus,
): { session: S; cible: string } | null {
  const ici = sansAncre(adresseDuSite(demande.ici));
  const vues = s.vues ?? {};
  if (s.essai) {
    if (s.essai.role !== "admin") return null;
    const retablie = sessionRetablie(s);
    if (!retablie) return null;
    const affiche = demande.ecran
      ? profilConnu(demande.ecran.filiere, demande.ecran.niveau, connus)
      : ((ici ? profilDeLAdresse(ici, connus) : null) ?? { filiere: s.filiere, niveau: s.niveau });
    const apprenant = ici ? (demande.ecran ? sansProfil(ici) : ici) : vues.apprenant;
    return {
      session: { ...retablie, vues: { ...vues, apprenant, filiere: affiche.filiere, niveau: affiche.niveau } },
      cible: adresseDuSite(vues.admin) ?? "/accueil",
    };
  }
  if (s.role !== "admin") return null;
  const essai = sessionDEssai({ ...s, vues: { ...vues, admin: ici ?? vues.admin } }, profilConnu(vues.filiere, vues.niveau, connus));
  return essai ? { session: essai, cible: adresseDuSite(vues.apprenant) ?? "/" } : null;
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
