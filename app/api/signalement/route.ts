import { NextResponse } from "next/server";
import { baseConfiguree } from "@/lib/db";
import { enregistrerSignalement } from "@/content/banque-db";
import { MOTIFS_SIGNALEMENT } from "@/content/signalements";
import { getModuleComplet } from "@/content/store";
import { banqueDuModule } from "@/content/types";

export const dynamic = "force-dynamic";

/**
 * Signalement d'une question par un apprenant — repris du Lecteur QIM · QCM :
 * un motif fermé, une note libre, rien qui désigne la personne. Le tuteur
 * arbitre depuis l'administration.
 */
export async function POST(request: Request) {
  if (!baseConfiguree()) {
    return NextResponse.json({ erreur: "Signalement indisponible sans base de données." }, { status: 503 });
  }
  let corps: { questionId?: unknown; moduleId?: unknown; motif?: unknown; note?: unknown };
  try {
    corps = await request.json();
  } catch {
    return NextResponse.json({ erreur: "Requête illisible." }, { status: 400 });
  }
  const questionId = typeof corps.questionId === "string" ? corps.questionId.slice(0, 80) : "";
  const moduleId = typeof corps.moduleId === "string" ? corps.moduleId.slice(0, 80) : "";
  const motif = typeof corps.motif === "string" ? corps.motif : "";
  const note = typeof corps.note === "string" ? corps.note.trim().slice(0, 1000) : "";
  if (!questionId || !moduleId || !(MOTIFS_SIGNALEMENT as readonly string[]).includes(motif)) {
    return NextResponse.json({ erreur: "Signalement incomplet." }, { status: 400 });
  }
  const mod = await getModuleComplet(moduleId);
  if (!mod || !banqueDuModule(mod).some((q) => q.id === questionId)) {
    return NextResponse.json({ erreur: "Question inconnue." }, { status: 404 });
  }
  await enregistrerSignalement({ questionId, moduleId, motif, note });
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
