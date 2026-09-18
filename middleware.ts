import { NextResponse, type NextRequest } from "next/server";
import { jetonValide } from "@/lib/jeton-web";

/**
 * Tout le site derrière un code (décision du 18/09/2026, question 13,
 * choix c) : dès qu'une base est configurée, chaque page et chaque route
 * d'API exige une session de rôle valide — poste, tutorat ou
 * administration —, sauf la connexion, la page d'information sur les
 * données personnelles et la page de santé. Sans base, le site reste en mode
 * ouvert, comme la page de connexion le signale. Les pages vérifient encore
 * le rôle de leur côté : ce filtre ne remplace pas `sessionRequise`.
 */

const PUBLIQUES = [/^\/connexion(?:\/|$)/, /^\/donnees-personnelles(?:\/|$)/, /^\/api\/sante(?:\/|$)/];

export const config = {
  matcher: ["/((?!_next/|favicon\\.ico$|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|woff2?)$).*)"],
};

export async function middleware(req: NextRequest) {
  if (!(process.env.DATABASE_URL || process.env.POSTGRES_URL)) return NextResponse.next();
  const { pathname, search } = req.nextUrl;
  if (PUBLIQUES.some((r) => r.test(pathname))) return NextResponse.next();
  const jeton = req.cookies.get("fp_session")?.value;
  if (jeton && (await jetonValide(jeton, process.env.AUTH_SECRET))) return NextResponse.next();
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ erreur: "Session requise." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/connexion";
  url.search = "";
  if (pathname !== "/" || search) url.searchParams.set("suite", pathname + search);
  return NextResponse.redirect(url);
}
