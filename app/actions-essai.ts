"use server";

import { redirect } from "next/navigation";
import { getSession, remplacerSession, sessionRequise } from "@/lib/auth";
import { sessionDEssai, sessionRetablie } from "@/lib/essai";

/**
 * Mode test (23/09/2026, choix a) : un tuteur ou un administrateur parcourt le
 * site comme un apprenant, sous « Utilisateur test », jusqu'au rapport émis.
 *
 * Aucune des deux actions n'écrit au journal : le test ne laisse pas de trace
 * en base. Restent, comme pour toute session, la connexion du testeur à son
 * propre nom de profil et la date d'usage de son code.
 */
export async function actionDemarrerEssai() {
  const s = await sessionRequise("tuteur");
  const essai = sessionDEssai(s);
  if (essai) await remplacerSession(essai);
  redirect("/");
}

export async function actionTerminerEssai() {
  const s = await getSession();
  const retablie = s ? sessionRetablie(s) : null;
  if (!retablie) redirect("/");
  await remplacerSession(retablie);
  redirect("/admin");
}
