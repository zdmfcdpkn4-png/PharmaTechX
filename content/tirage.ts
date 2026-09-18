/**
 * Tirage des questions d'un module, et questions réservées à l'évaluation
 * (décision du 18/09/2026, question 18, choix c).
 *
 * Une question réservée n'est jamais posée en entraînement ni dans le tirage
 * Découverte : elle n'entre que dans les tirages qui peuvent conclure,
 * Habilitation et Complet, en mode évaluation, où elle est tirée en priorité.
 * Le tirage se fait dans le navigateur ; le serveur vérifie sa conformité à
 * la correction (`tirageConforme`). Aucune dépendance à Next ni à la base :
 * testable tel quel.
 */

export type Difficulte = "decouverte" | "habilitation" | "complet";
export type ModeTirage = "evaluation" | "entrainement";

export interface QuestionTirable {
  id: string;
  eliminatoire?: boolean;
  reservee?: boolean;
  situation?: { id: string } | null;
}

/** Les réservées n'entrent que dans un tirage qui peut conclure, en mode évaluation. */
export function reserveesAdmises(mode: ModeTirage, difficulte: Difficulte): boolean {
  return mode === "evaluation" && difficulte !== "decouverte";
}

export function melanger<T>(xs: readonly T[], alea: () => number = Math.random): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(alea() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Tirage. Les questions éliminatoires sont toujours retenues — laisser au
 * hasard le soin de poser ou non la question de sécurité n'aurait pas de
 * sens —, puis les réservées, puis le reste, jusqu'à `nb` (null : tout).
 * Les mises en situation sont rendues par vignette entière, après les
 * questions isolées, dans l'ordre de la banque.
 */
export function tirer<Q extends QuestionTirable>(
  banque: readonly Q[],
  nb: number | null,
  avecReservees: boolean,
  alea: () => number = Math.random,
): Q[] {
  const admissibles = avecReservees ? [...banque] : banque.filter((q) => !q.reservee);
  if (nb === null || nb >= admissibles.length) return admissibles;

  const eliminatoires = admissibles.filter((q) => q.eliminatoire);
  const reservees = melanger(admissibles.filter((q) => !q.eliminatoire && q.reservee), alea);
  const reste = melanger(admissibles.filter((q) => !q.eliminatoire && !q.reservee), alea);
  const choisies = new Set<Q>(eliminatoires);
  for (const q of [...reservees, ...reste]) {
    if (choisies.size >= nb) break;
    choisies.add(q);
  }

  const situations = new Map<string, Q[]>();
  const isolees: Q[] = [];
  for (const q of admissibles) {
    if (!choisies.has(q)) continue;
    if (q.situation) {
      const liste = situations.get(q.situation.id) ?? [];
      liste.push(q);
      situations.set(q.situation.id, liste);
    } else {
      isolees.push(q);
    }
  }
  return [...isolees, ...[...situations.values()].flat()];
}

export type Conformite = { ok: true } | { ok: false; raison: string };

/**
 * Conformité d'un tirage soumis à la correction, la banque étant celle du
 * module à cet instant :
 *  - entraînement ou Découverte : aucune question réservée ;
 *  - Habilitation ou Complet : les réservées non éliminatoires posées sont au
 *    moins min(réservées non éliminatoires disponibles, posées − éliminatoires
 *    posées), ce que produit un tirage qui les prend en priorité.
 */
export function tirageConforme(
  posees: readonly QuestionTirable[],
  banque: readonly QuestionTirable[],
  mode: ModeTirage,
  difficulte: Difficulte,
): Conformite {
  const reserveesPosees = posees.filter((q) => q.reservee);
  if (!reserveesAdmises(mode, difficulte)) {
    if (reserveesPosees.length === 0) return { ok: true };
    return {
      ok: false,
      raison:
        mode === "entrainement"
          ? "Une question réservée à l'évaluation ne se pose pas en entraînement."
          : "Une question réservée à l'évaluation n'entre pas dans le tirage Découverte.",
    };
  }
  const disponibles = banque.filter((q) => q.reservee && !q.eliminatoire).length;
  const eliminatoiresPosees = posees.filter((q) => q.eliminatoire).length;
  const attendues = Math.min(disponibles, Math.max(0, posees.length - eliminatoiresPosees));
  const nonEliminatoiresPosees = reserveesPosees.filter((q) => !q.eliminatoire).length;
  if (nonEliminatoiresPosees < attendues) {
    const s = attendues > 1 ? "s" : "";
    return {
      ok: false,
      raison: `Tirage non conforme : ${attendues} question${s} réservée${s} à l'évaluation attendue${s}, ${nonEliminatoiresPosees} posée${nonEliminatoiresPosees > 1 ? "s" : ""}. Recommencez l'évaluation.`,
    };
  }
  return { ok: true };
}
