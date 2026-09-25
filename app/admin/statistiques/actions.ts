"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sessionRequise } from "@/lib/auth";
import { journaliser } from "@/lib/journal";
import { moduleExiste } from "@/content/store";
import { ajouterAction, supprimerAction } from "@/lib/statistiques-db";

/**
 * Actions d'amélioration d'un module (question 78, choix a, 25/09/2026) : le
 * tutorat et l'administration consignent ce qu'ils ont changé — une section
 * réécrite, une question reformulée — et la fiche compare ensuite la réussite
 * au premier essai avant et après. L'administration seule en supprime une,
 * saisie par erreur. Chaque geste est journalisé, sous le rôle et le libellé
 * du code, jamais une personne.
 */

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function retour(moduleId: string, ajouts: Record<string, string>): string {
  const q = new URLSearchParams(ajouts);
  return `/admin/statistiques/${encodeURIComponent(moduleId)}?${q.toString()}#actions`;
}

export async function actionAjouterAmelioration(formData: FormData): Promise<void> {
  const session = await sessionRequise("tuteur");
  const moduleId = String(formData.get("moduleId") ?? "").trim().slice(0, 120);
  const le = String(formData.get("le") ?? "").trim();
  const description = String(formData.get("description") ?? "").replace(/\s+/g, " ").trim().slice(0, 300);
  if (!moduleId || !(await moduleExiste(moduleId))) redirect("/admin/statistiques");
  const date = new Date(`${le}T12:00:00Z`);
  const demain = Date.now() + 86_400_000;
  if (!DATE.test(le) || Number.isNaN(date.getTime()) || date.getTime() > demain) {
    redirect(retour(moduleId, { erreur: "date" }));
  }
  if (description.length < 3) redirect(retour(moduleId, { erreur: "description" }));
  const id = await ajouterAction({ moduleId, le, description, auteur: `${session.role} · ${session.libelle}` });
  await journaliser(session, "statistiques:action", `module:${moduleId}`, { id, le, description });
  revalidatePath(`/admin/statistiques/${moduleId}`);
  redirect(retour(moduleId, { ok: "action" }));
}

export async function actionSupprimerAmelioration(formData: FormData): Promise<void> {
  const session = await sessionRequise("admin");
  const id = Number(formData.get("id"));
  const moduleId = String(formData.get("moduleId") ?? "").trim().slice(0, 120);
  if (!Number.isInteger(id) || id <= 0) redirect(moduleId ? retour(moduleId, {}) : "/admin/statistiques");
  const retiree = await supprimerAction(id);
  if (retiree) {
    await journaliser(session, "statistiques:action-supprimee", `module:${retiree.moduleId}`, {
      id,
      le: retiree.le,
      description: retiree.description,
    });
    revalidatePath(`/admin/statistiques/${retiree.moduleId}`);
  }
  redirect(retour(retiree?.moduleId ?? moduleId, { ok: "suppression" }));
}
