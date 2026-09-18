import { NextResponse } from "next/server";
import { refusApiSansSession } from "@/lib/auth";
import { baseConfiguree } from "@/lib/db";
import { lireImage } from "@/lib/images";

export const dynamic = "force-dynamic";

/** Image d'un schéma à compléter. Le contenu ne change jamais pour un identifiant donné. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const refus = await refusApiSansSession();
  if (refus) return refus;
  if (!baseConfiguree() || !/^[A-Za-z0-9_-]{8,20}$/.test(id)) return new NextResponse(null, { status: 404 });
  const im = await lireImage(id);
  if (!im) return new NextResponse(null, { status: 404 });
  return new NextResponse(new Uint8Array(im.octets), {
    headers: {
      "Content-Type": im.type,
      "Cache-Control": "private, max-age=86400, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
