"use server";

import { getSession } from "@/lib/auth";
import { baseConfiguree } from "@/lib/db";
import { conservationNominative } from "@/lib/config";
import { journaliser } from "@/lib/journal";
import { empreinte, sceauValide } from "@/lib/sceau";
import { emettreRapport } from "@/lib/rapports";
import { getModule } from "@/content/store";
import type { ResultatEvaluation } from "@/app/api/evaluation/route";

/**
 * Émission d'un rapport par l'apprenant — le seul moment où un nom entre dans
 * la base, et seulement si la conservation nominative est activée.
 *
 * Le résultat transmis doit porter le sceau posé par le serveur à la
 * correction : un résultat retouché dans le navigateur est refusé.
 */
import type { ReponseEmission } from "./types-rapports";

export async function actionEmettreRapport(entree: {
  resultat: ResultatEvaluation;
  nom: string;
  qualite: string;
}): Promise<ReponseEmission> {
  if (!baseConfiguree() || !conservationNominative()) {
    return { ok: false, erreur: "La conservation des rapports n'est pas activée sur ce site." };
  }
  const nom = String(entree.nom ?? "").trim().slice(0, 120);
  const qualite = String(entree.qualite ?? "").trim().slice(0, 120);
  if (nom.length < 2) return { ok: false, erreur: "Le nom de l'apprenant est requis pour émettre le rapport." };

  const r = entree.resultat;
  if (!r || typeof r !== "object" || typeof r.jeton !== "string") {
    return { ok: false, erreur: "Résultat illisible." };
  }
  const { jeton, ...sansJeton } = r;
  if (!sceauValide(sansJeton, jeton)) {
    return { ok: false, erreur: "Ce résultat n'a pas été produit par le serveur : émission refusée." };
  }
  if (!getModule(r.moduleId)) return { ok: false, erreur: "Module inconnu." };

  const session = await getSession();
  const hash = empreinte({ ...sansJeton, apprenant: nom, qualite });
  const emis = await emettreRapport({
    resultat: { ...sansJeton, jeton },
    empreinte: hash,
    apprenantNom: nom,
    apprenantQualite: qualite,
    roleSession: session?.role ?? "aucun",
    libelleSession: session?.libelle ?? "",
  });
  await journaliser(
    { role: session?.role ?? "poste", libelle: session?.libelle ?? "sans code" },
    "emission-rapport",
    `rapport:${emis.numero}`,
    { moduleId: r.moduleId, score: r.score, reussi: r.reussi },
  );
  return {
    ok: true,
    id: emis.id,
    numero: emis.numero,
    empreinte: hash,
    emisLe: emis.emisLe.toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Paris" }),
  };
}
