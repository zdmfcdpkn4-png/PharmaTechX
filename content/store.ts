import "server-only";

import type { Module, Parcours, TypeParcours } from "./types";
import { protectionOperateur } from "./modules/protection-operateur";
import { comportementZac } from "./modules/comportement-zac";
import { emplacements, parcours } from "./parcours";
import { filieres } from "./habilitation";
import { baseConfiguree, lireOrdonnancement } from "@/lib/db";
import { lireBareme } from "@/lib/bareme-db";
import { comptesParModule, questionsValideesDuModule } from "./banque-db";
import { lireModuleDepose, lireReglagesSeuils, listerModulesDeposes, versModule } from "./modules-db";

/**
 * Accès au contenu — serveur uniquement.
 *
 * `import "server-only"` fait échouer le build si l'un de ces modules est
 * importé depuis un composant client : c'est la garantie mécanique que les
 * bonnes réponses aux questions ne partent jamais dans le navigateur.
 *
 * Trois sources coexistent :
 *   - les modules versionnés avec le code (`content/modules/*.ts`, et les
 *     emplacements d'un critère par ligne de la fiche) : leur texte reste dans
 *     le code (décision du 18/09/2026, question 10, choix a) ;
 *   - les modules déposés depuis l'administration (`content/modules-db.ts`),
 *     publiés au programme des profils choisis ;
 *   - la banque de questions déposée (`content/banque-db.ts`), fusionnée à la
 *     lecture par `getModuleComplet`, pour un module du code comme déposé.
 * Le seuil de réussite effectif d'un module du code est celui réglé pour lui,
 * sinon le seuil par défaut du barème (`/admin/bareme`).
 */

const modulesRediges: Module[] = [protectionOperateur, comportementZac];

const tousModules: Module[] = [...modulesRediges, ...emplacements];

const index = new Map(tousModules.map((m) => [m.id, m]));

/** Module tel qu'il est versionné avec le code, sans la banque déposée ni le seuil réglé. */
export function getModule(id: string): Module | undefined {
  return index.get(id);
}

export interface OptionsLecture {
  /** Lire aussi un module déposé non publié (écrans de tutorat et d'administration). */
  inclureBrouillons?: boolean;
}

/**
 * Module complété des questions validées en base, avec son seuil effectif.
 * Un module déposé n'est rendu que publié, sauf option.
 */
export async function getModuleComplet(id: string, options: OptionsLecture = {}): Promise<Module | undefined> {
  const code = index.get(id);
  if (!baseConfiguree()) return code ? { ...code, origine: "code" } : undefined;
  if (code) {
    const [bareme, reglages, banque] = await Promise.all([lireBareme(), lireReglagesSeuils(), questionsValideesDuModule(id)]);
    return {
      ...code,
      origine: "code",
      seuilReussite: reglages[id] ?? bareme.seuilDefaut,
      questions: [...code.questions, ...banque.questions],
      misesEnSituation: [...code.misesEnSituation, ...banque.misesEnSituation],
    };
  }
  const depose = await lireModuleDepose(id);
  if (!depose) return undefined;
  if (depose.statut !== "publie" && !options.inclureBrouillons) return undefined;
  const banque = await questionsValideesDuModule(id);
  return { ...versModule(depose), questions: banque.questions, misesEnSituation: banque.misesEnSituation };
}

/** Le module existe, dans le code ou déposé (quel que soit son statut). */
export async function moduleExiste(id: string): Promise<boolean> {
  if (index.has(id)) return true;
  if (!baseConfiguree()) return false;
  return (await lireModuleDepose(id)) !== null;
}

/**
 * Modules du code puis modules déposés — tous statuts pour l'administration,
 * publiés seulement sur option. Sans base : le code seul.
 */
export async function getTousModulesAvecDeposes(options: { publiesSeulement?: boolean } = {}): Promise<Module[]> {
  if (!baseConfiguree()) return tousModules;
  const deposes = await listerModulesDeposes(options.publiesSeulement ? "publie" : undefined);
  return [...tousModules, ...deposes.map(versModule)];
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

export interface Programme {
  troncCommun: Module[];
  /** Critères de poste par filière (hors socle). */
  parFiliere: Record<string, Module[]>;
}

/**
 * Programme d'un parcours : tronc commun, puis critères attachés à chaque
 * filière — modules du code et modules déposés publiés. L'ordonnancement
 * enregistré (`/admin/ordonnancement`) passe en premier, les autres modules
 * gardent l'ordre de la fiche.
 *
 * Le filtre de niveau n'est pas appliqué tant que les niveaux des critères
 * sont [à préciser] : filtrer sur une donnée non renseignée masquerait des
 * modules au lieu de signaler que l'information manque.
 */
export async function composerProgramme(parcoursId: TypeParcours): Promise<Programme> {
  const avecBase = baseConfiguree();
  const deposes = avecBase ? (await listerModulesDeposes("publie").catch(() => [])).map(versModule) : [];
  const rangs: Record<string, number> = avecBase ? await lireOrdonnancement(parcoursId).catch(() => ({})) : {};
  const duParcours = [...tousModules, ...deposes].filter((m) => m.parcours.includes(parcoursId));
  const ordonner = (liste: Module[]): Module[] =>
    liste
      .map((m, i) => ({ m, cle: rangs[m.id] ?? 1_000_000 + i }))
      .sort((a, b) => a.cle - b.cle)
      .map((x) => x.m);
  const parFiliere: Record<string, Module[]> = {};
  for (const f of filieres) {
    if (f.id === "socle") continue;
    parFiliere[f.id] = ordonner(duParcours.filter((m) => m.affectation === "poste" && m.postes.includes(f.id)));
  }
  return { troncCommun: ordonner(duParcours.filter((m) => m.affectation === "tronc-commun")), parFiliere };
}
