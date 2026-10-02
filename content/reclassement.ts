/**
 * Reclassement en lot (02/10/2026, question 88, choix a) : plusieurs questions
 * de la banque changent de module d'origine en un geste. Calculs purs,
 * partagés par la barre de sélection (l'effet annoncé avant d'appliquer) et
 * par le serveur (l'effet appliqué) : les deux disent la même chose.
 *
 * Règle en vigueur, inchangée (questions 12 et 74) : changer le module d'une
 * question est une modification. Une question validée repasse « à vérifier »,
 * et celui qui la classe en devient l'auteur courant. Une question déjà dans
 * le module choisi ne bouge pas.
 */

export type StatutReclasse = "a_verifier" | "valide" | "retire";

/** Formulaire de la barre de sélection, auquel les cases des questions se rattachent par l'attribut `form`. */
export const FORMULAIRE_SELECTION = "selection-banque";

export interface QuestionAClasser {
  id: string;
  /** Module d'origine. */
  module_id: string;
  statut: StatutReclasse;
}

export interface PlanReclassement {
  /** Questions qui changent de module. */
  aClasser: string[];
  /** Questions déjà dans le module choisi : inchangées. */
  deja: string[];
  /** Parmi celles qui changent de module, les validées : elles repassent « à vérifier ». */
  validees: string[];
  /** Identifiants reçus qui ne désignent aucune question. */
  inconnues: string[];
}

/** Au plus autant de questions par geste : une banque de pool en compte quelques dizaines. */
export const RECLASSEMENT_MAX = 500;

const IDENTIFIANT = /^[A-Za-z0-9_-]{1,80}$/;

/** Identifiants reçus d'un formulaire : valides, sans doublon (une question figure sous plusieurs branches), bornés. */
export function lireIdentifiantsQuestions(valeurs: unknown[], max = RECLASSEMENT_MAX): string[] {
  const ids: string[] = [];
  for (const v of valeurs) {
    const id = typeof v === "string" ? v.trim() : "";
    if (IDENTIFIANT.test(id) && !ids.includes(id)) ids.push(id);
    if (ids.length >= max) break;
  }
  return ids;
}

export function planReclassement(ids: string[], questions: QuestionAClasser[], cible: string): PlanReclassement {
  const parId = new Map(questions.map((q) => [q.id, q]));
  const plan: PlanReclassement = { aClasser: [], deja: [], validees: [], inconnues: [] };
  for (const id of new Set(ids)) {
    const q = parId.get(id);
    if (!q) plan.inconnues.push(id);
    else if (q.module_id === cible) plan.deja.push(id);
    else {
      plan.aClasser.push(id);
      if (q.statut === "valide") plan.validees.push(id);
    }
  }
  return plan;
}

function pluriel(n: number, un: string, plusieurs: string): string {
  return `${n} ${n > 1 ? plusieurs : un}`;
}

/** Ce que fera le geste, dit avant de l'appliquer. */
export function annonceReclassement(plan: PlanReclassement, libelleModule: string): string {
  if (plan.aClasser.length === 0) {
    return `Rien à classer : ${plan.deja.length > 1 ? "les questions choisies sont déjà" : "la question choisie est déjà"} dans « ${libelleModule} ».`;
  }
  const phrases = [`Classer ${pluriel(plan.aClasser.length, "question", "questions")} dans « ${libelleModule} ».`];
  if (plan.deja.length > 0) {
    phrases.push(`${pluriel(plan.deja.length, "y est déjà et ne bouge pas", "y sont déjà et ne bougent pas")}.`);
  }
  if (plan.validees.length > 0) {
    phrases.push(`${pluriel(plan.validees.length, "validée repassera", "validées repasseront")} « à vérifier ».`);
  }
  phrases.push(
    plan.aClasser.length > 1
      ? "Vous deviendrez l'auteur courant des questions déplacées."
      : "Vous deviendrez l'auteur courant de la question déplacée.",
  );
  return phrases.join(" ");
}

/** Le message affiché au retour sur la banque. */
export function bilanReclassement(nb: number, revues: number, libelleModule: string): string {
  if (nb === 0) return `Aucune question déplacée : celles choisies étaient déjà dans « ${libelleModule} ».`;
  const base = `${pluriel(nb, "question classée", "questions classées")} dans « ${libelleModule} ».`;
  return revues > 0 ? `${base} ${pluriel(revues, "validée repasse", "validées repassent")} « à vérifier ».` : base;
}
