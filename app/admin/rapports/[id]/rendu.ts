import "server-only";
import { dureeConservationMois, miseEnService, procedureReference } from "@/lib/config";
import { contexteDecision, type RapportComplet } from "@/lib/rapports";
import { dataUri, lireSignature } from "@/lib/signatures";
import type { EditionRapport } from "@/lib/registre";
import { construireRapport, type VisaRapport } from "@/lib/rapport";
import { logosIncorpores } from "@/lib/logos";

/**
 * Rendu HTML autoportant d'un rapport enregistré : décision (verdict brut,
 * arbitrage, exclusions), visas, et signature du pharmacien incrustée en
 * `data:` — le fichier s'ouvre seul, comme le rapport de la console
 * métrologique. Sert à l'impression et au paquet d'archivage.
 *
 * Le rapport ne connaît l'agent que par son identifiant. Un nom et une
 * fonction peuvent être portés à l'édition (`edition`) : ils sont imprimés
 * avec la mention « hors sceau, non enregistré » et ne sont jamais écrits.
 */
export async function rendreRapportEnregistre(r: RapportComplet, edition?: EditionRapport | null): Promise<string> {
  const ctx = await contexteDecision(r);
  const visas: VisaRapport[] = [];
  for (const v of r.visas) {
    const signature = v.qualite === "pharmacien" ? await lireSignature(v.signature_id) : null;
    visas.push({
      qualite: v.qualite,
      signataire: v.qualite === "apprenant" ? r.agent_identifiant : v.libelle_session || v.role_session,
      date: dateLisible(v.signe_le),
      commentaire: v.commentaire || undefined,
      signatureDataUri: signature ? dataUri(signature) : undefined,
    });
  }
  return construireRapport(
    {
      identifiant: r.agent_identifiant,
      nom: edition?.nom ?? "",
      qualite: edition?.qualite ?? "",
      parcours: "",
    },
    [r.resultat],
    {
      numero: r.numero,
      empreinte: r.empreinte,
      visas,
      conservation: "pseudonyme",
      dureeConservationMois: dureeConservationMois(),
      procedure: procedureReference(),
      miseEnService: miseEnService(),
      dateEdition: edition?.le ?? new Date(r.emis_le),
      logos: await logosIncorpores(),
      decision: {
        decision: ctx.decision,
        verdictFinal: ctx.verdictFinal,
        arbitrage: ctx.arbitrage
          ? {
              verdict: ctx.arbitrage.verdict,
              motif: ctx.arbitrage.motif,
              par: ctx.arbitrage.libelle_session || ctx.arbitrage.role_session,
              date: dateLisible(ctx.arbitrage.le),
            }
          : null,
        exclusions: ctx.exclusions,
        retraitsPosterieurs: ctx.retraitsPosterieurs.map((x) => ({ questionId: x.questionId, date: dateLisible(x.le) })),
        decisionSiExclues: ctx.decisionSiExclues
          ? { score: ctx.decisionSiExclues.score, verdictBrut: ctx.decisionSiExclues.verdictBrut }
          : null,
      },
    },
  );
}

/**
 * Nom et fonction portés à l'édition, lus dans le formulaire d'une requête
 * POST ; `null` sans nom, ou pour une requête GET (édition pseudonyme). Rien
 * n'en est conservé : ni en base, ni au journal, ni dans l'adresse.
 */
export async function lireEdition(req: Request): Promise<EditionRapport | null> {
  if (req.method !== "POST") return null;
  let donnees: FormData;
  try {
    donnees = await req.formData();
  } catch {
    return null;
  }
  const nom = String(donnees.get("nom") ?? "").trim().slice(0, 120);
  const qualite = String(donnees.get("qualite") ?? "").trim().slice(0, 120);
  return nom ? { nom, qualite, le: new Date() } : null;
}

export function dateLisible(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Paris" });
}
