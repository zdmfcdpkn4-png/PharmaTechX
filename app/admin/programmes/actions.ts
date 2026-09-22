"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { LIBELLES_ROLE, sessionRequise } from "@/lib/auth";
import { journaliser } from "@/lib/journal";
import { getTousModulesAvecDeposes } from "@/content/store";
import { lireIdProgramme, manquesPourValider, ordonnerProgramme } from "@/content/programmes";
import {
  creerProgramme,
  lireProgramme,
  modifierProgramme,
  retirerProgramme,
  validerProgramme,
  type ProgrammeSaisi,
} from "@/content/programmes-db";

/**
 * Programmes à la carte (question 50, 22/09/2026) : un tuteur ou
 * l'administration compose, modifie, valide et retire. Chaque acte est
 * journalisé, et le code qui valide est nommé sur le programme.
 */

function chaine(fd: FormData, cle: string, max: number): string {
  return String(fd.get(cle) ?? "").replace(/\r\n?/g, "\n").trim().slice(0, max);
}

function rafraichir(): void {
  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/admin/programmes");
}

/** Le programme tel que saisi : modules connus et publiés seulement, dans l'ordre demandé. */
async function saisie(fd: FormData): Promise<ProgrammeSaisi> {
  const catalogue = (await getTousModulesAvecDeposes({ publiesSeulement: true })).map((m) => m.id);
  const coches = fd.getAll("modules");
  const rangs: Record<string, unknown> = {};
  for (const id of catalogue) {
    const r = fd.get(`rang-${id}`);
    if (r !== null && String(r).trim() !== "") rangs[id] = String(r).trim();
  }
  return {
    nom: chaine(fd, "nom", 120),
    destinataire: chaine(fd, "destinataire", 200),
    motif: chaine(fd, "motif", 1000),
    modules: ordonnerProgramme(coches, rangs, catalogue),
  };
}

function par(s: { role: keyof typeof LIBELLES_ROLE; libelle: string }): string {
  return `${LIBELLES_ROLE[s.role]} · ${s.libelle}`;
}

export async function actionCreerProgramme(formData: FormData) {
  const s = await sessionRequise("tuteur");
  const p = await saisie(formData);
  if (!p.nom) redirect("/admin/programmes/nouveau?erreur=nom");
  const id = await creerProgramme(p, par(s));
  await journaliser(s, "programme:creation", `programme:${id}`, { nom: p.nom, modules: p.modules.length });
  rafraichir();
  redirect(`/admin/programmes/${id}?ok=cree`);
}

export async function actionModifierProgramme(formData: FormData) {
  const s = await sessionRequise("tuteur");
  const id = lireIdProgramme(formData.get("id"));
  const avant = id ? await lireProgramme(id) : null;
  if (!avant) redirect("/admin/programmes");
  const p = await saisie(formData);
  if (!p.nom) redirect(`/admin/programmes/${avant.id}?erreur=nom`);
  await modifierProgramme(avant.id, p, par(s));
  await journaliser(s, "programme:modification", `programme:${avant.id}`, {
    nom: p.nom,
    modules: p.modules.length,
    statutAvant: avant.statut,
  });
  rafraichir();
  // Un programme validé qui change repasse en brouillon : l'écran le dit.
  redirect(`/admin/programmes/${avant.id}?ok=${avant.statut === "valide" ? "modifie-a-revalider" : "modifie"}`);
}

export async function actionValiderProgramme(formData: FormData) {
  const s = await sessionRequise("tuteur");
  const id = lireIdProgramme(formData.get("id"));
  const p = id ? await lireProgramme(id) : null;
  if (!p) redirect("/admin/programmes");
  if (manquesPourValider(p).length > 0) redirect(`/admin/programmes/${p.id}?erreur=incomplet`);
  if (!(await validerProgramme(p.id, par(s)))) redirect(`/admin/programmes/${p.id}?erreur=statut`);
  await journaliser(s, "programme:validation", `programme:${p.id}`, { nom: p.nom, modules: p.modules.length });
  rafraichir();
  redirect(`/admin/programmes/${p.id}?ok=valide`);
}

export async function actionRetirerProgramme(formData: FormData) {
  const s = await sessionRequise("tuteur");
  const id = lireIdProgramme(formData.get("id"));
  const p = id ? await lireProgramme(id) : null;
  if (!p) redirect("/admin/programmes");
  if (!(await retirerProgramme(p.id, par(s)))) redirect(`/admin/programmes/${p.id}?erreur=statut`);
  await journaliser(s, "programme:retrait", `programme:${p.id}`, { nom: p.nom, statutAvant: p.statut });
  rafraichir();
  redirect(`/admin/programmes/${p.id}?ok=retire`);
}
