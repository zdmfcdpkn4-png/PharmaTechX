"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sessionRequise } from "@/lib/auth";
import { journaliser } from "@/lib/journal";
import {
  enregistrerFiliere,
  enregistrerNiveau,
  normaliserCode,
  normaliserIdentifiant,
  supprimerFiliereDeposee,
  supprimerNiveauDepose,
} from "@/content/referentiel-db";
import { BADGES } from "@/components/Badge";
import { filieres as FILIERES_CODE, niveaux as NIVEAUX_CODE } from "@/content/habilitation";

/**
 * Référentiel : filières et niveaux (décision du 19/09/2026, question 38,
 * choix b) — administration seule. Le tutorat rattache des modules à des
 * filières, il ne crée pas les filières.
 *
 * Une ligne déposée qui reprend l'identifiant d'une filière de la fiche la
 * corrige ; un identifiant nouveau l'ajoute. Rien n'est jamais réécrit dans
 * les rapports déjà émis : ils portent leur propre copie des libellés.
 */

const texte = (f: FormData, cle: string, max: number) => String(f.get(cle) ?? "").trim().slice(0, max);
const entier = (f: FormData, cle: string) => {
  const n = Number.parseInt(String(f.get(cle) ?? ""), 10);
  return Number.isFinite(n) ? Math.max(0, Math.min(999, n)) : 0;
};

export async function actionEnregistrerFiliere(formData: FormData) {
  const s = await sessionRequise("admin");
  const propose = texte(formData, "id", 40);
  const libelle = texte(formData, "libelle", 120);
  if (!libelle) redirect("/admin/referentiel?erreur=libelle");
  // Un identifiant vide se déduit du libellé ; il ne change plus ensuite.
  const id = normaliserIdentifiant(propose || libelle);
  if (id.length < 2) redirect("/admin/referentiel?erreur=identifiant");

  const badge = texte(formData, "badge", 40);
  const blocs = String(formData.get("blocs") ?? "")
    .split(/[^0-9]+/)
    .map((x) => Number.parseInt(x, 10))
    .filter((n) => Number.isFinite(n) && n >= 1 && n <= 99)
    .slice(0, 20);

  await enregistrerFiliere(
    {
      id,
      libelle,
      description: texte(formData, "description", 400),
      badge: badge in BADGES ? badge : "",
      blocs,
      rang: entier(formData, "rang"),
      actif: formData.get("actif") !== null,
    },
    s.libelle,
  );
  await journaliser(s, "referentiel:filiere", id, { libelle });
  revalidatePath("/");
  redirect("/admin/referentiel?ok=filiere");
}

export async function actionEnregistrerNiveau(formData: FormData) {
  const s = await sessionRequise("admin");
  const code = normaliserCode(texte(formData, "code", 12));
  if (code.length < 1) redirect("/admin/referentiel?erreur=code");
  const libelle = texte(formData, "libelle", 120);
  if (!libelle) redirect("/admin/referentiel?erreur=libelle");
  const filiereId = normaliserIdentifiant(texte(formData, "filiereId", 40));
  if (!filiereId) redirect("/admin/referentiel?erreur=filiere-manquante");

  const prerequis = formData
    .getAll("prerequis")
    .map((x) => normaliserCode(String(x)))
    .filter((x) => x.length > 0 && x !== code)
    .slice(0, 10);

  await enregistrerNiveau(
    {
      code,
      libelle,
      filiereId,
      condition: texte(formData, "condition", 600),
      prerequis: [...new Set(prerequis)],
      rang: entier(formData, "rang"),
      actif: formData.get("actif") !== null,
    },
    s.libelle,
  );
  await journaliser(s, "referentiel:niveau", code, { libelle, filiere: filiereId });
  revalidatePath("/");
  redirect("/admin/referentiel?ok=niveau");
}

/**
 * Suppression du **dépôt**, pas de la filière : une filière de la fiche
 * reprend aussitôt son libellé d'origine. Une filière ajoutée, elle,
 * disparaît des listes — les modules qui la citaient gardent la valeur, qui
 * devient visiblement inconnue, pour être corrigée.
 */
export async function actionSupprimerFiliere(formData: FormData) {
  const s = await sessionRequise("admin");
  const id = String(formData.get("id") ?? "");
  await supprimerFiliereDeposee(id);
  await journaliser(s, "referentiel:filiere-supprimee", id, {
    deLaFiche: FILIERES_CODE.some((f) => f.id === id),
  });
  revalidatePath("/");
  redirect("/admin/referentiel?ok=filiere-supprimee");
}

export async function actionSupprimerNiveau(formData: FormData) {
  const s = await sessionRequise("admin");
  const code = String(formData.get("code") ?? "");
  await supprimerNiveauDepose(code);
  await journaliser(s, "referentiel:niveau-supprime", code, {
    deLaFiche: NIVEAUX_CODE.some((n) => n.code === code),
  });
  revalidatePath("/");
  redirect("/admin/referentiel?ok=niveau-supprime");
}
