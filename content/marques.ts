/**
 * Marquage des propositions après la correction d'entraînement (audit du
 * 24/09/2026, E1 ; question 69, choix a).
 *
 * La correction disait « Votre réponse : … / Attendu : … » en toutes lettres,
 * sous la question : l'apprenant devait lui-même rapprocher ces textes des
 * propositions, quelques lignes plus haut. Chaque proposition porte désormais
 * son verdict, en texte et pas seulement en couleur.
 *
 * Le serveur renvoie les propositions attendues par leur **texte** : le
 * navigateur ne reçoit jamais les identifiants des bonnes réponses. Le
 * rapprochement se fait donc sur le texte ; deux propositions de même texte
 * le rendraient ambigu. Le marquage est alors abandonné (`null`) et la
 * correction écrite reste affichée.
 */

export interface PropositionMarquable {
  id: string;
  texte: string;
}

function textesUniques(options: PropositionMarquable[]): boolean {
  return new Set(options.map((o) => o.texte)).size === options.length;
}

/**
 * QCM, ou QIM en cases à cocher : « attendue » sur chaque bonne réponse,
 * cochée ou non ; « erronee » sur une proposition cochée à tort ; rien
 * ailleurs. La case, restée cochée, dit ce que l'apprenant avait choisi.
 */
export type MarqueOption = "attendue" | "erronee" | null;

export function marquesOptions(
  options: PropositionMarquable[],
  choisies: string[],
  attendues: string[],
): Record<string, MarqueOption> | null {
  if (!textesUniques(options)) return null;
  const out: Record<string, MarqueOption> = {};
  for (const o of options) {
    out[o.id] = attendues.includes(o.texte) ? "attendue" : choisies.includes(o.id) ? "erronee" : null;
  }
  return out;
}

/**
 * QIM jugée proposition par proposition : ce que l'apprenant a répondu, ce
 * qui était attendu, et le verdict de la ligne. « Je ne sais pas », ou une
 * proposition laissée de côté (`null`), n'est ni juste ni faux : le barème
 * n'y applique que sa part « sans réponse ».
 */
export interface MarqueQim {
  vous: boolean | "nsp" | null;
  attendu: boolean;
  verdict: "juste" | "faux" | "sans";
}

export function marquesQim(
  options: PropositionMarquable[],
  jugements: Record<string, boolean | "nsp">,
  attendues: string[],
): Record<string, MarqueQim> | null {
  if (!textesUniques(options)) return null;
  const out: Record<string, MarqueQim> = {};
  for (const o of options) {
    const attendu = attendues.includes(o.texte);
    const vous = jugements[o.id] ?? null;
    out[o.id] = { vous, attendu, verdict: typeof vous !== "boolean" ? "sans" : vous === attendu ? "juste" : "faux" };
  }
  return out;
}
