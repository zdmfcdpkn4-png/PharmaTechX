import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { conservationNominative } from "@/lib/config";
import { baseConfiguree } from "@/lib/db";
import { journaliser } from "@/lib/journal";
import { lireRapport } from "@/lib/rapports";
import { csvRegistre, jsonArchive } from "@/lib/registre";
import { zip } from "@/lib/zip";
import { rendreRapportEnregistre } from "../rendu";

export const dynamic = "force-dynamic";

/**
 * Paquet d'archivage d'un rapport clos — les trois fichiers de la console
 * métrologique (« Valider et archiver ») en une archive : le rapport HTML
 * autoportant signé, la ligne CSV du registre, le JSON complet.
 * Rien n'est téléchargé automatiquement : le pharmacien le demande quand il
 * dépose le dossier (décision : question 3, choix b).
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!baseConfiguree() || !conservationNominative()) return new NextResponse(null, { status: 404 });
  const session = await getSession();
  if (!session || session.role === "poste") return new NextResponse("Accès réservé.", { status: 403 });
  const r = await lireRapport(id);
  if (!r) return new NextResponse(null, { status: 404 });
  if (r.statut !== "clos") {
    return new NextResponse("Le paquet d'archivage n'existe que pour un rapport clos.", { status: 409 });
  }
  const base = r.numero;
  const archive = zip([
    { nom: `${base}.html`, contenu: await rendreRapportEnregistre(r) },
    { nom: `${base}.csv`, contenu: csvRegistre([r]) },
    { nom: `${base}.json`, contenu: jsonArchive(r) },
  ]);
  await journaliser(session, "export:paquet", `rapport:${r.numero}`);
  return new NextResponse(new Uint8Array(archive), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${base}.zip"`,
      "Cache-Control": "private, no-store",
    },
  });
}
