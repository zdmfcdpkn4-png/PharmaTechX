"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { LIBELLES_ROLE, sessionRequise } from "@/lib/auth";
import { basculerAgent, creerAgent, lireAgent } from "@/lib/agents";
import { journaliser } from "@/lib/journal";
import { purgerProgression, reinitialiserCodePersonnel } from "@/lib/progression";
import { candidatsDuParcours } from "@/lib/programme-poste";
import { retourListe } from "@/content/filtres";
import { composerParcours } from "@/content/parcours-agent";
import { ecrireParcoursAgent, supprimerParcoursAgent } from "@/content/parcours-agent-db";

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

/** Clore, rouvrir : retour au répertoire tel qu'il était filtré (question 92, choix a). */
export async function actionBasculerAgent(formData: FormData) {
  const s = await sessionRequise("tuteur");
  const id = Number(formData.get("id"));
  const actif = String(formData.get("actif") ?? "") === "1";
  const liste = formData.get("liste");
  if (!Number.isInteger(id) || id < 1) redirect(retourListe(liste, "/admin/personnel"));
  const identifiant = await basculerAgent(id, actif);
  if (!identifiant) redirect(retourListe(liste, "/admin/personnel"));
  await journaliser(s, actif ? "agent:reouverture" : "agent:cloture", `agent:${identifiant}`);
  revalidatePath("/admin/personnel");
  redirect(retourListe(liste, "/admin/personnel", { ok: actif ? "rouvert" : "clos", identifiant }));
}

/** Code personnel oublié : l'agent en choisit un nouveau à son prochain rattachement. */
export async function actionReinitialiserCode(formData: FormData) {
  const s = await sessionRequise("tuteur");
  const id = Number(formData.get("id"));
  const agent = Number.isInteger(id) && id > 0 ? await lireAgent(id) : null;
  if (!agent) redirect(retourListe(formData.get("liste"), "/admin/personnel"));
  await reinitialiserCodePersonnel(agent.id);
  await journaliser(s, "progression:code-reinitialise", `agent:${agent.identifiant}`);
  revalidatePath("/admin/personnel");
  redirect(retourListe(formData.get("liste"), "/admin/personnel", { ok: "code", identifiant: agent.identifiant }));
}

/** Agent désigné par le formulaire ; sinon, retour au répertoire. */
async function agentDuFormulaire(formData: FormData): Promise<{ id: number; identifiant: string }> {
  const id = Number(formData.get("id"));
  const agent = Number.isInteger(id) && id > 0 ? await lireAgent(id) : null;
  if (!agent) redirect("/admin/personnel");
  return agent;
}

/**
 * Parcours de l'agent (question 103, choix a, 05/10/2026) : le tutorat ou l'administration cochent, parmi les
 * modules que ses codes de poste reliés lui ouvrent, ceux du parcours, les rangent et en ferment certains
 * (`composerParcours`). Rien d'étranger à ces modules n'est retenu ; un parcours vide ne s'enregistre pas.
 */
export async function actionFixerParcours(formData: FormData) {
  const s = await sessionRequise("tuteur");
  const agent = await agentDuFormulaire(formData);
  const { modules } = await candidatsDuParcours(agent.id);
  if (modules.length === 0) redirect(`/admin/personnel/${agent.id}?erreur=parcours-sans-code`);
  const p = composerParcours(
    formData.getAll("modules"),
    formData.getAll("parcours"),
    formData.getAll("fermes"),
    modules.map((m) => m.id),
  );
  if (p.modules.length === 0) redirect(`/admin/personnel/${agent.id}?erreur=parcours-vide`);
  await ecrireParcoursAgent(agent.id, p, `${LIBELLES_ROLE[s.role]} · ${s.libelle}`);
  await journaliser(s, "parcours:agent", `agent:${agent.identifiant}`, { n: p.modules.length, fermes: p.fermes.length });
  revalidatePath("/");
  revalidatePath("/admin/personnel");
  redirect(`/admin/personnel/${agent.id}?ok=parcours&n=${p.modules.length}&f=${p.fermes.length}`);
}

/** Retour au programme entier du code : l'agent revoit tous ses modules, dans l'ordre d'avant. */
export async function actionRetirerParcours(formData: FormData) {
  const s = await sessionRequise("tuteur");
  const agent = await agentDuFormulaire(formData);
  if (await supprimerParcoursAgent(agent.id)) {
    await journaliser(s, "parcours:agent-retire", `agent:${agent.identifiant}`);
  }
  revalidatePath("/");
  revalidatePath("/admin/personnel");
  redirect(`/admin/personnel/${agent.id}?ok=parcours-retire`);
}

/** Purge de la progression d'un agent (administration) : traces, session en cours, ordre propre des modules (question 56) et parcours (question 103) ; les rapports émis restent. */
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
