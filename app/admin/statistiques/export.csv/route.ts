import { NextResponse, type NextRequest } from "next/server";
import { getReferentiel } from "@/content/referentiel-db";
import { listeBlocs } from "@/content/blocs-db";
import { getModule, getTousModulesAvecDeposes } from "@/content/store";
import { listerQuestions } from "@/content/banque-db";
import { banqueDuModule } from "@/content/types";
import { getSession } from "@/lib/auth";
import { conservationActive } from "@/lib/config";
import { baseConfiguree } from "@/lib/db";
import { journaliser } from "@/lib/journal";
import { csv, nomDate } from "@/lib/registre";
import {
  LIBELLES_REPERE,
  analyserElements,
  analyserQuestions,
  bilansModules,
  classerModules,
  type Tentative,
} from "@/lib/statistiques";
import { lireEssais } from "@/lib/statistiques-db";
import { resoudreFiltre } from "../commun";

export const dynamic = "force-dynamic";

/**
 * Tableurs des statistiques (question 78, choix a, 25/09/2026) : modules,
 * questions ou réponses, au périmètre de l'écran. Agrégés comme à l'écran —
 * aucune ligne par agent — et sous les mêmes seuils : un taux absent de
 * l'écran l'est aussi du fichier.
 */
export async function GET(req: NextRequest) {
  if (!baseConfiguree() || !conservationActive()) return new NextResponse(null, { status: 404 });
  const session = await getSession();
  if (!session || session.role === "poste") return new NextResponse("Accès réservé.", { status: 403 });

  const q = req.nextUrl.searchParams;
  const type = q.get("type");
  if (type !== "modules" && type !== "questions" && type !== "elements") {
    return new NextResponse("Type de tableur inconnu.", { status: 400 });
  }
  const [{ filieres, niveaux }, modules, blocs] = await Promise.all([
    getReferentiel(),
    getTousModulesAvecDeposes({ publiesSeulement: false }),
    listeBlocs(),
  ]);
  const f = resoudreFiltre(
    { filiere: q.get("filiere") ?? undefined, niveau: q.get("niveau") ?? undefined, bloc: q.get("bloc") ?? undefined, periode: q.get("periode") ?? undefined },
    modules,
    filieres,
    niveaux,
    blocs,
  );
  const moduleId = q.get("module");
  if (type === "elements" && !moduleId) return new NextResponse("Module requis.", { status: 400 });
  const perimetre = moduleId ? [moduleId] : f.modules;
  const essais = await lireEssais(perimetre, { details: type !== "modules" });

  let corps: string;
  let lignes: number;
  if (type === "modules") {
    const bilans = classerModules(bilansModules(essais, f.depuis));
    lignes = bilans.length;
    corps = csv(
      ["Module", "Identifiant", "Agents", "Essais", "Premiers essais", "Réussite au premier essai (%)", "IC 95 % bas", "IC 95 % haut", "Réussite finale (%)", "Essais pour réussir", "Score médian au premier essai (%)", "À revoir"],
      bilans.map((b) => ({
        Module: b.titre,
        Identifiant: b.moduleId,
        Agents: b.agents,
        Essais: b.essais,
        "Premiers essais": b.premierEssai.n,
        "Réussite au premier essai (%)": b.premierEssai.taux,
        "IC 95 % bas": b.premierEssai.bas,
        "IC 95 % haut": b.premierEssai.haut,
        "Réussite finale (%)": b.final.taux,
        "Essais pour réussir": b.essaisPourReussir,
        "Score médian au premier essai (%)": b.scoreMedianPremier,
        "À revoir": b.aRevoir ? "oui" : "",
      })),
    );
  } else if (type === "questions") {
    // Module par module : une question posée dans deux modules y a deux lignes, chacune dans son contexte.
    const parModule = new Map<string, Tentative[]>();
    for (const e of essais) parModule.set(e.moduleId, [...(parModule.get(e.moduleId) ?? []), e]);
    const rangs = [...parModule.entries()].flatMap(([mid, l]) =>
      analyserQuestions(l, f.depuis).map((a) => ({ mid, titre: l[l.length - 1].moduleTitre, a })),
    );
    lignes = rangs.length;
    corps = csv(
      ["Module", "Question", "Identifiant", "Type", "Posée", "Réussie (%)", "IC 95 % bas", "IC 95 % haut", "Discrimination", "Sans réponse (%)", "Repères"],
      rangs.map(({ mid, titre, a }) => ({
        Module: titre || mid,
        Question: a.enonce,
        Identifiant: a.questionId,
        Type: a.type,
        Posée: a.n,
        "Réussie (%)": a.reussite.taux,
        "IC 95 % bas": a.reussite.bas,
        "IC 95 % haut": a.reussite.haut,
        Discrimination: a.discrimination,
        "Sans réponse (%)": a.sansReponse.taux,
        Repères: a.reperes.map((r) => LIBELLES_REPERE[r]).join(", "),
      })),
    );
  } else {
    const code = getModule(moduleId!);
    const enBase = await listerQuestions({ moduleId: moduleId! }).catch(() => []);
    const options = new Map<string, string[]>([
      ...(code ? banqueDuModule(code) : []).map((x): [string, string[]] => [x.id, x.options.map((o) => o.texte)]),
      ...enBase.map((x): [string, string[]] => [x.id, x.options.map((o) => o.texte)]),
    ]);
    const elements = analyserElements(essais, f.depuis, options);
    lignes = elements.length;
    corps = csv(
      ["Question", "Identifiant", "Nature", "Élément", "Présent", "Erreurs", "Sans réponse", "Non départagé", "Taux d'erreur (%)", "Ne piège personne"],
      elements.map((e) => ({
        Question: e.enonce,
        Identifiant: e.questionId,
        Nature: e.nature,
        Élément: e.element,
        Présent: e.n,
        Erreurs: e.erreurs,
        "Sans réponse": e.sansReponse,
        "Non départagé": e.nonDepartage,
        "Taux d'erreur (%)": e.tauxErreur.taux,
        "Ne piège personne": e.nonFonctionnel ? "oui" : "",
      })),
    );
  }

  await journaliser(session, "export:statistiques", moduleId ? `module:${moduleId}` : "", { type, lignes, periode: f.periode.cle });
  return new NextResponse(corps, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nomDate(`statistiques_${type}`, "csv")}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
