import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { baseConfiguree } from "@/lib/db";
import { lireFichier } from "@/lib/stockage";

export const dynamic = "force-dynamic";

/**
 * Documents déposés quand aucun store Blob n'est branché : servis depuis la
 * table `fichiers`, **aux sessions ouvertes par un code seulement** (poste,
 * tutorat, administration) — décision du 18/09/2026, question 13, choix b :
 * une procédure interne ne sort pas de l'établissement par une adresse qui
 * circule. Un store Blob, lui, sert des adresses publiques : il est
 * incompatible avec cette règle (docs/DEPLOIEMENT.md).
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!baseConfiguree() || !/^[A-Za-z0-9_-]{8,40}$/.test(id)) return new NextResponse(null, { status: 404 });
  if (!(await getSession())) return new NextResponse(null, { status: 401, headers: { "Cache-Control": "no-store" } });
  const f = await lireFichier(id);
  if (!f) return new NextResponse(null, { status: 404 });
  return new NextResponse(new Uint8Array(f.octets), {
    headers: {
      "Content-Type": f.type,
      "Content-Length": String(f.taille),
      "Content-Disposition": `inline; filename="${f.nom}"`,
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
