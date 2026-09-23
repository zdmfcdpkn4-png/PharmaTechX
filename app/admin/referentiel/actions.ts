"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sessionRequise } from "@/lib/auth";
import { journaliser } from "@/lib/journal";
import {
  enregistrerFiliere,
  enregistrerNiveau,
  identifiantsConnus,
  listerNiveauxDeposes,
  metierDeLaFiliere,
  normaliserCode,
  normaliserIdentifiant,
  supprimerFiliereDeposee,
  supprimerNiveauDepose,
} from "@/content/referentiel-db";
import { BADGES } from "@/components/Badge";
import {
  codeConnu,
  codePourMetier,
  filieres as FILIERES_CODE,
  METIER_PAR_DEFAUT,
  metierOuDefaut,
  niveaux as NIVEAUX_CODE,
} from "@/content/habilitation";

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

  // Une filière de la fiche reste au préparateur ; une filière ajoutée prend
  // le métier choisi (question 53, choix b).
  const metierId = FILIERES_CODE.some((f) => f.id === id)
    ? METIER_PAR_DEFAUT
    : metierOuDefaut(texte(formData, "metier", 40)).id;
  // Une filière qui porte des niveaux garde son métier : leurs codes en ont
  // le préfixe, et un niveau ne change pas de métier.
  const [metierAvant, niveauxDeposes] = await Promise.all([metierDeLaFiliere(id), listerNiveauxDeposes(true)]);
  if (metierId !== metierAvant && niveauxDeposes.some((n) => n.filiereId === id)) {
    redirect("/admin/referentiel?erreur=metier-filiere");
  }

  await enregistrerFiliere(
    {
      id,
      libelle,
      description: texte(formData, "description", 400),
      badge: badge in BADGES ? badge : "",
      blocs,
      rang: entier(formData, "rang"),
      actif: formData.get("actif") !== null,
      metierId,
    },
    s.libelle,
  );
  await journaliser(s, "referentiel:filiere", id, { libelle, metier: metierId });
  revalidatePath("/");
  redirect("/admin/referentiel?ok=filiere");
}

export async function actionEnregistrerNiveau(formData: FormData) {
  const s = await sessionRequise("admin");
  const saisi = normaliserCode(texte(formData, "code", 12));
  if (saisi.length < 1) redirect("/admin/referentiel?erreur=code");
  const libelle = texte(formData, "libelle", 120);
  if (!libelle) redirect("/admin/referentiel?erreur=libelle");
  const filiereId = normaliserIdentifiant(texte(formData, "filiereId", 40));
  if (!filiereId) redirect("/admin/referentiel?erreur=filiere-manquante");

  // Le niveau prend le métier de sa filière, même désactivée, et le préfixe
  // de ce métier (question 46, choix a) ; puis la casse du code déjà connu.
  const [metierId, connus] = await Promise.all([metierDeLaFiliere(filiereId), identifiantsConnus()]);
  const prefixe = codePourMetier(saisi, metierId);
  if ("refus" in prefixe) {
    redirect(`/admin/referentiel?erreur=${prefixe.refus === "vide" ? "code" : prefixe.refus}`);
  }
  const code = codeConnu(prefixe.code, connus.niveaux);
  // « Modifier » ne change pas un niveau de métier : ce serait un autre code,
  // donc un autre niveau, et l'ancien resterait tel quel.
  if (formData.get("existant") !== null && code.toUpperCase() !== saisi) {
    redirect("/admin/referentiel?erreur=metier-change");
  }

  const prerequis = formData
    .getAll("prerequis")
    .map((x) => codeConnu(normaliserCode(String(x)), connus.niveaux))
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
  await journaliser(s, "referentiel:niveau", code, { libelle, filiere: filiereId, metier: metierId });
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
