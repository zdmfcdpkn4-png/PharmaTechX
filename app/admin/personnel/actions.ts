"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sessionRequise } from "@/lib/auth";
import { basculerAgent, creerAgent } from "@/lib/agents";
import { journaliser } from "@/lib/journal";

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
