import type { Verdict } from "./decision";
import type { StatutRapport } from "./rapports";

/**
 * Calculs du tableau de bord de pilotage, sans accès à la base : ce sont eux
 * qui décident ce qu'on montre, donc ce sont eux qu'on teste.
 *
 * Module pur (pas de `server-only`) — les requêtes sont dans `lib/pilotage-db.ts`.
 */

/** Ce que le rapport attend pour avancer, du point de vue de celui qui pilote. */
export type Attente = "arbitrage" | "visa-tuteur" | "visa-pharmacien";

export const LIBELLES_ATTENTE: Record<Attente, string> = {
  arbitrage: "Arbitrage du tuteur",
  "visa-tuteur": "Visa du tuteur",
  "visa-pharmacien": "Visa du pharmacien",
};

/**
 * Ce qui bloque un rapport non clos. Un verdict brut indéterminé sans
 * arbitrage passe avant le visa : le tuteur doit trancher d'abord
 * (décision du 18/09/2026, question 4, choix c).
 */
export function attenteDe(
  statut: StatutRapport,
  verdictBrut: Verdict,
  arbitre: boolean,
): Attente | null {
  if (statut === "clos" || statut === "annule") return null;
  if (statut === "emis") return verdictBrut === "indetermine" && !arbitre ? "arbitrage" : "visa-tuteur";
  return "visa-pharmacien";
}

/** Part en pourcentage, arrondie. Un dénominateur nul rend 0, jamais NaN. */
export function part(n: number, total: number): number {
  return total > 0 ? Math.round((n / total) * 100) : 0;
}

export interface ComptageQuestion {
  question_id: string;
  posees: number;
  reussies: number;
}

/**
 * Seuil d'affichage des questions les plus manquées. Ce sont des conventions
 * de lecture, pas des normes : en dessous de `minPosees`, un taux ne veut rien
 * dire ; au-dessus de `tauxMax`, la question ne pose pas de problème visible.
 */
export const LECTURE_QUESTIONS = { minPosees: 5, tauxMax: 60, maximum: 12 } as const;

export function questionsDifficiles<T extends ComptageQuestion>(
  lignes: T[],
  { minPosees, tauxMax, maximum }: { minPosees: number; tauxMax: number; maximum: number } = LECTURE_QUESTIONS,
): (T & { taux: number })[] {
  return lignes
    .filter((q) => q.posees >= minPosees)
    .map((q) => ({ ...q, taux: part(q.reussies, q.posees) }))
    .filter((q) => q.taux <= tauxMax)
    .sort((a, b) => a.taux - b.taux || b.posees - a.posees || a.question_id.localeCompare(b.question_id))
    .slice(0, maximum);
}

export interface BilanCritere {
  cle: string;
  libelle: string;
  critere_id: string | null;
  n: number;
  acquis: number;
  non_acquis: number;
  indetermine: number;
  non_concluant: number;
  score_moyen: number | null;
}

/**
 * Les critères où ça coince d'abord : taux d'acquis croissant, puis volume
 * décroissant. Un critère sans rapport n'a pas de taux et ne se classe pas —
 * il est renvoyé à part pour être signalé comme non couvert, et non comme
 * mauvais.
 */
export function classerCriteres(l: BilanCritere[]): { couverts: (BilanCritere & { taux: number })[]; vides: BilanCritere[] } {
  const couverts = l
    .filter((c) => c.n > 0)
    .map((c) => ({ ...c, taux: part(c.acquis, c.n) }))
    .sort((a, b) => a.taux - b.taux || b.n - a.n || a.libelle.localeCompare(b.libelle));
  return { couverts, vides: l.filter((c) => c.n === 0) };
}

// ───────────────────────────────────────────────────── séries et graphiques

/**
 * Les graphiques sont tracés en SVG côté serveur : aucune bibliothèque, aucun
 * script au navigateur, et la page s'imprime telle quelle. Ce qui suit est la
 * géométrie ; les composants ne font que la mettre en forme.
 */

