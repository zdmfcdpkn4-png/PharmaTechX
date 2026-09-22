/**
 * Tableau de bord de l'accueil (22/09/2026) — la logique, sans navigateur.
 *
 * Demande du 22/09/2026 : un accueil qui montre les modules en cours, ceux
 * consultés récemment et ceux disponibles, un bouton « Reprendre ma
 * formation », une recherche avec filtres, et l'état de chaque module —
 * terminé, en cours, à venir. Tout ce qui décide est ici, pur et testé
 * (`test/tableau.test.ts`) ; les composants ne font qu'afficher.
 *
 * Rien n'est inventé : l'état d'un module vient de la mémoire de session
 * (verdict de la dernière évaluation) et des repères de lecture posés sur ce
 * poste ; aucune durée n'est affichée ni filtrée tant que les modules n'en
 * portent pas (deux sur cinquante et un à ce jour).
 */
import type { Verdict } from "@/lib/decision";

// ─────────────────────────────────────────────────────────── état d'un module

export type EtatModule =
  | "acquis"
  | "arbitrage"
  | "non-acquis"
  | "non-concluant"
  | "en-lecture"
  | "a-faire"
  | "a-rediger"
  | "lecture-seule";

export const LIBELLES_ETAT: Record<EtatModule, string> = {
  acquis: "Acquis",
  arbitrage: "Arbitrage en attente",
  "non-acquis": "À revoir",
  "non-concluant": "Non concluant",
  "en-lecture": "Lecture en cours",
  "a-faire": "À faire",
  "a-rediger": "À rédiger",
  "lecture-seule": "Lecture seule",
};

/** Les trois temps que demande l'accueil : terminé, en cours, à venir. */
export type Avancement = "termine" | "en-cours" | "a-venir";

export const LIBELLES_AVANCEMENT: Record<Avancement, string> = {
  termine: "Terminés",
  "en-cours": "En cours",
  "a-venir": "À venir",
};

export interface ModulePourEtat {
  redige: boolean;
  nbQuestions: number;
}

/**
 * État d'un module à l'écran. Le verdict de la dernière évaluation l'emporte ;
 * sans évaluation, un repère de lecture posé sur ce poste dit « en cours ».
 * « Acquis » est le verdict brut, comme sur la barre de badges : un arbitrage
 * favorable porté au visa ne se voit pas d'ici.
 */
export function etatModule(
  m: ModulePourEtat,
  dernier: { verdict: Verdict } | undefined,
  lectureEntamee: boolean,
): EtatModule {
  if (dernier) {
    if (dernier.verdict === "acquis") return "acquis";
    if (dernier.verdict === "indetermine") return "arbitrage";
    if (dernier.verdict === "non_concluant") return "non-concluant";
    return "non-acquis";
  }
  if (lectureEntamee) return "en-lecture";
  if (m.nbQuestions > 0) return "a-faire";
  if (!m.redige) return "a-rediger";
  return "lecture-seule";
}

export function avancementDe(e: EtatModule): Avancement {
  if (e === "acquis") return "termine";
  if (e === "arbitrage" || e === "non-acquis" || e === "non-concluant" || e === "en-lecture") return "en-cours";
  return "a-venir";
}

// ─────────────────────────────────────────────────────── recherche et filtres

