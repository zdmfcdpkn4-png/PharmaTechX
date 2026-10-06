"use server";

import { redirect } from "next/navigation";
import { agentDuCodeDeLaSession, getSession, remplacerSession } from "@/lib/auth";
import { sessionEnFormation, sessionFormateur } from "@/lib/formation";
import { journaliser } from "@/lib/journal";
import { detacher } from "@/lib/progression";

/**
 * Bascule d'un tuteur entre sa session de tutorat et sa formation (06/10/2026,
 * question 104, choix b) : un code de tutorat relié à un identifiant d'agent
 * (question 99) ouvre les deux. En formation, la session est celle d'un poste
 * relié : l'accueil demande le code personnel, et tout ce qui s'y fait se
 * conserve sous l'identifiant. La bascule détache l'agent dans les deux sens
 * et s'inscrit au journal, parce qu'elle change qui écrit.
 */
export async function actionBasculerFormation() {
  const s = await getSession();
  if (!s) redirect("/connexion");
  if (s.formation) {
    const retablie = sessionFormateur(s);
    if (!retablie) redirect("/");
    await remplacerSession(retablie);
    await detacher();
    await journaliser(retablie, "formation:sortie", `acces:${s.acces ?? ""}`);
    redirect("/accueil");
  }
  const agent = await agentDuCodeDeLaSession();
  const formation = agent ? sessionEnFormation(s, agent) : null;
  if (!formation || !agent) redirect("/");
  await remplacerSession(formation);
  await detacher();
  await journaliser(s, "formation:entree", `agent:${agent.identifiant}`);
  redirect("/accueil");
}
