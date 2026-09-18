import "server-only";
import { dureeConservationMois } from "@/lib/config";
import { contexteDecision, type RapportComplet } from "@/lib/rapports";
import { dataUri, lireSignature } from "@/lib/signatures";
import { construireRapport, type VisaRapport } from "@/lib/rapport";

/**
 * Rendu HTML autoportant d'un rapport enregistré : décision (verdict brut,
 * arbitrage, exclusions), visas, et signature du pharmacien incrustée en
 * `data:` — le fichier s'ouvre seul, comme le rapport de la console
 * métrologique. Sert à l'impression et au paquet d'archivage.
 */
export async function rendreRapportEnregistre(r: RapportComplet): Promise<string> {
  const ctx = await contexteDecision(r);
  const visas: VisaRapport[] = [];
  for (const v of r.visas) {
    const signature = v.qualite === "pharmacien" ? await lireSignature(v.signature_id) : null;
    visas.push({
      qualite: v.qualite,
      nom: v.nom,
      date: dateLisible(v.signe_le),
      commentaire: v.commentaire || undefined,
      signatureDataUri: signature ? dataUri(signature) : undefined,
    });
  }
  return construireRapport(
    { nom: r.apprenant_nom, qualite: r.apprenant_qualite, parcours: "" },
    [r.resultat],
    {
      numero: r.numero,
      empreinte: r.empreinte,
      visas,
      conservation: "nominative",
      dureeConservationMois: dureeConservationMois(),
      dateEdition: new Date(r.emis_le),
      decision: {
        decision: ctx.decision,
        verdictFinal: ctx.verdictFinal,
        arbitrage: ctx.arbitrage
          ? { verdict: ctx.arbitrage.verdict, motif: ctx.arbitrage.motif, nom: ctx.arbitrage.nom, date: dateLisible(ctx.arbitrage.le) }
          : null,
        exclusions: ctx.exclusions,
      },
    },
  );
}

export function dateLisible(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Paris" });
}
