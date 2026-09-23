"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sessionRequise } from "@/lib/auth";
import { journaliser } from "@/lib/journal";
import { enregistrerDepot } from "@/lib/db";
import { TAILLE_MAX_FICHIER, deposerFichier, stockageConfigure, typeAdmis } from "@/lib/stockage";
import { changerStatutFiche, lireFiche, remplacerFichierFiche, validerFiche } from "@/lib/fiches-db";
import { auteurDeFiche } from "@/content/fiches";
import { moduleExiste } from "@/content/store";
import { peutValider, validationParAuteur } from "@/content/quatre-yeux";

/**
 * Fiches de synthèse dans la banque du module (questions 59 et 60, choix a,
 * 23/09/2026) : dépôt, validation aux quatre yeux, retrait, remise à
 * vérifier, version corrigée. Réservées au tutorat et à l'administration ;
 * chaque geste est journalisé.
 */

/** Retour sur la banque, là où le geste a été fait ; rien d'autre n'est suivi. */
function retour(formData: FormData, cle: "ok" | "erreur", valeur: string): string {
  const brut = String(formData.get("retour") ?? "");
  const url = new URL(brut.startsWith("/admin/questions") ? brut : "/admin/questions", "http://local");
  url.searchParams.delete("ok");
  url.searchParams.delete("erreur");
  url.searchParams.set(cle, valeur);
  return `${url.pathname}${url.search}#fiches`;
}

/** Fichier du formulaire, vérifié comme à l'écran Documents ; sinon le motif du refus. */
function fichierRecu(formData: FormData): File | string {
  if (!stockageConfigure()) return "fiche-stockage";
  const fichier = formData.get("fichier");
  if (!(fichier instanceof File) || fichier.size === 0) return "fiche-fichier-manquant";
  if (fichier.size > TAILLE_MAX_FICHIER) return "fiche-trop-lourde";
  if (!typeAdmis(fichier.type)) return "fiche-type-refuse";
  return fichier;
}

export async function actionDeposerFiche(formData: FormData) {
  const s = await sessionRequise("tuteur");
  const moduleId = String(formData.get("moduleId") ?? "").slice(0, 80);
  if (!moduleId || !(await moduleExiste(moduleId))) redirect(retour(formData, "erreur", "fiche-module"));
  const fichier = fichierRecu(formData);
  if (typeof fichier === "string") redirect(retour(formData, "erreur", fichier));
  const titre = String(formData.get("titre") ?? "").trim().slice(0, 200) || fichier.name;
  const { url } = await deposerFichier(fichier.name, fichier.type, Buffer.from(await fichier.arrayBuffer()));
  const id = await enregistrerDepot(titre, "synthese", url, moduleId, null, s);
  await journaliser(s, "depot-fiche", `fiche:${id}`, { titre, moduleId, url });
  revalidatePath("/admin/questions");
  redirect(retour(formData, "ok", "fiche-deposee"));
}

export async function actionValiderFiche(formData: FormData) {
  const s = await sessionRequise("tuteur");
  const id = Number(formData.get("id"));
  const f = Number.isInteger(id) ? await lireFiche(id) : null;
  if (!f || f.statut !== "a_verifier") redirect(retour(formData, "erreur", "fiche-inconnue"));
  // Règle des quatre yeux, comme pour une question : un autre code que
  // l'auteur courant, ou l'auteur lui-même s'il est d'administration — tracé.
  const auteur = auteurDeFiche(f);
  if (!peutValider(auteur, s)) redirect(retour(formData, "erreur", "fiche-quatre-yeux"));
  const parAuteur = validationParAuteur(auteur, s);
  await validerFiche(id, s, parAuteur);
  await journaliser(s, parAuteur ? "statut-fiche:valide-par-auteur" : "statut-fiche:valide", `fiche:${id}`, {
    moduleId: f.module_id,
  });
  revalidatePath("/admin/questions");
  redirect(retour(formData, "ok", "fiche-validee"));
}

export async function actionRetirerFiche(formData: FormData) {
  const s = await sessionRequise("tuteur");
  const id = Number(formData.get("id"));
  const f = Number.isInteger(id) ? await lireFiche(id) : null;
  if (!f) redirect(retour(formData, "erreur", "fiche-inconnue"));
  await changerStatutFiche(id, "retire");
  await journaliser(s, "statut-fiche:retire", `fiche:${id}`, { moduleId: f.module_id });
  revalidatePath("/admin/questions");
  redirect(retour(formData, "ok", "fiche-retiree"));
}

export async function actionRemettreFiche(formData: FormData) {
  const s = await sessionRequise("tuteur");
  const id = Number(formData.get("id"));
  const f = Number.isInteger(id) ? await lireFiche(id) : null;
  if (!f) redirect(retour(formData, "erreur", "fiche-inconnue"));
  await changerStatutFiche(id, "a_verifier");
  await journaliser(s, "statut-fiche:a_verifier", `fiche:${id}`, { moduleId: f.module_id });
  revalidatePath("/admin/questions");
  redirect(retour(formData, "ok", "fiche-remise"));
}

/** Version corrigée (question 60) : le fichier est remplacé, la fiche repart « à vérifier ». */
export async function actionCorrigerFiche(formData: FormData) {
  const s = await sessionRequise("tuteur");
  const id = Number(formData.get("id"));
  const f = Number.isInteger(id) ? await lireFiche(id) : null;
  if (!f) redirect(retour(formData, "erreur", "fiche-inconnue"));
  const fichier = fichierRecu(formData);
  if (typeof fichier === "string") redirect(retour(formData, "erreur", fichier));
  const { url } = await deposerFichier(fichier.name, fichier.type, Buffer.from(await fichier.arrayBuffer()));
  await remplacerFichierFiche(id, url, s);
  await journaliser(s, "fiche-corrigee", `fiche:${id}`, { moduleId: f.module_id, precedente: f.url, url });
  revalidatePath("/admin/questions");
  redirect(retour(formData, "ok", "fiche-corrigee"));
}
