import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { conservationActive } from "@/lib/config";
import { baseConfiguree } from "@/lib/db";
import { journaliser } from "@/lib/journal";
import { repertoirePersonnel } from "@/lib/rapports";
import { csvRepertoire, nomDate } from "@/lib/registre";

export const dynamic = "force-dynamic";

/** Répertoire du personnel : une ligne par agent et par critère, dernier rapport non annulé. */
export async function GET() {
  if (!baseConfiguree() || !conservationActive()) return new NextResponse(null, { status: 404 });
  const session = await getSession();
  if (!session || session.role === "poste") return new NextResponse("Accès réservé.", { status: 403 });
  const lignes = await repertoirePersonnel();
  await journaliser(session, "export:repertoire", "", { lignes: lignes.length });
  return new NextResponse(csvRepertoire(lignes), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nomDate("repertoire_personnel", "csv")}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
