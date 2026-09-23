/**
 * Règle des quatre yeux (décision du 18/09/2026, question 12) :
 *   - une question se valide par un autre code d'accès que celui qui l'a
 *     écrite — l'auteur courant est le dernier code qui l'a créée ou modifiée.
 *     Exception demandée le 23/09/2026 : un code d'administration — le
 *     pharmacien responsable, question 9 — valide aussi les siennes ; la
 *     validation par l'auteur est alors tracée sur la question et au journal.
 *     Le tutorat reste aux quatre yeux ;
 *   - un module déposé se publie, se retire ou repasse en brouillon en
 *     administration seulement (choix c), et un module publié ne se modifie
 *     qu'en administration.
 *
 * Un code désigne un profil, pas une personne : la règle garantit deux codes
 * distincts, la procédure interne garantit deux personnes. Les codes sont
 * comparés par leur identifiant quand il est connu (sessions et lignes
 * récentes), sinon par leur libellé (rôle · libellé).
 */
export interface AuteurQuestion {
  cree_par: string;
  cree_par_acces: number | null;
  edite_par: string | null;
  edite_par_acces: number | null;
}

export interface CodeActeur {
  role: string;
  libelle: string;
  acces?: number | null;
}

/** L'auteur courant d'une question : le dernier code qui l'a écrite. */
export function auteurCourant(q: AuteurQuestion): { libelle: string; acces: number | null } {
  return q.edite_par ? { libelle: q.edite_par, acces: q.edite_par_acces } : { libelle: q.cree_par, acces: q.cree_par_acces };
}

export function memeCode(q: AuteurQuestion, acteur: CodeActeur): boolean {
  const auteur = auteurCourant(q);
  if (auteur.acces !== null && auteur.acces !== undefined && acteur.acces !== null && acteur.acces !== undefined) {
    return auteur.acces === acteur.acces;
  }
  return auteur.libelle === `${acteur.role} · ${acteur.libelle}`;
}

/** Valider exige un autre code que l'auteur courant, sauf pour l'administration. */
export function peutValider(q: AuteurQuestion, acteur: CodeActeur): boolean {
  return acteur.role === "admin" || !memeCode(q, acteur);
}

/** Validation par l'auteur courant lui-même : permise à l'administration seule, et tracée. */
export function validationParAuteur(q: AuteurQuestion, acteur: CodeActeur): boolean {
  return peutValider(q, acteur) && memeCode(q, acteur);
}