/** Minuscules, sans accents : « Hygiène » se trouve en tapant « hygiene ». */
export function normaliser(s: string): string {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

export interface ModuleCherchable {
  titre: string;
  objectif: string;
  critereId: string;
  bloc: string;
  niveaux: string[];
}

/** Chaque mot saisi doit se trouver quelque part : titre, objectif, critère, bloc, niveaux. */
export function correspond(m: ModuleCherchable, requete: string, titreBloc = ""): boolean {
  const mots = normaliser(requete).split(/\s+/).filter(Boolean);
  if (mots.length === 0) return true;
  const botte = normaliser(
    [m.titre, m.objectif, m.critereId, `bloc ${m.bloc}`, titreBloc, ...m.niveaux].join(" "),
  );
  return mots.every((mot) => botte.includes(mot));
}

export interface FiltresModules {
  texte: string;
  /** Numéro de bloc (« grand module » de la fiche), vide pour tous. */
  bloc: string;
  avancement: "" | Avancement;
}

export const AUCUN_FILTRE: FiltresModules = { texte: "", bloc: "", avancement: "" };

export function filtresActifs(f: FiltresModules): boolean {
  return f.texte.trim() !== "" || f.bloc !== "" || f.avancement !== "";
}

export function filtrerModules<T extends ModuleCherchable & ModulePourEtat>(
  liste: T[],
  f: FiltresModules,
  etatDe: (m: T) => EtatModule,
  titreBloc: (numero: string) => string = () => "",
): T[] {
  return liste.filter(
    (m) =>
      (f.bloc === "" || m.bloc === f.bloc) &&
      (f.avancement === "" || avancementDe(etatDe(m)) === f.avancement) &&
      correspond(m, f.texte, titreBloc(m.bloc)),
  );
}

// ───────────────────────────────────────────────────────────── reprendre

export interface EtapeProgramme {
  id: string;
  titre: string;
  evaluable: boolean;
  redige: boolean;
}

export interface Reprise {
  nature: "evaluation" | "lecture" | "suivant";
  moduleId: string;
  titre: string;
  detail: string;
  href: string;
}

/**
 * Ce que « Reprendre ma formation » ouvre, dans cet ordre :
 *
 *   1. une évaluation laissée en plan (agent rattaché : le serveur la garde) ;
 *   2. la lecture en cours sur ce poste, si son module n'est pas déjà acquis ;
 *   3. le premier module du programme, dans l'ordre de la fiche, qui se lit ou
 *      s'évalue et n'est pas acquis.
 *
 * `null` quand il n'y a rien : tous les modules ouvrables sont acquis.
 */
export function choisirReprise(o: {
  evaluation?: { moduleId: string; titre: string; detail: string } | null;
  lecture?: { module: string; titre: string; num: number; total: number } | null;
  programme: EtapeProgramme[];
  acquis: (moduleId: string) => boolean;
  /** Paramètres de l'adresse à garder (programme à la carte). */
  requete?: string;
}): Reprise | null {
  const requete = o.requete ?? "";
  if (o.evaluation) {
    return {
      nature: "evaluation",
      moduleId: o.evaluation.moduleId,
      titre: o.evaluation.titre,
      detail: `Évaluation en cours — ${o.evaluation.detail}`,
      href: `/module/${o.evaluation.moduleId}/evaluation`,
    };
  }
  if (o.lecture && o.lecture.module && !o.acquis(o.lecture.module)) {
    return {
      nature: "lecture",
      moduleId: o.lecture.module,
      titre: o.lecture.titre,
      detail: `Lecture en cours — section ${o.lecture.num} sur ${o.lecture.total}`,
      href: `/module/${o.lecture.module}`,
    };
  }
  const suivant = o.programme.find((m) => (m.evaluable || m.redige) && !o.acquis(m.id));
  if (!suivant) return null;
  return {
    nature: "suivant",
    moduleId: suivant.id,
    titre: suivant.titre,
    detail: suivant.evaluable ? "Prochain module du programme" : "Prochain module du programme — lecture",
    href: `/module/${suivant.id}${requete}`,
  };
}

// ───────────────────────────────────────────────── modules consultés récemment

/**
 * Trace locale des modules ouverts sur ce poste : identifiant, titre, date.
 * Même statut que les repères de lecture (`LectureModule`) — dans le
 * navigateur, jamais transmise, effacée avec les données du site.
 */
export interface Consultation {
  module: string;
  titre: string;
  /** Date d'ouverture, ISO 8601. */
  le: string;
}

export const CLE_CONSULTATIONS = "fp-consultes";
export const MAX_CONSULTATIONS = 6;

/** Ajoute en tête, sans doublon, en gardant les plus récentes. */
export function ajouterConsultation(
  liste: Consultation[],
  c: Consultation,
  max = MAX_CONSULTATIONS,
): Consultation[] {
  return [c, ...liste.filter((x) => x.module !== c.module)].slice(0, max);
}

/** Relit la trace stockée ; tout ce qui n'a pas la forme attendue est écarté. */
export function lireConsultations(brut: string | null): Consultation[] {
  if (!brut) return [];
  try {
    const v: unknown = JSON.parse(brut);
    if (!Array.isArray(v)) return [];
    return v
      .filter(
        (x): x is Consultation =>
          typeof x === "object" &&
          x !== null &&
          typeof (x as Consultation).module === "string" &&
          /^[A-Za-z0-9_-]{1,64}$/.test((x as Consultation).module) &&
          typeof (x as Consultation).titre === "string" &&
          typeof (x as Consultation).le === "string",
      )
      .slice(0, MAX_CONSULTATIONS);
  } catch {
    return [];
  }
}
