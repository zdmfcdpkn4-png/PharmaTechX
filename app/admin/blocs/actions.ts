"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sessionRequise } from "@/lib/auth";
import { journaliser } from "@/lib/journal";
import { blocsCompetence } from "@/content/habilitation";
import { identifiantsConnus } from "@/content/referentiel-db";
import { enregistrerBloc, modulesDeposesParBloc, supprimerBlocDepose, tousLesBlocs } from "@/content/blocs-db";

/**
 * Blocs de compétence (question 81, choix a, 26/09/2026) — administration
 * seule, comme les filières et les niveaux. Un bloc de la fiche se corrige
 * mais ne se désactive pas ; un bloc ajouté qui porte encore des modules
 * déposés ne se désactive ni ne se supprime : ils se rangeraient dans un bloc
 * que plus rien ne liste.
 */

const texte = (f: FormData, cle: string, max: number) => String(f.get(cle) ?? "").trim().slice(0, max);

export async function actionEnregistrerBloc(formData: FormData) {
  const s = await sessionRequise("admin");
  const numero = Number.parseInt(texte(formData, "numero", 3), 10);
  if (!Number.isInteger(numero) || numero < 1 || numero > 99) redirect("/admin/blocs?erreur=numero");
  const titre = texte(formData, "titre", 200);
  if (!titre) redirect("/admin/blocs?erreur=titre");
  const existant = formData.get("existant") !== null;
  const tous = await tousLesBlocs();
  // « Ajouter » ne réécrit pas un bloc qui existe déjà : on le modifie.
  if (!existant && tous.some((b) => b.numero === numero)) redirect("/admin/blocs?erreur=numero-pris");
  const deLaFiche = blocsCompetence.some((b) => b.numero === numero);
  const actif = deLaFiche || formData.get("actif") !== null;
  if (!actif && ((await modulesDeposesParBloc())[numero]?.length ?? 0) > 0) redirect("/admin/blocs?erreur=bloc-occupe");
  const connues = (await identifiantsConnus()).filieres;
  const saisie = texte(formData, "filiere", 40);
  const filiere = connues.includes(saisie) ? saisie : "socle";
  await enregistrerBloc({ numero, titre, reference: texte(formData, "reference", 400), filiere, actif }, s.libelle);
  await journaliser(s, "referentiel:bloc", String(numero), { titre, filiere, actif, deLaFiche });
  revalidatePath("/");
  redirect(`/admin/blocs?ok=bloc#bloc-${numero}`);
}

/**
 * Suppression du **dépôt** : un bloc de la fiche reprend ses valeurs
 * d'origine ; un bloc ajouté disparaît, s'il ne porte plus aucun module.
 */
export async function actionSupprimerBloc(formData: FormData) {
  const s = await sessionRequise("admin");
  const numero = Number.parseInt(texte(formData, "numero", 3), 10);
  const deLaFiche = blocsCompetence.some((b) => b.numero === numero);
  if (!deLaFiche && ((await modulesDeposesParBloc())[numero]?.length ?? 0) > 0) redirect("/admin/blocs?erreur=bloc-occupe");
  await supprimerBlocDepose(numero);
  await journaliser(s, "referentiel:bloc-supprime", String(numero), { deLaFiche });
  revalidatePath("/");
  redirect("/admin/blocs?ok=bloc-supprime");
}
