"use client";

import { useSessionFormation } from "./SessionFormation";
import { VignetteModule } from "./VignetteModule";

/**
 * Vignette du titre d'un module (96 px) : la coche de validation suit la
 * mémoire de session, qui ne vit que dans le navigateur — la page, rendue au
 * serveur, ne la connaît pas. Premier rendu sans coche ; elle paraît avec les
 * résultats, comme sur les cartes de « Mes modules ».
 */
export function VignetteTitre({ moduleId, badge }: { moduleId: string; badge?: string | null }) {
  const { dernierPourModule } = useSessionFormation();
  return <VignetteModule badge={badge} taille={96} acquis={dernierPourModule(moduleId)?.reussi === true} />;
}
