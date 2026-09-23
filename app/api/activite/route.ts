import { NextResponse } from "next/server";
import { etatSession, lireActivite, noterActivite } from "@/lib/auth";
import { baseConfiguree } from "@/lib/db";
import { resteAvantInactivite } from "@/lib/inactivite";
import { rattachement } from "@/lib/progression";

export const dynamic = "force-dynamic";

const SANS_CACHE = { "Cache-Control": "no-store" };

/**
 * Activité de l'utilisateur (déconnexion après quatre heures sans activité,
 * 23/09/2026, `lib/inactivite.ts`).
 *
 * POST : le navigateur signale qu'on se sert de la page — clic, touche,
 * molette, toucher —, au plus une fois par minute (`components/VeilleInactivite`).
 * L'activité est notée pour la session et, s'il vaut encore, pour le
 * rattachement de l'apprenant ; en mode test, le rattachement laissé sur le
 * poste n'est pas entretenu par le testeur.
 *
 * GET : un onglet resté sans activité demande combien de temps il reste,
 * sans rien prolonger — un autre onglet a pu entretenir la session.
 *
 * Une session déjà fermée pour inactivité n'arrive pas jusqu'ici : le filtre
 * d'entrée répond 401 avec le motif et efface les cookies.
 */
function refus(fermee: boolean) {
  return NextResponse.json(
    fermee ? { erreur: "Session fermée : le code d'accès a été retiré.", code: "session-fermee" } : { erreur: "Session requise." },
    { status: 401, headers: SANS_CACHE },
  );
}

export async function POST() {
  if (!baseConfiguree()) return new NextResponse(null, { status: 204, headers: SANS_CACHE });
  const { session, fermee } = await etatSession();
  if (!session) return refus(fermee);
  const r = await rattachement();
  await noterActivite([session.sid, r?.sid]);
  return NextResponse.json({ reste: resteAvantInactivite(session, { vu: Date.now() / 1000, sids: [session.sid] }) }, { headers: SANS_CACHE });
}

export async function GET() {
  if (!baseConfiguree()) return new NextResponse(null, { status: 204, headers: SANS_CACHE });
  const { session, fermee } = await etatSession();
  if (!session) return refus(fermee);
  return NextResponse.json({ reste: resteAvantInactivite(session, await lireActivite()) }, { headers: SANS_CACHE });
}
