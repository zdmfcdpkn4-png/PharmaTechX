"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sessionRequise } from "@/lib/auth";
import { journaliser } from "@/lib/journal";
import { signatureCourante } from "@/lib/signatures";
import { annulerRapport, arbitrer, lireRapport, viser, type QualiteVisaBase } from "@/lib/rapports";

/**
 * Circuit de décision et de visas d'un rapport enregistré.
 *
 * - arbitrage : session tutorat ou administration, sur un rapport émis dont le
 *   verdict brut est indéterminé (bande de garde) ; choix explicite et motivé,
 *   le verdict brut reste conservé ;
 * - visa « tuteur » : session tutorat ou administration ;
 * - visa « pharmacien » : session administration — le pharmacien responsable
 *   est, dans cette version, le détenteur d'un code d'administration
 *   ([à préciser] : un rôle « pharmacien » distinct ?). Sa signature déposée
 *   est incrustée dans le rapport à cet instant.
 *
 * Un visa enregistre le nom saisi, le rôle et le libellé de la session, la
 * date et l'empreinte du rapport à cet instant. Il ne se retire pas : un
 * rapport erroné s'annule, avec motif, et le suivant s'émet à nouveau.
 * Les refus (« signalement-ouvert », « arbitrage-requis »…) viennent de
 * `lib/rapports.ts` et sont rendus à l'écran par leur code.
 */

const CODES_CONNUS = new Set([
  "rapport-indisponible",
  "deja-vise",
  "tuteur-d-abord",
  "signalement-ouvert",
  "arbitrage-requis",
  "non-concluant",
  "rapport-deja-vise",
  "deja-arbitre",
  "arbitrage-inutile",
]);

function codeErreur(e: unknown): string {
  const m = e instanceof Error ? e.message : "";
  return CODES_CONNUS.has(m) ? m : "indisponible";
}

export async function actionViserRapport(formData: FormData) {
  const qualite = String(formData.get("qualite") ?? "") as QualiteVisaBase;
  if (qualite !== "tuteur" && qualite !== "pharmacien") redirect("/admin/rapports");
  const s = await sessionRequise(qualite === "pharmacien" ? "admin" : "tuteur");
  const id = String(formData.get("id") ?? "").slice(0, 80);
  const nom = String(formData.get("nom") ?? "").trim().slice(0, 120);
  const commentaire = String(formData.get("commentaire") ?? "").trim().slice(0, 500);
  if (!nom) redirect(`/admin/rapports/${id}?erreur=nom-manquant`);
  const r = await lireRapport(id);
  if (!r || r.statut === "annule") redirect(`/admin/rapports/${id}?erreur=indisponible`);

  const signature = qualite === "pharmacien" ? await signatureCourante(s.acces) : null;
  try {
    await viser(id, {
      qualite,
      nom,
      commentaire,
      roleSession: s.role,
      libelleSession: s.libelle,
      signatureId: signature?.id ?? null,
    });
  } catch (e) {
    redirect(`/admin/rapports/${id}?erreur=${codeErreur(e)}`);
  }
  await journaliser(s, `visa:${qualite}`, `rapport:${r.numero}`, {
    nom,
    signature: signature ? "incrustée" : "absente",
  });
  revalidatePath("/admin/rapports");
  revalidatePath(`/admin/rapports/${id}`);
  redirect(`/admin/rapports/${id}?ok=${qualite === "pharmacien" && !signature ? "vise-sans-signature" : "vise"}`);
}

export async function actionArbitrerRapport(formData: FormData) {
  const s = await sessionRequise("tuteur");
  const id = String(formData.get("id") ?? "").slice(0, 80);
  const verdict = String(formData.get("verdict") ?? "");
  const nom = String(formData.get("nom") ?? "").trim().slice(0, 120);
  const motif = String(formData.get("motif") ?? "").trim().slice(0, 1000);
  if (verdict !== "acquis" && verdict !== "non_acquis") redirect(`/admin/rapports/${id}?erreur=verdict-manquant`);
  if (!nom) redirect(`/admin/rapports/${id}?erreur=nom-manquant`);
  if (motif.length < 10) redirect(`/admin/rapports/${id}?erreur=motif-court`);
  const r = await lireRapport(id);
  if (!r) redirect("/admin/rapports");
  try {
    await arbitrer(id, { verdict, motif, nom, roleSession: s.role, libelleSession: s.libelle });
  } catch (e) {
    redirect(`/admin/rapports/${id}?erreur=${codeErreur(e)}`);
  }
  await journaliser(s, "arbitrage-rapport", `rapport:${r.numero}`, { verdict, nom, motif });
  revalidatePath("/admin/rapports");
  revalidatePath(`/admin/rapports/${id}`);
  redirect(`/admin/rapports/${id}?ok=arbitre`);
}

export async function actionAnnulerRapport(formData: FormData) {
  const s = await sessionRequise("admin");
  const id = String(formData.get("id") ?? "").slice(0, 80);
  const motif = String(formData.get("motif") ?? "").trim().slice(0, 500);
  if (!motif) redirect(`/admin/rapports/${id}?erreur=motif-manquant`);
  const r = await lireRapport(id);
  if (!r) redirect("/admin/rapports");
  await annulerRapport(id, motif);
  await journaliser(s, "annulation-rapport", `rapport:${r.numero}`, { motif });
  revalidatePath("/admin/rapports");
  revalidatePath(`/admin/rapports/${id}`);
  redirect(`/admin/rapports/${id}?ok=annule`);
}
