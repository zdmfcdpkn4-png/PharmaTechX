import { NextResponse } from "next/server";
import { baseConfiguree, etatBase } from "@/lib/db";
import { familleIp, libelleFamille } from "@/lib/reseau";
import { modeStockage } from "@/lib/stockage";
import { miseEnService, modeConservation } from "@/lib/config";
import { secretConfigure } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Page de santé pour l'hébergeur (Render : healthCheckPath) et pour
 * l'exploitant. `commit` et `branche` viennent des variables que Render pose
 * sur chaque déploiement (`RENDER_GIT_COMMIT`, `RENDER_GIT_BRANCH`) : elles
 * disent quelle version est en ligne, à consigner au dossier qualité ; `null`
 * ailleurs. `base_ip` est la famille d'adresses imposée pour joindre la base
 * (`DATABASE_IP`, « 4 » par défaut) et `base_erreur` le code de la dernière
 * erreur de connexion, pour diagnostiquer une migration sans lire les journaux.
 */
export async function GET() {
  const base = baseConfiguree();
  const etat = base
    ? await etatBase()
    : { joignable: false, erreur: null, instance: null, refus: null };
  let baseIp: string;
  try {
    baseIp = libelleFamille(familleIp());
  } catch {
    baseIp = "invalide";
  }
  return NextResponse.json(
    {
      ok: true,
      base: base
        ? etat.refus ? "refusee"
        : etat.joignable ? "joignable"
        : "injoignable"
        : "non-configuree",
      base_ip: baseIp,
      base_erreur: etat.erreur,
      // Étiquette d'instance et refus (question 23, choix b) : la base servie
      // n'est pas celle que l'environnement déclare (`BASE_ATTENDUE`).
      base_instance: etat.instance,
      base_refus: etat.refus,
      stockage: modeStockage(),
      conservation: modeConservation(),
      secret: secretConfigure() ? "defini" : "absent",
      // Horloge du serveur (ISO 8601, UTC) : à comparer à une référence de temps
      // pour vérifier la source de temps de l'hébergeur (preuve opposable).
      horloge: new Date().toISOString(),
      commit: process.env.RENDER_GIT_COMMIT || null,
      branche: process.env.RENDER_GIT_BRANCH || null,
      // Date de mise en service comme preuve ; null = phase d'essai.
      mise_en_service: miseEnService(),
    },
    { status: base && !etat.joignable ? 503 : 200, headers: { "Cache-Control": "no-store" } },
  );
}
