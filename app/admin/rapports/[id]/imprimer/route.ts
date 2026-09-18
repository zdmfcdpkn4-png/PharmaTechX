import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { conservationActive } from "@/lib/config";
import { baseConfiguree } from "@/lib/db";
import { journaliser } from "@/lib/journal";
import { lireRapport } from "@/lib/rapports";
import { lireEdition, rendreRapportEnregistre } from "../rendu";

export const dynamic = "force-dynamic";

/**
 * Rapport A4 d'un enregistrement, avec sa décision, ses visas et la signature
 * incrustée, prêt à imprimer. En GET, le rapport est pseudonyme. En POST, le
 * formulaire peut porter un nom et une fonction : ils sont imprimés hors
 * sceau, jamais enregistrés (décision du 18/09/2026, question 6, choix a).
 */
async function repondre(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!baseConfiguree() || !conservationActive()) return new NextResponse(null, { status: 404 });
  const session = await getSession();
  if (!session || session.role === "poste") return new NextResponse("Accès réservé.", { status: 403 });
  const r = await lireRapport(id);
  if (!r) return new NextResponse(null, { status: 404 });
  const edition = await lireEdition(req);
  const html = await rendreRapportEnregistre(r, edition);
  await journaliser(session, "export:impression", `rapport:${r.numero}`, { nominative: Boolean(edition) });
  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store" },
  });
}

export const GET = repondre;
export const POST = repondre;
