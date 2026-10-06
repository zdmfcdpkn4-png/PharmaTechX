import type { ImageQuestion } from "./types";

/**
 * Image d'une question lue en base : celle d'un schéma à compléter, ou
 * l'illustration d'une question de tout format — QCM, QIM, séquence, texte à
 * trous (question 58, 23/09/2026). Elle part avec la question vers l'écran,
 * servie par `/api/images/[id]`.
 *
 * Jusqu'au 06/10/2026, la conversion d'une ligne en question ne reprenait
 * l'image que pour un schéma : les photographies du pool de manipulation,
 * en base depuis leur dépôt, n'arrivaient ni en entraînement ni en
 * évaluation, alors que l'éditeur et la banque les montraient par un autre
 * chemin. Règle pure, testée à part.
 */
export interface LigneImage {
  image_id: string | null;
  image_largeur: number | null;
  image_hauteur: number | null;
  image_alt: string | null;
}

export function imageDeLaLigne(l: LigneImage): ImageQuestion | undefined {
  if (!l.image_id) return undefined;
  return {
    id: l.image_id,
    url: `/api/images/${l.image_id}`,
    largeur: l.image_largeur ?? 0,
    hauteur: l.image_hauteur ?? 0,
    alt: l.image_alt ?? "",
  };
}