export interface PointMois {
  /** `AAAA-MM`. */
  mois: string;
  n: number;
  acquis: number;
  score_moyen: number | null;
}

/**
 * Série mensuelle continue entre le premier et le dernier mois observés : sans
 * cela, une courbe relierait janvier à mai comme s'ils étaient voisins, et
 * lirait un creux là où il n'y a rien eu.
 */
export function moisContinus(points: PointMois[]): PointMois[] {
  if (points.length === 0) return [];
  const tries = [...points].sort((a, b) => a.mois.localeCompare(b.mois));
  const [a0, m0] = tries[0].mois.split("-").map(Number);
  const [a1, m1] = tries[tries.length - 1].mois.split("-").map(Number);
  const connus = new Map(tries.map((p) => [p.mois, p]));
  const out: PointMois[] = [];
  for (let a = a0, m = m0; a < a1 || (a === a1 && m <= m1); m === 12 ? ((a += 1), (m = 1)) : (m += 1)) {
    const cle = `${a}-${String(m).padStart(2, "0")}`;
    out.push(connus.get(cle) ?? { mois: cle, n: 0, acquis: 0, score_moyen: null });
  }
  return out;
}

const MOIS_COURTS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

/** `2026-09` → `sept. 26`. */
export function libelleMois(cle: string): string {
  const [a, m] = cle.split("-").map(Number);
  return `${MOIS_COURTS[m - 1] ?? "?"} ${String(a).slice(2)}`;
}

export interface Tranche {
  /** Borne basse incluse. */
  de: number;
  /** Borne haute incluse. */
  a: number;
  n: number;
}

/**
 * Répartition des scores par tranches de dix points, de 0 à 100. Les tranches
 * vides sont conservées : un histogramme dont on retire les creux ment.
 */
export function tranchesScores(scores: number[], pas = 10): Tranche[] {
  const tranches: Tranche[] = [];
  for (let de = 0; de < 100; de += pas) tranches.push({ de, a: de + pas - 1, n: 0 });
  tranches[tranches.length - 1].a = 100;
  for (const s of scores) {
    const i = Math.min(tranches.length - 1, Math.max(0, Math.floor(s / pas)));
    tranches[i].n += 1;
  }
  return tranches;
}

/**
 * Points d'une ligne dans une boîte de `largeur` × `hauteur`, ordonnée de 0 à
 * `max`. Un point sans valeur coupe la ligne : `null` signale la rupture.
 */
export function pointsCourbe(
  valeurs: (number | null)[],
  largeur: number,
  hauteur: number,
  max = 100,
  marge = 0,
): ({ x: number; y: number } | null)[] {
  const n = valeurs.length;
  const pas = n > 1 ? (largeur - 2 * marge) / (n - 1) : 0;
  return valeurs.map((v, i) =>
    v === null ? null : { x: marge + i * pas, y: hauteur - (Math.max(0, Math.min(max, v)) / max) * hauteur },
  );
}

/** Segments continus d'une ligne à trous, prêts à devenir des `polyline`. */
export function segments(points: ({ x: number; y: number } | null)[]): { x: number; y: number }[][] {
  const out: { x: number; y: number }[][] = [];
  let courant: { x: number; y: number }[] = [];
  for (const p of points) {
    if (p) {
      courant.push(p);
    } else if (courant.length > 0) {
      out.push(courant);
      courant = [];
    }
  }
  if (courant.length > 0) out.push(courant);
  return out;
}

/** Longueurs d'arc d'un anneau (`stroke-dasharray`) pour une circonférence donnée. */
export function arcs(valeurs: number[], circonference: number): { longueur: number; debut: number }[] {
  const total = valeurs.reduce((s, v) => s + v, 0);
  let debut = 0;
  return valeurs.map((v) => {
    const longueur = total > 0 ? (v / total) * circonference : 0;
    const a = { longueur, debut };
    debut += longueur;
    return a;
  });
}
