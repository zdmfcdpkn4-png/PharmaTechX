import { getTousModulesAvecDeposes } from "@/content/store";
import { A_PRECISER, type Module } from "@/content/types";
import { reperesModules, type ModuleRepere } from "@/lib/import-module";
import { blocsCompetence } from "@/content/habilitation";
import { getReferentiel } from "@/content/referentiel-db";
import type { ChoixEtiquettes, ModuleChoix } from "@/components/EditeurQuestion";
import type { LigneQuestion } from "@/content/banque-db";
import type { QuestionInitiale } from "@/components/EditeurQuestion";

/** Modules du code puis modules déposés (tous statuts), pour les listes de rattachement. */
export async function choixModules(): Promise<ModuleChoix[]> {
  return (await getTousModulesAvecDeposes()).map((m) => ({
    id: m.id,
    titre: m.titre,
    critereId: etiquetteModule(m),
    redige: m.redige,
    origine: m.origine ?? "code",
    bloc: typeof m.bloc === "number" ? m.bloc : null,
  }));
}

/**
 * Étiquettes qu'une question peut porter (question 74, choix c) : les sept
 * blocs de la fiche, les filières de poste (le socle n'en est pas une) et les
 * niveaux d'habilitation du référentiel.
 */
export async function choixEtiquettes(): Promise<ChoixEtiquettes> {
  const { filieres, niveaux } = await getReferentiel();
  return {
    blocs: blocsCompetence.map((b) => ({ numero: b.numero, titre: b.titre })),
    filieres: filieres.filter((f) => f.id !== "socle").map((f) => ({ id: f.id, libelle: f.libelle })),
    niveaux: niveaux.map((n) => ({ code: String(n.code), libelle: n.libelle })),
  };
}

/** Module tel que le lit une ligne « Module : » : identifiant, titre, code du critère s'il en a un. */
export function versRepere(m: Pick<Module, "id" | "titre" | "critereId">): ModuleRepere {
  return { id: m.id, titre: m.titre, critere: typeof m.critereId === "string" && m.critereId !== A_PRECISER ? m.critereId : "" };
}

/**
 * Modules qui peuvent recevoir un dépôt : tous, sauf les modules déposés
 * retirés — une ligne « Module : » ne les désigne pas, la proposition ne les
 * propose pas (question 57). La liste de l'aperçu les garde, comme le reste
 * de la banque.
 */
export async function modulesOuvertsAuDepot(): Promise<Module[]> {
  return (await getTousModulesAvecDeposes()).filter((m) => m.statut !== "retire");
}

/** Liste « code — titre » donnée à l'assistant dans le prompt de mise en forme. */
export async function listeModulesPourPrompt(): Promise<{ repere: string; titre: string }[]> {
  const modules = (await modulesOuvertsAuDepot()).map(versRepere);
  const noms = reperesModules(modules);
  return modules.map((m) => ({ repere: noms.get(m.id) ?? m.id, titre: m.titre }));
}

/** Ce qui précède le titre d'un module dans une liste : son critère, ou « Dépôt » pour un module déposé. */
export function etiquetteModule(m: Pick<Module, "critereId" | "origine">): string {
  if (m.origine === "base") return typeof m.critereId === "string" && m.critereId !== A_PRECISER ? `Dépôt · ${m.critereId}` : "Dépôt";
  return typeof m.critereId === "string" ? m.critereId : "—";
}

export function titreModule(modules: Pick<Module, "id" | "titre" | "critereId" | "origine">[], id: string): string {
  const m = modules.find((x) => x.id === id);
  return m ? `${etiquetteModule(m)} — ${m.titre}` : id;
}

/**
 * L'identifiant d'un module qui s'ouvre encore, pour un lien (tâche 69) ; sinon
 * `null`, et son nom reste du texte. En tutorat et en administration, un module
 * déposé s'ouvre quel que soit son statut : la liste passée doit être complète.
 */
export function moduleOuvrable(modules: Pick<Module, "id">[], id: string | null | undefined): string | null {
  return id && modules.some((x) => x.id === id) ? id : null;
}

export const LIBELLES_STATUT: Record<string, string> = {
  a_verifier: "À vérifier",
  valide: "Validée",
  retire: "Retirée",
};

/** Ligne de base → valeurs initiales du formulaire. */
export function versInitiale(l: LigneQuestion): QuestionInitiale {
  return {
    id: l.id,
    moduleId: l.module_id,
    situationId: l.situation_id,
    format: l.format,
    enonce: l.enonce,
    options: l.options,
    legendes: l.legendes,
    modeReponse: l.mode_reponse,
    imageUrl: l.image_id ? `/api/images/${l.image_id}` : null,
    imageLargeur: l.image_largeur ?? 0,
    imageHauteur: l.image_hauteur ?? 0,
    imageAlt: l.image_alt ?? "",
    justification: l.justification,
    eliminatoire: l.eliminatoire,
    reservee: l.reservee,
    obligatoire: l.obligatoire,
    niveauQuestion: l.niveau_question ?? null,
    references: l.refs
      .map((r) => [r.source, r.libelle, r.date, r.url, r.localisation].filter(Boolean).join(" — "))
      .join("\n"),
    statut: l.statut,
    aussiDans: l.aussi_dans,
    blocs: l.blocs,
    profilFilieres: l.profil_filieres,
    profilNiveaux: l.profil_niveaux,
  };
}
