import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { conservationNominative, dureeConservationMois } from "@/lib/config";
import { baseConfiguree } from "@/lib/db";
import { lireRapport } from "@/lib/rapports";
import { construireRapport, type VisaRapport } from "@/lib/rapport";

export const dynamic = "force-dynamic";

/** Rapport A4 d'un enregistrement, avec ses visas, prêt à imprimer. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!baseConfiguree() || !conservationNominative()) return new NextResponse(null, { status: 404 });
  const session = await getSession();
  if (!session || session.role === "poste") return new NextResponse("Accès réservé.", { status: 403 });
  const r = await lireRapport(id);
  if (!r) return new NextResponse(null, { status: 404 });
  const visas: VisaRapport[] = r.visas.map((v) => ({
    qualite: v.qualite,
    nom: v.nom,
    date: new Date(v.signe_le).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Paris" }),
    commentaire: v.commentaire || undefined,
  }));
  const html = construireRapport(
    { nom: r.apprenant_nom, qualite: r.apprenant_qualite, parcours: "" },
    [r.resultat],
    {
      numero: r.numero,
      empreinte: r.empreinte,
      visas,
      conservation: "nominative",
      dureeConservationMois: dureeConservationMois(),
      dateEdition: new Date(r.emis_le),
    },
  );
  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store" },
  });
}
