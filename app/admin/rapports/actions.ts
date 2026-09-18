"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sessionRequise } from "@/lib/auth";
import { journaliser } from "@/lib/journal";
import { annulerRapport, lireRapport, viser, type QualiteVisaBase } from "@/lib/rapports";

/**
 * Circuit de visas d'un rapport enregistré.
 *
 * - visa « tuteur » : session tutorat ou administration ;
 * - visa « pharmacien » : session administration — le pharmacien responsable
 *   est, dans cette version, le détenteur d'un code d'administration
 *   ([à préciser] : un rôle « pharmacien » distinct ?).
 *
 * Un visa enregistre le nom saisi, le rôle et le libellé de la session, la
 * date et l'empreinte du rapport à cet instant. Il ne se retire pas : un
 * rapport erroné s'annule, avec motif, et le suivant s'émet à nouveau.
 */
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
  if (r.visas.some((v) => v.qualite === qualite)) redirect(`/admin/rapports/${id}?erreur=deja-vise`);
  if (qualite === "pharmacien" && !r.visas.some((v) => v.qualite === "tuteur")) {
    redirect(`/admin/rapports/${id}?erreur=tuteur-d-abord`);
  }
  await viser(id, { qualite, nom, commentaire, roleSession: s.role, libelleSession: s.libelle });
  await journaliser(s, `visa:${qualite}`, `rapport:${r.numero}`, { nom });
  revalidatePath("/admin/rapports");
  revalidatePath(`/admin/rapports/${id}`);
  redirect(`/admin/rapports/${id}?ok=vise`);
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
