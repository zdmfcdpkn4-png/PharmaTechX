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
  // Une phrase en tête du programme (question 91, choix a, 02/10/2026).
  description: "Le socle transversal (blocs 1 et 3) d'abord, puis les critères de votre filière et de votre niveau.",
  blocs: blocs(),
};

export const parcoursMaintien: Parcours = {
  id: "maintien",
  titre: "Parcours de maintien d'habilitation",
  destinataire: "Agent déjà habilité, en revalidation périodique",
  // Les faits de la fiche (`maintien`), en une phrase (question 91).
  description: `Réévaluation tous les ${maintien.periodiciteMois / 12} ans, avancée si un complément de formation est nécessaire ; ${maintien.activiteMinimale.charAt(0).toLowerCase()}${maintien.activiteMinimale.slice(1)}`,
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

/**
 * Précédent et suivant d'un module dans une liste ordonnée ; `null` s'il n'y
 * figure pas. Avec `ouvert`, le précédent et le suivant sont les plus proches
 * modules qui s'ouvrent : un apprenant n'est pas envoyé vers un module sans
 * question (05/10/2026). Le rang et le total restent ceux de la liste entière,
 * comme les numéros des cartes.
 */
export function voisins<T extends { id: string }>(liste: T[], id: string, ouvert?: (m: T) => boolean): Voisins<T> | null {
  const i = liste.findIndex((m) => m.id === id);
  if (i < 0) return null;
  const garde = ouvert ?? (() => true);
  return {
    precedent: liste.slice(0, i).findLast(garde) ?? null,
    suivant: liste.slice(i + 1).find(garde) ?? null,
    rang: i + 1,
    total: liste.length,
  };
}
