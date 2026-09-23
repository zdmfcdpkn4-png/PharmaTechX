import { NextResponse } from "next/server";
import { getSession, refusApiSansSession } from "@/lib/auth";
import { baseConfiguree } from "@/lib/db";
import { enregistrerSignalement, enregistrerSignalementFiche } from "@/content/banque-db";
import { MOTIFS_SIGNALEMENT, MOTIFS_SIGNALEMENT_FICHE } from "@/content/signalements";
import { numeroDeFiche } from "@/content/fiches";
import { lireFiche } from "@/lib/fiches-db";
import { getModuleComplet } from "@/content/store";
import { banqueDuModule } from "@/content/types";

export const dynamic = "force-dynamic";

/**
 * Signalement d'une question par un apprenant — repris du Lecteur QIM · QCM :
 * un motif fermé, une note libre, rien qui désigne la personne. Le tuteur
 * arbitre depuis l'administration.
 *
 * Une fiche de synthèse se signale par la même route (question 60, choix a,
 * 23/09/2026), avec ses propres motifs : seule une fiche validée du module —
 * celle que l'apprenant a sous les yeux — peut l'être. Sans effet sur les
 * rapports : les verrous ne lisent que les signalements de questions.
 */
export async function POST(request: Request) {
  const refus = await refusApiSansSession();
  if (refus) return refus;
  if (!baseConfiguree()) {
    return NextResponse.json({ erreur: "Signalement indisponible sans base de données." }, { status: 503 });
  }
  let corps: { questionId?: unknown; ficheId?: unknown; moduleId?: unknown; motif?: unknown; note?: unknown };
  try {
    corps = await request.json();
  } catch {
    return NextResponse.json({ erreur: "Requête illisible." }, { status: 400 });
  }
  if (typeof corps.ficheId === "string") return signalerFiche(corps);
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
  // Mode test (23/09/2026) : rien n'est écrit. Un signalement ouvert bloquerait
  // les visas de tous les rapports réels dont le tirage contient la question.
  if ((await getSession())?.essai) {
    return NextResponse.json({ ok: false, essai: true }, { headers: { "Cache-Control": "no-store" } });
  }
  await enregistrerSignalement({ questionId, moduleId, motif, note });
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}

async function signalerFiche(corps: { ficheId?: unknown; moduleId?: unknown; motif?: unknown; note?: unknown }) {
  const numero = numeroDeFiche(String(corps.ficheId).slice(0, 40));
  const moduleId = typeof corps.moduleId === "string" ? corps.moduleId.slice(0, 80) : "";
  const motif = typeof corps.motif === "string" ? corps.motif : "";
  const note = typeof corps.note === "string" ? corps.note.trim().slice(0, 1000) : "";
  if (numero === null || !moduleId || !(MOTIFS_SIGNALEMENT_FICHE as readonly string[]).includes(motif)) {
    return NextResponse.json({ erreur: "Signalement incomplet." }, { status: 400 });
  }
  const fiche = await lireFiche(numero);
  if (!fiche || fiche.module_id !== moduleId || fiche.statut !== "valide") {
    return NextResponse.json({ erreur: "Fiche inconnue." }, { status: 404 });
  }
  // Mode test : rien n'est écrit, comme pour une question.
  if ((await getSession())?.essai) {
    return NextResponse.json({ ok: false, essai: true }, { headers: { "Cache-Control": "no-store" } });
  }
  await enregistrerSignalementFiche({ depotId: numero, moduleId, motif, note });
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
