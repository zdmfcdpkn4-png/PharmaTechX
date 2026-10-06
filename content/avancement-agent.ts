/**
 * Avancement d'un agent par module, vu du tutorat sur sa fiche (06/10/2026,
 * demande directe : « pouvoir voir son avancement »). Il se lit dans ses
 * traces conservées (question 11, choix c) : pour chaque module, la dernière
 * trace de chaque nature — évaluation corrigée, entraînement terminé, lecture
 * —, et l'état retenu est le plus parlant : le verdict brut de la dernière
 * évaluation, sinon « entraîné », sinon « lu », sinon « pas commencé ».
 *
 * « Acquis » a ici le sens que la barre de badges et la coche de validation
 * donnent déjà à l'apprenant : la dernière évaluation a le verdict brut
 * « acquis » — avant arbitrage ; ce n'est pas un avancement d'habilitation.
 * Les traces ne se posent qu'une fois l'agent rattaché : une évaluation passée
 * sans rattachement ne paraît pas ici, son rapport émis reste dans Rapports.
 *
 * Module pur : testable sans base. La lecture est dans `lib/progression.ts`
 * (`dernieresTraces`).
 */

export type EtatAvancement = "acquis" | "non_acquis" | "indetermine" | "non_concluant" | "entraine" | "lu" | "vierge";

/** Une trace de progression, réduite à ce qui fait l'avancement. */
export interface TraceAvancement {
  module_id: string;
  nature: string;
  verdict: string | null;
  score: number | null;
  cree_le: string;
}

export interface AvancementModule {
  etat: EtatAvancement;
  /** Date de la trace retenue ; null quand rien n'a commencé. */
  le: string | null;
  /** Score de l'évaluation ou de l'entraînement retenu, en pour cent. */
  score: number | null;
}

export const VIERGE: AvancementModule = { etat: "vierge", le: null, score: null };

export const LIBELLES_AVANCEMENT: Record<EtatAvancement, string> = {
  acquis: "Acquis",
  non_acquis: "Non acquis",
  indetermine: "Indéterminé",
  non_concluant: "Non concluant",
  entraine: "Entraîné",
  lu: "Lu",
  vierge: "Pas commencé",
};

const ETAT_DU_VERDICT: Record<string, EtatAvancement> = {
  acquis: "acquis",
  non_acquis: "non_acquis",
  indetermine: "indetermine",
  non_concluant: "non_concluant",
};

type Nature = "evaluation" | "entrainement" | "lecture";

function natureConnue(n: string): n is Nature {
  return n === "evaluation" || n === "entrainement" || n === "lecture";
}

/**
 * Par module, l'état d'avancement. Les traces peuvent venir dans n'importe
 * quel ordre et en nombre : pour chaque nature, la plus récente l'emporte ;
 * une nature inconnue est ignorée ; un verdict inconnu vaut « indéterminé ».
 */
export function avancementParModule(traces: readonly TraceAvancement[]): Map<string, AvancementModule> {
  const dernieres = new Map<string, Partial<Record<Nature, TraceAvancement>>>();
  for (const t of traces) {
    if (!natureConnue(t.nature)) continue;
    const d = dernieres.get(t.module_id) ?? {};
    const prec = d[t.nature];
    if (!prec || t.cree_le >= prec.cree_le) d[t.nature] = t;
    dernieres.set(t.module_id, d);
  }
  const out = new Map<string, AvancementModule>();
  for (const [id, d] of dernieres) {
    if (d.evaluation) {
      out.set(id, { etat: ETAT_DU_VERDICT[d.evaluation.verdict ?? ""] ?? "indetermine", le: d.evaluation.cree_le, score: d.evaluation.score });
    } else if (d.entrainement) {
      out.set(id, { etat: "entraine", le: d.entrainement.cree_le, score: d.entrainement.score });
    } else if (d.lecture) {
      out.set(id, { etat: "lu", le: d.lecture.cree_le, score: null });
    }
  }
  return out;
}

/** « Acquis le 06/10/2026 · 85 % », « Entraîné le 05/10/2026 · 60 % », « Lu le 05/10/2026 », « Pas commencé ». */
export function libelleAvancement(a: AvancementModule, date: (iso: string) => string): string {
  const base = LIBELLES_AVANCEMENT[a.etat];
  if (a.etat === "vierge" || !a.le) return base;
  const score = a.etat !== "lu" && a.score !== null ? ` · ${a.score} %` : "";
  return `${base} le ${date(a.le)}${score}`;
}
