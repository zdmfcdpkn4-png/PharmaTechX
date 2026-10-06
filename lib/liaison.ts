import { normaliserIdentifiant } from "./identifiant";

/**
 * Code de poste relié à un identifiant d'agent (question 99, choix a, 05/10/2026).
 *
 * Un code de poste peut porter l'identifiant de l'agent à qui il est remis :
 * connecté par ce code, l'agent ne saisit plus que son code personnel, choisi
 * par lui la première fois et connu de lui seul. Un code sans agent reste
 * partagé : chaque agent y saisit son identifiant, comme avant (question 11,
 * choix c). Depuis le 06/10/2026 (question 104, choix b), un code de tutorat
 * se relie aussi : le tuteur y suit sa propre formation par la bascule « En
 * formation » (`lib/formation.ts`). Règles pures, sans base ni Next, testées
 * à part ; les actions et `lib/progression.ts` les appliquent.
 */

/** Valeur de la case du formulaire de création : créer l'identifiant suivant et le relier au code. */
export const CREER_ET_RELIER = "nouveau";

export type RefusLiaison = "role" | "agent-inconnu" | "agent-clos";

/**
 * Un code de poste ou de tutorat se relie, et seulement à un identifiant
 * actif : un code d'administration n'ouvre pas de progression, et un
 * identifiant clos n'en reçoit plus. `null` : la liaison est admise.
 */
export function refusLiaison(
  role: "admin" | "tuteur" | "poste",
  agent: { actif: boolean } | null,
): RefusLiaison | null {
  if (role === "admin") return "role";
  if (!agent) return "agent-inconnu";
  if (!agent.actif) return "agent-clos";
  return null;
}

/**
 * Champ « agent » du formulaire d'un code : vide, le code est délié ; sinon un
 * identifiant au format AG-001. `null` : saisie illisible.
 */
export function lireChoixAgent(brut: unknown): { identifiant: string | null } | null {
  const v = typeof brut === "string" ? brut.trim() : "";
  if (!v) return { identifiant: null };
  const identifiant = normaliserIdentifiant(v);
  return identifiant ? { identifiant } : null;
}

/**
 * Identifiant auquel rattacher la progression. Sous un code relié, c'est celui
 * du code : la saisie peut manquer, ou le redire ; tout autre identifiant est
 * refusé. Sous un code partagé, c'est la saisie, au format AG-001.
 */
export function identifiantARattacher(
  relie: string | null,
  saisie: string,
): { identifiant: string } | { refus: "format" | "autre-agent" } {
  const brut = saisie.trim();
  const lu = brut ? normaliserIdentifiant(brut) : null;
  if (relie) return brut && lu !== relie ? { refus: "autre-agent" } : { identifiant: relie };
  return lu ? { identifiant: lu } : { refus: "format" };
}

/**
 * Un rattachement vaut sous un code relié s'il est celui de l'agent du code :
 * posé avant la liaison, ou pour un autre agent, il ne compte plus.
 */
export function rattachementAdmis(agentDuCode: number | null, agentRattache: number): boolean {
  return agentDuCode === null || agentDuCode === agentRattache;
}
