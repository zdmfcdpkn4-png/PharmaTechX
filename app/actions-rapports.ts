"use server";

import { getSession, sessionRequise } from "@/lib/auth";
import { baseConfiguree } from "@/lib/db";
import { conservationActive } from "@/lib/config";
import { journaliser } from "@/lib/journal";
import { empreinte, sceauValide } from "@/lib/sceau";
import { agentParIdentifiant } from "@/lib/agents";
import { normaliserIdentifiant } from "@/lib/identifiant";
import { rattachement } from "@/lib/progression";
import { emettreRapport } from "@/lib/rapports";
import { moduleExiste } from "@/content/store";
import { refusEmissionEntrainement } from "@/content/jugement";
import { IDENTIFIANT_ESSAI, numeroEssai } from "@/lib/essai";
import type { ResultatEvaluation } from "@/app/api/evaluation/route";
import type { ReponseEmission } from "./types-rapports";

/**
 * Émission d'un rapport par l'apprenant. Aucun nom n'entre ici (décision du
 * 18/09/2026, question 6, choix a) : l'apprenant saisit l'identifiant d'agent
 * que son tuteur lui a remis, le serveur vérifie qu'il existe et qu'il est
 * actif, et le rapport s'y rattache. Le nom n'est porté qu'à l'édition.
 *
 * Le résultat transmis doit porter le sceau posé par le serveur à la
 * correction : un résultat retouché dans le navigateur est refusé.
 */
export async function actionEmettreRapport(entree: {
  resultat: ResultatEvaluation;
  identifiant: string;
}): Promise<ReponseEmission> {
  if (!baseConfiguree() || !conservationActive()) {
    return { ok: false, erreur: "La conservation des rapports n'est pas activée sur ce site." };
  }
  const essai = Boolean((await sessionRequise("poste")).essai);
  // Apprenant rattaché à son identifiant (question 11) : l'identifiant vient du
  // rattachement, jamais du navigateur. En mode test, l'utilisateur test.
  const ratt = await rattachement();
  const identifiant = essai
    ? IDENTIFIANT_ESSAI
    : ratt
      ? ratt.identifiant
      : normaliserIdentifiant(String(entree.identifiant ?? "").slice(0, 20));
  if (!identifiant) {
    return { ok: false, erreur: "Saisissez votre identifiant d'agent (AG-001, AG-002…), remis par votre tuteur." };
  }

  const r = entree.resultat;
  if (!r || typeof r !== "object" || typeof r.jeton !== "string") {
    return { ok: false, erreur: "Résultat illisible." };
  }
  const { jeton, ...sansJeton } = r;
  if (!sceauValide(sansJeton, jeton)) {
    return { ok: false, erreur: "Ce résultat n'a pas été produit par le serveur : émission refusée." };
  }
  if (!(await moduleExiste(r.moduleId))) return { ok: false, erreur: "Module inconnu." };
  const entrainement = refusEmissionEntrainement(r);
  if (entrainement) return { ok: false, erreur: entrainement };
  if (r.verdict === "non_concluant" || r.concluant === false) {
    return {
      ok: false,
      erreur: `Tirage non concluant (${r.pointsTotal} question${r.pointsTotal > 1 ? "s" : ""}, ${r.minQuestions} requises) : aucun rapport d'habilitation ne peut être émis. Repassez un tirage d'habilitation.`,
    };
  }

  if (essai) {
    // Mode test (23/09/2026, choix a) : mêmes contrôles qu'une émission, puis
    // rien n'est écrit — ni rapport, ni visa, ni journal — et aucun numéro de
    // la séquence RAP n'est consommé.
    const emisLe = new Date();
    return {
      ok: true,
      id: IDENTIFIANT_ESSAI,
      numero: numeroEssai(emisLe),
      empreinte: empreinte({ ...sansJeton, agent: IDENTIFIANT_ESSAI }),
      emisLe: emisLe.toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Paris" }),
      identifiant: IDENTIFIANT_ESSAI,
    };
  }

  const agent = await agentParIdentifiant(identifiant);
  if (!agent) {
    return { ok: false, erreur: `Identifiant ${identifiant} inconnu : vérifiez-le auprès de votre tuteur.` };
  }
  if (!agent.actif) {
    return { ok: false, erreur: `Identifiant ${identifiant} clos : aucun rapport ne peut plus lui être rattaché.` };
  }

  const session = await getSession();
  const hash = empreinte({ ...sansJeton, agent: agent.identifiant });
  const emis = await emettreRapport({
    resultat: { ...sansJeton, jeton },
    empreinte: hash,
    agentId: agent.id,
    agentIdentifiant: agent.identifiant,
    roleSession: session?.role ?? "aucun",
    libelleSession: session?.libelle ?? "",
  });
  await journaliser(
    { role: session?.role ?? "poste", libelle: session?.libelle ?? "sans code" },
    "emission-rapport",
    `rapport:${emis.numero}`,
    { moduleId: r.moduleId, score: r.score, verdict: r.verdict, agent: agent.identifiant },
  );
  return {
    ok: true,
    id: emis.id,
    numero: emis.numero,
    empreinte: hash,
    emisLe: emis.emisLe.toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Paris" }),
    identifiant: agent.identifiant,
  };
}
