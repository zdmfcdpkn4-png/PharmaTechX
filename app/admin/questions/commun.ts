import { getTousModules } from "@/content/store";
import type { ModuleChoix } from "@/components/EditeurQuestion";
import type { LigneQuestion } from "@/content/banque-db";
import type { QuestionInitiale } from "@/components/EditeurQuestion";

export function choixModules(): ModuleChoix[] {
  return getTousModules().map((m) => ({
    id: m.id,
    titre: m.titre,
    critereId: typeof m.critereId === "string" ? m.critereId : "—",
    redige: m.redige,
  }));
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
    references: l.refs
      .map((r) => [r.source, r.libelle, r.date, r.url, r.localisation].filter(Boolean).join(" — "))
      .join("\n"),
    statut: l.statut,
  };
}
