import type { Bloc, Module, NiveauHabilitation, Parcours } from "./types";
import {
  blocsCompetence,
  criteres,
  maintien,
  type Critere,
} from "./habilitation";

/**
 * Ossature des parcours, dérivée de la fiche d'habilitation.
 *
 * La maille d'un module est le **critère** : un module couvre une ligne de la
 * fiche et une seule, ce qui permet au rapport d'évaluation de se lire ligne à
 * ligne en face d'elle. Les 53 critères produisent donc 53 emplacements de
 * module, dont deux sont aujourd'hui rédigés.
 *
 * Les intitulés sont transcrits depuis la fiche, sans réécriture.
 */

/** « N1c→2 » couvre la phase en doublon (N1c) puis en autonomie (N2). */
function niveauxDuCritere(x: Critere): NiveauHabilitation[] {
  return x.niveau === "N1c→2" ? ["N1c", "N2"] : [x.niveau];
}

function filiereDuBloc(numero: number): string {
  return blocsCompetence.find((b) => b.numero === numero)?.filiere ?? "socle";
}

/** Emplacement de module généré pour un critère non encore rédigé. */
function emplacement(x: Critere): Module {
  const filiere = filiereDuBloc(x.bloc);
  return {
    id: `critere-${x.id.toLowerCase()}`,
    titre: x.libelle,
    objectif: `Maîtriser le critère ${x.id} de la fiche d'habilitation.`,
    bloc: x.bloc,
    affectation: filiere === "socle" ? "tronc-commun" : "poste",
    critereId: x.id,
    postes: filiere === "socle" ? [] : [filiere],
    niveaux: niveauxDuCritere(x),
    parcours: ["integration", "maintien"],
    dureeMinutes: 0,
    redige: false,
    sections: [],
    ressources: [],
    questions: [],
    misesEnSituation: [],
    seuilReussite: 80,
    periodiciteMois: maintien.periodiciteMois,
    bibliographie: [],
  };
}

/** Critères couverts par un module déjà rédigé — pas d'emplacement généré. */
const critreresRediges = new Set(
  criteres.filter((x) => x.moduleId).map((x) => x.id),
);

export const emplacements: Module[] = criteres
  .filter((x) => !critreresRediges.has(x.id))
  .map(emplacement);

function blocs(): Bloc[] {
  return blocsCompetence.map((b) => {
    const items = criteres.filter((x) => x.bloc === b.numero);
    const obligatoires = items.filter((x) => x.obligatoire).length;
    return {
      numero: b.numero,
      titre: b.titre,
      perimetre: `${items.length} critères, dont ${obligatoires} obligatoires. Réf. : ${b.reference}`,
      moduleIds: items.map(
        (x) => x.moduleId ?? `critere-${x.id.toLowerCase()}`,
      ),
    };
  });
}

export const parcoursIntegration: Parcours = {
  id: "integration",
  titre: "Parcours d'intégration",
  destinataire:
    "Nouvel arrivant en unité de production — préparateur en pharmacie, interne, pharmacien en prise de poste",
  description:
    "Acquisition des compétences jusqu'à la première habilitation. Le socle transversal (blocs 1 et 3) est prérequis aux deux parcours ; viennent ensuite les critères de la filière et du niveau visés.",
  blocs: blocs(),
};

export const parcoursMaintien: Parcours = {
  id: "maintien",
  titre: "Parcours de maintien d'habilitation",
  destinataire: "Agent déjà habilité, en revalidation périodique",
  description: `${maintien.activiteMinimale} Réévaluation de l'habilitation tous les ${maintien.periodiciteMois / 12} ans. ${maintien.reserve}`,
  blocs: blocs(),
};

export const parcours: Parcours[] = [parcoursIntegration, parcoursMaintien];

export interface Voisins<T> {
  precedent: T | null;
  suivant: T | null;
  /** Rang du module dans la liste, à partir de 1. */
  rang: number;
  total: number;
}

/** Précédent et suivant d'un module dans une liste ordonnée ; `null` s'il n'y figure pas. */
export function voisins<T extends { id: string }>(liste: T[], id: string): Voisins<T> | null {
  const i = liste.findIndex((m) => m.id === id);
  if (i < 0) return null;
  return {
    precedent: i > 0 ? liste[i - 1] : null,
    suivant: i + 1 < liste.length ? liste[i + 1] : null,
    rang: i + 1,
    total: liste.length,
  };
}
