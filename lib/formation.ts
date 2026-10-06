import type { Role } from "./db";

/**
 * Un tuteur en formation (06/10/2026, question 104, choix b). Un code de
 * tutorat relié à un identifiant d'agent (question 99) donne au tuteur une
 * bascule : « formateur », sa session de tutorat, inchangée — rien ne s'y
 * enregistre sous l'identifiant ; « en formation », une session de poste de
 * l'agent du code, où il saisit son code personnel comme tout agent relié, et
 * où ses lectures, entraînements et évaluations se conservent sous son
 * identifiant, son parcours s'appliquant. La bascule ne change ni l'ouverture
 * ni l'échéance de la session (`remplacerSession`) et détache l'agent dans les
 * deux sens : le code personnel est redemandé en formation.
 *
 * Les tuteurs sont supervisés par les pharmaciens : le parcours et le code
 * personnel d'un identifiant relié à un code de tutorat relèvent d'un code
 * d'administration, et ses rapports ne se visent ni ne s'arbitrent par un
 * tuteur ; nul ne vise ou n'arbitre un rapport de son propre identifiant.
 *
 * Règles pures, testées à part ; `lib/auth.ts` porte la session,
 * `app/actions-formation.ts` la bascule.
 */

/** Identité du formateur, mise de côté pendant la formation et rétablie au retour. */
export interface IdentiteFormateur {
  role: "tuteur";
  libelle: string;
}

interface SessionMinimale {
  role: Role;
  libelle: string;
  essai?: unknown;
  formation?: IdentiteFormateur;
}

/**
 * Session « en formation » : rôle de poste, même code, même libellé, même
 * filière et même niveau — ceux du code de tutorat —, identité du formateur
 * mise de côté. Null hors d'une session de tutorat dont le code est relié, en
 * mode test, ou déjà en formation.
 */
export function sessionEnFormation<S extends SessionMinimale>(s: S, agentDuCode: unknown): S | null {
  if (s.role !== "tuteur" || s.essai || s.formation || !agentDuCode) return null;
  return { ...s, role: "poste", formation: { role: "tuteur", libelle: s.libelle } };
}

/** Retour au tutorat : l'identité du formateur revient. Null hors formation. */
export function sessionFormateur<S extends SessionMinimale>(s: S): S | null {
  if (!s.formation) return null;
  const { formation, ...reste } = s;
  return { ...reste, role: formation.role, libelle: formation.libelle } as S;
}

export type EtatBascule = "formateur" | "formation";

/**
 * État de la bascule à montrer : « formation » dans une session en formation,
 * « formateur » dans une session de tutorat dont le code est relié ; null
 * ailleurs — poste, administration, mode test, code de tutorat non relié.
 */
export function etatBascule(s: SessionMinimale | null, codeRelie: boolean): EtatBascule | null {
  if (!s) return null;
  if (s.formation) return "formation";
  return s.role === "tuteur" && !s.essai && codeRelie ? "formateur" : null;
}

/**
 * Qui agit sur l'identifiant d'un agent — parcours, code personnel : le
 * tutorat ou l'administration ; sur celui d'un tuteur (identifiant relié à un
 * code de tutorat), l'administration seule.
 */
export function supervisionAdmise(role: Role, agentTuteur: boolean): boolean {
  return agentTuteur ? role === "admin" : role === "admin" || role === "tuteur";
}

export type RefusVisa = "propre-rapport" | "tuteur-supervise";

/**
 * Visa ou arbitrage d'un rapport : refusé à la session dont le code est relié
 * à l'identifiant du rapport (nul ne vise son propre rapport), et à un tuteur
 * sur le rapport d'un tuteur (supervision par les pharmaciens). `codes` : les
 * codes reliés à l'identifiant du rapport. Null : rien ne s'y oppose ici.
 */
export function refusVisa(
  session: { role: Role; acces: number | null },
  codes: readonly { id: number; role: Role }[],
): RefusVisa | null {
  if (session.acces !== null && codes.some((c) => c.id === session.acces)) return "propre-rapport";
  if (session.role !== "admin" && codes.some((c) => c.role === "tuteur")) return "tuteur-supervise";
  return null;
}
