/**
 * Session liée à son code d'accès (décision du 18/09/2026, question 16,
 * choix b). Dès qu'une base est configurée, le cookie signé ne suffit plus :
 * le code qui l'a ouvert doit exister encore, être actif, et n'avoir pas été
 * révoqué depuis l'ouverture de la session. Règle pure, sans accès à la base
 * ni à Next, pour être testable ; `lib/auth.ts` la branche sur le cookie.
 */

export interface EtatAcces {
  actif: boolean;
  /** Dernière révocation du code, en secondes epoch ; null s'il n'a jamais été révoqué. */
  ferme: number | null;
}

export interface EtatSession<S> {
  session: S | null;
  /** Vrai quand un cookie signé et non expiré existait, mais que son code a été révoqué, remplacé ou supprimé. */
  fermee: boolean;
}

/**
 * @param decodee  charge du cookie, signature et échéance déjà vérifiées ; null sans cookie valable
 * @param baseConfiguree  sans base, le site est en mode ouvert et le cookie fait foi
 * @param acces  état du code en base : null s'il a été supprimé, undefined s'il n'a pas été cherché
 */
export function etatDeSession<S extends { acces?: number | null; debut?: number }>(
  decodee: S | null,
  baseConfiguree: boolean,
  acces: EtatAcces | null | undefined,
): EtatSession<S> {
  if (!decodee) return { session: null, fermee: false };
  if (!baseConfiguree) return { session: decodee, fermee: false };
  // Sessions d'avant cette version (sans code ni date d'ouverture) : fermées une fois.
  if (!decodee.acces || typeof decodee.debut !== "number") return { session: null, fermee: true };
  if (!acces || !acces.actif) return { session: null, fermee: true };
  if (acces.ferme !== null && acces.ferme >= decodee.debut) return { session: null, fermee: true };
  return { session: decodee, fermee: false };
}
