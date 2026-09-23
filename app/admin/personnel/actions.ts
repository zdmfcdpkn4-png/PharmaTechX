"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sessionRequise } from "@/lib/auth";
import { basculerAgent, creerAgent, lireAgent } from "@/lib/agents";
import { journaliser } from "@/lib/journal";
import { purgerProgression, reinitialiserCodePersonnel } from "@/lib/progression";

/**
 * Identifiants d'agents (décision du 18/09/2026, question 6, choix a) :
 * créés par un tuteur ou l'administrateur, générés par le site, jamais
 * saisis. La correspondance identifiant ↔ agent se tient hors du site.
 */
export async function actionCreerAgent() {
  const s = await sessionRequise("tuteur");
  const a = await creerAgent();
  await journaliser(s, "agent:creation", `agent:${a.identifiant}`);
  revalidatePath("/admin/personnel");
  redirect(`/admin/personnel?ok=cree&identifiant=${encodeURIComponent(a.identifiant)}`);
}

export async function actionBasculerAgent(formData: FormData) {
  const s = await sessionRequise("tuteur");
  const id = Number(formData.get("id"));
  const actif = String(formData.get("actif") ?? "") === "1";
  if (!Number.isInteger(id) || id < 1) redirect("/admin/personnel");
  const identifiant = await basculerAgent(id, actif);
  if (!identifiant) redirect("/admin/personnel");
  await journaliser(s, actif ? "agent:reouverture" : "agent:cloture", `agent:${identifiant}`);
  revalidatePath("/admin/personnel");
  redirect(`/admin/personnel?ok=${actif ? "rouvert" : "clos"}&identifiant=${encodeURIComponent(identifiant)}`);
}

/** Code personnel oublié : l'agent en choisit un nouveau à son prochain rattachement. */
export async function actionReinitialiserCode(formData: FormData) {
  const s = await sessionRequise("tuteur");
  const id = Number(formData.get("id"));
  const agent = Number.isInteger(id) && id > 0 ? await lireAgent(id) : null;
  if (!agent) redirect("/admin/personnel");
  await reinitialiserCodePersonnel(agent.id);
  await journaliser(s, "progression:code-reinitialise", `agent:${agent.identifiant}`);
  revalidatePath("/admin/personnel");
  redirect(`/admin/personnel?ok=code&identifiant=${encodeURIComponent(agent.identifiant)}`);
}

/** Purge de la progression d'un agent (administration) : traces, session en cours et ordre propre des modules (question 56) ; les rapports émis restent. */
export async function actionPurgerProgression(formData: FormData) {
  const s = await sessionRequise("admin");
  const id = Number(formData.get("id"));
  const agent = Number.isInteger(id) && id > 0 ? await lireAgent(id) : null;
  if (!agent) redirect("/admin/personnel");
  if (String(formData.get("confirmation") ?? "").trim().toUpperCase() !== agent.identifiant) {
    redirect(`/admin/personnel/${agent.id}?erreur=confirmation`);
  }
  const n = await purgerProgression(agent.id);
  await journaliser(s, "progression:purge", `agent:${agent.identifiant}`, { lignes: n });
  revalidatePath("/admin/personnel");
  redirect(`/admin/personnel/${agent.id}?ok=purge&n=${n}`);
}
