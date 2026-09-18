import { NextResponse } from "next/server";
import { baseConfiguree, baseJoignable } from "@/lib/db";
import { modeStockage } from "@/lib/stockage";
import { modeConservation } from "@/lib/config";
import { secretConfigure } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Page de santé pour l'hébergeur (Render : healthCheckPath) et pour
 * l'exploitant. `commit` et `branche` viennent des variables que Render pose
 * sur chaque déploiement (`RENDER_GIT_COMMIT`, `RENDER_GIT_BRANCH`) : elles
 * disent quelle version est en ligne, à consigner au dossier qualité ; `null`
 * ailleurs.
 */
export async function GET() {
  const base = baseConfiguree();
  const joignable = base ? await baseJoignable() : false;
  return NextResponse.json(
    {
      ok: true,
      base: base ? (joignable ? "joignable" : "injoignable") : "non-configuree",
      stockage: modeStockage(),
      conservation: modeConservation(),
      secret: secretConfigure() ? "defini" : "absent",
      // Horloge du serveur (ISO 8601, UTC) : à comparer à une référence de temps
      // pour vérifier la source de temps de l'hébergeur (preuve opposable).
      horloge: new Date().toISOString(),
      commit: process.env.RENDER_GIT_COMMIT || null,
      branche: process.env.RENDER_GIT_BRANCH || null,
    },
    { status: base && !joignable ? 503 : 200, headers: { "Cache-Control": "no-store" } },
  );
}
