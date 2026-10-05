import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { baseConfiguree, documentsDuFichier } from "@/lib/db";
import { lireFichier } from "@/lib/stockage";
import { fichierOuvert, profilImpose } from "@/lib/profil-impose";
import { programmeDuPoste } from "@/lib/programme-poste";

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
  const session = await getSession();
  if (!session) return new NextResponse(null, { status: 401, headers: { "Cache-Control": "no-store" } });
  // Question 101 (choix b) : un code de poste ne reçoit que les documents de son programme — ceux d'un module
  // ouvert, ou les documents généraux de son profil. Un module sans question ne lui est pas ouvert (05/10/2026).
  const impose = profilImpose(session, baseConfiguree());
  if (impose) {
    const [documents, poste] = await Promise.all([documentsDuFichier(`/api/fichiers/${id}`), programmeDuPoste(session, impose)]);
    if (!fichierOuvert(documents, poste.ouverts, poste.profil)) {
      return new NextResponse(null, { status: 403, headers: { "Cache-Control": "no-store" } });
    }
  }
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
