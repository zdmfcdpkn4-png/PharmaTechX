import "server-only";

import type { Module, Parcours, TypeParcours } from "./types";
import { protectionOperateur } from "./modules/protection-operateur";
import { comportementZac } from "./modules/comportement-zac";
import { emplacements, parcours } from "./parcours";
import { baseConfiguree } from "@/lib/db";
import { comptesParModule, questionsValideesDuModule } from "./banque-db";

/**
 * Accès au contenu — serveur uniquement.
 *
 * `import "server-only"` fait échouer le build si l'un de ces modules est
 * importé depuis un composant client : c'est la garantie mécanique que les
 * bonnes réponses aux questions ne partent jamais dans le navigateur.
 *
 * Deux sources de questions coexistent :
 *   - la banque versionnée avec le code (`content/modules/*.ts`) ;
 *   - la banque déposée en base par les tuteurs et administrateurs
 *     (`content/banque-db.ts`), fusionnée à la lecture par `getModuleComplet`.
 * Le texte des modules, lui, reste versionné avec le code — la rédaction en
 * base est une décision à part : [à préciser].
 */

const modulesRediges: Module[] = [protectionOperateur, comportementZac];

const tousModules: Module[] = [...modulesRediges, ...emplacements];

const index = new Map(tousModules.map((m) => [m.id, m]));

/** Module tel qu'il est versionné avec le code, sans la banque déposée. */
export function getModule(id: string): Module | undefined {
  return index.get(id);
}

/** Module complété des questions validées en base. */
export async function getModuleComplet(id: string): Promise<Module | undefined> {
  const m = index.get(id);
  if (!m || !baseConfiguree()) return m;
  const { questions, misesEnSituation } = await questionsValideesDuModule(id);
  if (questions.length === 0 && misesEnSituation.length === 0) return m;
  return {
    ...m,
    questions: [...m.questions, ...questions],
    misesEnSituation: [...m.misesEnSituation, ...misesEnSituation],
  };
}

/**
 * Nombre de questions validées en base, par module. Vide sans base : les
 * compteurs de l'accueil ne comptent alors que la banque versionnée.
 */
export async function comptesQuestionsBase(): Promise<Record<string, number>> {
  if (!baseConfiguree()) return {};
  try {
    const comptes = await comptesParModule();
    return Object.fromEntries(Object.entries(comptes).map(([k, v]) => [k, v.valides]));
  } catch {
    return {};
  }
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
