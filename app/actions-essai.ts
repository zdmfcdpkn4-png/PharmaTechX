"use server";

import { redirect } from "next/navigation";
import { getSession, remplacerSession, sessionRequise } from "@/lib/auth";
import { sessionDEssai, sessionRetablie } from "@/lib/essai";
import { getReferentiel } from "@/content/referentiel-db";

/**
 * Mode test (23/09/2026, choix a) : un tuteur ou un administrateur parcourt le
 * site comme un apprenant, sous « Utilisateur test », jusqu'au rapport émis.
 *
 * Aucune des deux actions n'écrit au journal : le test ne laisse pas de trace
 * en base. Restent, comme pour toute session, la connexion du testeur à son
 * propre nom de profil et la date d'usage de son code.
 */
export async function actionDemarrerEssai(formData?: FormData) {
  const s = await sessionRequise("tuteur");
  // Profil facultatif (24/09/2026) : une filière et un niveau du référentiel
  // servi, comme sur un code de poste ; le socle n'est pas une filière de poste.
  // Champs nommés à part : la page porte aussi le formulaire des codes d'accès.
  const { filieres, niveaux } = await getReferentiel();
  const lu = (cle: string) => String(formData?.get(cle) ?? "").trim();
  const filiere = filieres.find((f) => f.id !== "socle" && f.id === lu("essaiFiliere"))?.id ?? null;
  const niveau = niveaux.find((n) => String(n.code) === lu("essaiNiveau")) ? lu("essaiNiveau") : null;
  const essai = sessionDEssai(s, { filiere, niveau });
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
