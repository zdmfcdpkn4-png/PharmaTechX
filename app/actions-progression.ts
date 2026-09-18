"use server";

import { redirect } from "next/navigation";
import { getSession, sessionRequise } from "@/lib/auth";
import { baseConfiguree } from "@/lib/db";
import { conservationActive } from "@/lib/config";
import { journaliser } from "@/lib/journal";
import { agentParIdentifiant } from "@/lib/agents";
import { normaliserIdentifiant } from "@/lib/identifiant";
import { effacerEchecs, enregistrerEchec, minutesDeBlocage } from "@/lib/limiteur";
import {
  codePersonnelDefini,
  codePersonnelValide,
  definirCodePersonnel,
  detacher,
  rattacher,
  verifierCodePersonnel,
} from "@/lib/progression";

/**
 * Rattachement de la progression (décision du 18/09/2026, question 11,
 * choix c) : identifiant d'agent et code personnel. Les échecs sont comptés
 * par empreinte d'adresse, comme les connexions (cinq échecs, quinze
 * minutes). Le journal note le rattachement et la définition du code par le
 * profil de session (rôle et libellé), jamais par une personne.
 */

function chaine(fd: FormData, cle: string, max: number): string {
  return String(fd.get(cle) ?? "").trim().slice(0, max);
}

function retour(code: string, extra = ""): never {
  redirect(`/?progression=${code}${extra}#progression`);
}

async function acteur() {
  const s = await getSession();
  return { role: s?.role ?? ("poste" as const), libelle: s?.libelle ?? "sans code" };
}

export async function actionRattacher(formData: FormData) {
  if (!baseConfiguree() || !conservationActive()) retour("indisponible");
  await sessionRequise("poste");
  const minutes = await minutesDeBlocage();
  if (minutes > 0) retour("bloque", `&minutes=${minutes}`);
  const identifiant = normaliserIdentifiant(chaine(formData, "identifiant", 20));
  if (!identifiant) retour("format");
  const agent = await agentParIdentifiant(identifiant);
  if (!agent) {
    await enregistrerEchec();
    retour("inconnu");
  }
  if (!agent.actif) retour("clos");
  if (!(await codePersonnelDefini(agent.id))) {
    redirect(`/?premiere=${encodeURIComponent(agent.identifiant)}#progression`);
  }
  const code = chaine(formData, "code", 8);
  if (!codePersonnelValide(code) || !(await verifierCodePersonnel(agent.id, code))) {
    await enregistrerEchec();
    retour("code");
  }
  await effacerEchecs();
  await rattacher(agent);
  await journaliser(await acteur(), "progression:rattachement", `agent:${agent.identifiant}`);
  retour("ok");
}

export async function actionDefinirCode(formData: FormData) {
  if (!baseConfiguree() || !conservationActive()) retour("indisponible");
  await sessionRequise("poste");
  const minutes = await minutesDeBlocage();
  if (minutes > 0) retour("bloque", `&minutes=${minutes}`);
  const identifiant = normaliserIdentifiant(chaine(formData, "identifiant", 20));
  if (!identifiant) retour("format");
  const agent = await agentParIdentifiant(identifiant);
  if (!agent) {
    await enregistrerEchec();
    retour("inconnu");
  }
  if (!agent.actif) retour("clos");
  if (await codePersonnelDefini(agent.id)) retour("deja");
  const nouveau = chaine(formData, "nouveauCode", 8);
  const confirmation = chaine(formData, "confirmation", 8);
  if (!codePersonnelValide(nouveau)) redirect(`/?premiere=${encodeURIComponent(agent.identifiant)}&progression=format-code#progression`);
  if (nouveau !== confirmation) redirect(`/?premiere=${encodeURIComponent(agent.identifiant)}&progression=confirmation#progression`);
  await definirCodePersonnel(agent.id, nouveau);
  await effacerEchecs();
  await rattacher(agent);
  await journaliser(await acteur(), "progression:code-defini", `agent:${agent.identifiant}`);
  retour("ok");
}

export async function actionDetacher() {
  await detacher();
  redirect("/#progression");
}
