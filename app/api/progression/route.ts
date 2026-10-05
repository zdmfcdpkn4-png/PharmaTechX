import { NextResponse } from "next/server";
import { getSession, refusApiSansSession } from "@/lib/auth";
import { baseConfiguree } from "@/lib/db";
import { moduleExiste } from "@/content/store";
import { profilImpose, refusDuPoste } from "@/lib/profil-impose";
import { programmeDuPoste } from "@/lib/programme-poste";
import {
  effacerEnCours,
  enregistrerEntrainement,
  enregistrerLecture,
  rattachement,
  sauverEnCours,
} from "@/lib/progression";

export const dynamic = "force-dynamic";

/**
 * Traces de progression envoyées par le navigateur quand l'apprenant est
 * rattaché à son identifiant (question 11, choix c) : fin d'un entraînement,
 * lecture d'un module, sauvegarde ou effacement de l'évaluation en cours.
 * Sans rattachement, rien n'est écrit et la réponse le dit. Les évaluations,
 * elles, sont conservées par la route de correction, avec leur sceau.
 */
export async function POST(request: Request) {
  const refus = await refusApiSansSession();
  if (refus) return refus;
  const r = await rattachement();
  if (!r) return NextResponse.json({ ok: false, raison: "non-rattache" }, { headers: { "Cache-Control": "no-store" } });
  let corps: { nature?: unknown; moduleId?: unknown; etat?: unknown; justes?: unknown; total?: unknown; points?: unknown; tirage?: unknown };
  try {
    corps = await request.json();
  } catch {
    return NextResponse.json({ erreur: "Requête illisible." }, { status: 400 });
  }
  const moduleId = typeof corps.moduleId === "string" ? corps.moduleId.slice(0, 80) : "";
  if (!moduleId || !(await moduleExiste(moduleId))) {
    return NextResponse.json({ erreur: "Module inconnu." }, { status: 404 });
  }
  // Question 101 (choix b) : un code de poste ne laisse de traces que sur les modules de son programme qui
  // lui sont ouverts — ceux qui ont des questions (05/10/2026).
  const session = await getSession();
  const impose = profilImpose(session, baseConfiguree());
  const fermeture = impose && session ? refusDuPoste(await programmeDuPoste(session, impose), moduleId) : null;
  if (fermeture) {
    return NextResponse.json(
      { erreur: fermeture === "hors-programme" ? "Module hors de votre programme." : "Module sans question validée : il n'est pas ouvert." },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }
  const nombre = (v: unknown, max: number) => (typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(0, v)) : 0);
  let ok = false;
  if (corps.nature === "entrainement") {
    ok = await enregistrerEntrainement(r.agentId, moduleId, {
      justes: Math.round(nombre(corps.justes, 500)),
      total: Math.round(nombre(corps.total, 500)),
      points: Math.round(nombre(corps.points, 500) * 100) / 100,
      tirage: typeof corps.tirage === "string" ? corps.tirage.slice(0, 80) : "",
    });
  } else if (corps.nature === "lecture") {
    ok = await enregistrerLecture(r.agentId, moduleId);
  } else if (corps.nature === "en_cours") {
    if (corps.etat === null) {
      await effacerEnCours(r.agentId, moduleId);
      ok = true;
    } else {
      ok = await sauverEnCours(r.agentId, moduleId, corps.etat);
      if (!ok) return NextResponse.json({ erreur: "État illisible." }, { status: 400 });
    }
  } else {
    return NextResponse.json({ erreur: "Nature inconnue." }, { status: 400 });
  }
  return NextResponse.json({ ok }, { headers: { "Cache-Control": "no-store" } });
}
