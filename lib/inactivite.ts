/**
 * Déconnexion après quatre heures sans activité (demande du 23/09/2026) : sur
 * un poste partagé, une session laissée ouverte sert à qui s'assoit ensuite.
 * Passé ce délai, la session de rôle et le rattachement de l'apprenant ne
 * valent plus : il faut retaper son code d'accès, et l'apprenant son
 * identifiant et son code personnel. La limite de douze heures demeure.
 *
 * L'activité se lit à deux endroits :
 *   - dans le jeton lui-même (`vu`), posé à son émission — la connexion ou
 *     le rattachement sont des gestes de l'utilisateur ;
 *   - dans le cookie d'activité (`fp_activite`), que seul le signal du
 *     navigateur réécrit (`/api/activite`), et qui ne vaut que pour les jetons
 *     dont il porte l'identifiant (`sid`).
 *
 * Le signal d'activité n'écrit jamais la session ni le rattachement : sa
 * réponse, arrivée après celle d'un « quitter » ou d'un « Se détacher »,
 * les rétablirait. Il n'écrit que son propre cookie ; un cookie d'activité
 * lié à un jeton disparu ne rouvre rien.
 *
 * Règle pure, sans Next ni Node : le filtre d'entrée, le serveur et le
 * navigateur la partagent.
 */

export const INACTIVITE_SECONDES = 4 * 3600;

/** Ce qu'un jeton de session ou de rattachement dit de son activité. */
export interface JetonActif {
  /** Identifiant aléatoire du jeton, auquel le cookie d'activité se lie. */
  sid?: unknown;
  /** Activité connue à l'émission du jeton, en secondes epoch. */
  vu?: unknown;
  /** Repli des jetons émis avant cette version, sans `vu` : leur ouverture. */
  debut?: unknown;
}

/** Charge du cookie d'activité : dernière activité et jetons qu'elle entretient. */
export interface Activite {
  vu?: unknown;
  sids?: unknown;
}

function nombre(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** Dernière activité connue d'un jeton, en secondes epoch ; null si rien ne la date. */
export function derniereActivite(j: JetonActif, a: Activite | null): number | null {
  const propre = nombre(j.vu) ?? nombre(j.debut);
  const liee =
    a && typeof j.sid === "string" && j.sid && Array.isArray(a.sids) && a.sids.includes(j.sid) ? nombre(a.vu) : null;
  if (propre === null) return liee;
  return liee === null ? propre : Math.max(propre, liee);
}

/** Vrai quand la dernière activité date de plus de quatre heures, ou ne peut être datée. */
export function inactif(j: JetonActif, a: Activite | null, maintenant = Date.now() / 1000): boolean {
  const vu = derniereActivite(j, a);
  return vu === null || maintenant - vu > INACTIVITE_SECONDES;
}

/** Secondes restantes avant la fermeture pour inactivité ; 0 quand elle est passée. */
export function resteAvantInactivite(j: JetonActif, a: Activite | null, maintenant = Date.now() / 1000): number {
  const vu = derniereActivite(j, a);
  return vu === null ? 0 : Math.max(0, Math.floor(vu + INACTIVITE_SECONDES - maintenant));
}
