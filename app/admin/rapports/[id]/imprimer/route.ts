import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { conservationNominative } from "@/lib/config";
import { baseConfiguree } from "@/lib/db";
import { lireRapport } from "@/lib/rapports";
import { rendreRapportEnregistre } from "../rendu";

export const dynamic = "force-dynamic";

/** Rapport A4 d'un enregistrement, avec sa décision, ses visas et la signature incrustée, prêt à imprimer. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!baseConfiguree() || !conservationNominative()) return new NextResponse(null, { status: 404 });
  const session = await getSession();
  if (!session || session.role === "poste") return new NextResponse("Accès réservé.", { status: 403 });
  const r = await lireRapport(id);
  if (!r) return new NextResponse(null, { status: 404 });
  const html = await rendreRapportEnregistre(r);
  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store" },
  });
}
