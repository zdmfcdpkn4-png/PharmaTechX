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
 *
 * Session liée à son code (question 16, choix b) : ce filtre n'a pas la base
 * et ne vérifie que la signature. Sur les chemins qu'il garde, il pose
 * l'en-tête interne `x-fp-chemin` (page demandée) ; le gabarit racine s'en
 * sert pour renvoyer à la connexion une session dont le code a été retiré.
 * L'en-tête est toujours retiré de la requête entrante : jamais repris du
 * client.
 */

const PUBLIQUES = [/^\/connexion(?:\/|$)/, /^\/donnees-personnelles(?:\/|$)/, /^\/api\/sante(?:\/|$)/];

export const config = {
  matcher: ["/((?!_next/|favicon\\.ico$|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|woff2?)$).*)"],
};

export async function middleware(req: NextRequest) {
  const entetes = new Headers(req.headers);
  entetes.delete("x-fp-chemin");
  const suivant = () => NextResponse.next({ request: { headers: entetes } });
  if (!(process.env.DATABASE_URL || process.env.POSTGRES_URL)) return suivant();
  const { pathname, search } = req.nextUrl;
  if (PUBLIQUES.some((r) => r.test(pathname))) return suivant();
  const jeton = req.cookies.get("fp_session")?.value;
  if (jeton && (await jetonValide(jeton, process.env.AUTH_SECRET))) {
    entetes.set("x-fp-chemin", pathname + search);
    return suivant();
  }
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ erreur: "Session requise." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/connexion";
  url.search = "";
  if (pathname !== "/" || search) url.searchParams.set("suite", pathname + search);
  return NextResponse.redirect(url);
}
