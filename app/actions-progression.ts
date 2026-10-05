"use server";

import { redirect } from "next/navigation";
import { agentRelieDeLaSession, getSession, sessionRequise } from "@/lib/auth";
import { baseConfiguree } from "@/lib/db";
import { conservationActive } from "@/lib/config";
import { journaliser } from "@/lib/journal";
import { agentParIdentifiant } from "@/lib/agents";
import { identifiantARattacher } from "@/lib/liaison";
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
 *
 * Sous un code de poste relié (question 99, choix a), l'identifiant est celui du
 * code : le formulaire ne le demande plus, et un autre identifiant est refusé.
 * Le formulaire peut alors venir de l'accueil, qui reprend la réponse.
 */

function chaine(fd: FormData, cle: string, max: number): string {
  return String(fd.get(cle) ?? "").trim().slice(0, max);
}

type Depuis = "accueil" | "programme";

/** Page qui a posé le formulaire : l'accueil (code relié) ou « Ma progression ». */
function lireDepuis(fd: FormData): Depuis {
  return fd.get("depuis") === "accueil" ? "accueil" : "programme";
}

function retour(code: string, extra = "", depuis: Depuis = "programme"): never {
  redirect(
    depuis === "accueil" ? `/accueil?progression=${code}${extra}#rattachement` : `/?progression=${code}${extra}#progression`,
  );
}

async function acteur() {
  const s = await getSession();
  return { role: s?.role ?? ("poste" as const), libelle: s?.libelle ?? "sans code" };
}

export async function actionRattacher(formData: FormData) {
  const depuis = lireDepuis(formData);
  if (!baseConfiguree() || !conservationActive()) retour("indisponible", "", depuis);
  // Mode test : le rattachement écrirait au journal et au limiteur.
  if ((await sessionRequise("poste")).essai) retour("essai", "", depuis);
  const minutes = await minutesDeBlocage();
  if (minutes > 0) retour("bloque", `&minutes=${minutes}`, depuis);
  const relie = await agentRelieDeLaSession();
  const cible = identifiantARattacher(relie?.identifiant ?? null, chaine(formData, "identifiant", 20));
  if ("refus" in cible) {
    if (relie) await journaliser(await acteur(), "progression:rattachement-refuse", `agent:${relie.identifiant}`, { motif: cible.refus });
    retour(cible.refus, "", depuis);
  }
  const agent = await agentParIdentifiant(cible.identifiant);
  if (!agent) {
    await enregistrerEchec();
    retour("inconnu", "", depuis);
  }
  if (!agent.actif) retour("clos", "", depuis);
  if (!(await codePersonnelDefini(agent.id))) {
    // Sous un code relié, la page qui a posé le formulaire propose de choisir le code.
    if (relie) retour("a-definir", "", depuis);
    redirect(`/?premiere=${encodeURIComponent(agent.identifiant)}#progression`);
  }
  const code = chaine(formData, "code", 8);
  if (!codePersonnelValide(code) || !(await verifierCodePersonnel(agent.id, code))) {
    await enregistrerEchec();
    retour("code", "", depuis);
  }
  await effacerEchecs();
  await rattacher(agent);
  await journaliser(await acteur(), "progression:rattachement", `agent:${agent.identifiant}`);
  retour("ok", "", depuis);
}

export async function actionDefinirCode(formData: FormData) {
  const depuis = lireDepuis(formData);
  if (!baseConfiguree() || !conservationActive()) retour("indisponible", "", depuis);
  if ((await sessionRequise("poste")).essai) retour("essai", "", depuis);
  const minutes = await minutesDeBlocage();
  if (minutes > 0) retour("bloque", `&minutes=${minutes}`, depuis);
  const relie = await agentRelieDeLaSession();
  const cible = identifiantARattacher(relie?.identifiant ?? null, chaine(formData, "identifiant", 20));
  if ("refus" in cible) {
    if (relie) await journaliser(await acteur(), "progression:rattachement-refuse", `agent:${relie.identifiant}`, { motif: cible.refus });
    retour(cible.refus, "", depuis);
  }
  const agent = await agentParIdentifiant(cible.identifiant);
  if (!agent) {
    await enregistrerEchec();
    retour("inconnu", "", depuis);
  }
  if (!agent.actif) retour("clos", "", depuis);
  if (await codePersonnelDefini(agent.id)) retour("deja", "", depuis);
  const nouveau = chaine(formData, "nouveauCode", 8);
  const confirmation = chaine(formData, "confirmation", 8);
  // Sous un code relié, la page qui a posé le formulaire le repose ; sinon, l'étape « première fois ».
  const erreur = (motif: string): never =>
    relie
      ? retour(motif, "", depuis)
      : redirect(`/?premiere=${encodeURIComponent(agent.identifiant)}&progression=${motif}#progression`);
  if (!codePersonnelValide(nouveau)) erreur("format-code");
  if (nouveau !== confirmation) erreur("confirmation");
  await definirCodePersonnel(agent.id, nouveau);
  await effacerEchecs();
  await rattacher(agent);
  await journaliser(await acteur(), "progression:code-defini", `agent:${agent.identifiant}`);
  retour("ok", "", depuis);
}

export async function actionDetacher() {
  await detacher();
  redirect("/#progression");
}
