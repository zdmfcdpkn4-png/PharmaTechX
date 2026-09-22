import { getTousModulesAvecDeposes } from "@/content/store";
import { A_PRECISER, type Module } from "@/content/types";
import type { ModuleChoix } from "@/components/EditeurQuestion";
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
  }));
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
    niveauQuestion: l.niveau_question ?? null,
    references: l.refs
      .map((r) => [r.source, r.libelle, r.date, r.url, r.localisation].filter(Boolean).join(" — "))
      .join("\n"),
    statut: l.statut,
  };
}
