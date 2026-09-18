import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { conservationActive } from "@/lib/config";
import { baseConfiguree } from "@/lib/db";
import { journaliser } from "@/lib/journal";
import { listerRapportsComplets } from "@/lib/rapports";
import { csvRegistre, nomDate } from "@/lib/registre";

export const dynamic = "force-dynamic";

/** Registre cumulatif : une ligne par rapport, tous statuts, à tout moment. */
export async function GET() {
  if (!baseConfiguree() || !conservationActive()) return new NextResponse(null, { status: 404 });
  const session = await getSession();
  if (!session || session.role === "poste") return new NextResponse("Accès réservé.", { status: 403 });
  const rapports = await listerRapportsComplets();
  await journaliser(session, "export:registre", "", { rapports: rapports.length });
  return new NextResponse(csvRegistre(rapports), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nomDate("registre_rapports", "csv")}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
