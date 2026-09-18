import { NextResponse } from "next/server";
import { baseConfiguree } from "@/lib/db";
import { lireFichier } from "@/lib/stockage";

export const dynamic = "force-dynamic";

/**
 * Documents déposés quand aucun store Blob n'est branché : servis depuis la
 * table `fichiers`. Accès identique à celui des documents Blob (ouvert à qui
 * a l'adresse), comme dans la version précédente — à restreindre si les
 * procédures internes ne doivent pas sortir de l'établissement : [à préciser].
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!baseConfiguree() || !/^[A-Za-z0-9_-]{8,40}$/.test(id)) return new NextResponse(null, { status: 404 });
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
