import "server-only";

import type { Module, Parcours, TypeParcours } from "./types";
import { protectionOperateur } from "./modules/protection-operateur";
import { comportementZac } from "./modules/comportement-zac";
import { emplacements, parcours } from "./parcours";

/**
 * Accès au contenu — serveur uniquement.
 *
 * `import "server-only"` fait échouer le build si l'un de ces modules est
 * importé depuis un composant client : c'est la garantie mécanique que les
 * bonnes réponses aux questions ne partent jamais dans le navigateur.
 *
 * Le contenu est ici versionné avec le code. Le jour où il devra être édité
 * sans redéploiement, seules les quatre fonctions ci-dessous sont à réécrire
 * contre une base de données — le reste de l'application ne change pas.
 */

const modulesRediges: Module[] = [protectionOperateur, comportementZac];

const tousModules: Module[] = [...modulesRediges, ...emplacements];

const index = new Map(tousModules.map((m) => [m.id, m]));

export function getModule(id: string): Module | undefined {
  return index.get(id);
}

export function getModulesRediges(parcoursId?: TypeParcours): Module[] {
  return parcoursId
    ? modulesRediges.filter((m) => m.parcours.includes(parcoursId))
    : modulesRediges;
}

export function getParcours(id: string): Parcours | undefined {
  return parcours.find((p) => p.id === id);
}

export function getTousParcours(): Parcours[] {
  return parcours;
}

export function getModulesDuBloc(ids: string[]): Module[] {
  return ids
    .map((id) => index.get(id))
    .filter((m): m is Module => m !== undefined);
}

export function getTousModules(): Module[] {
  return tousModules;
}

/**
 * Programme d'un agent : tronc commun, puis critères attachés à son poste.
 *
 * Le filtre de niveau n'est pas appliqué tant que les niveaux des critères
 * sont [à préciser] : filtrer sur une donnée non renseignée masquerait des
 * modules au lieu de signaler que l'information manque.
 */
export function composerProgramme(
  parcoursId: TypeParcours,
  posteId: string | null,
): { troncCommun: Module[]; poste: Module[] } {
  const duParcours = tousModules.filter((m) => m.parcours.includes(parcoursId));
  return {
    troncCommun: duParcours.filter((m) => m.affectation === "tronc-commun"),
    poste: posteId
      ? duParcours.filter(
          (m) => m.affectation === "poste" && m.postes.includes(posteId),
        )
      : [],
  };
}
