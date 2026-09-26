"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sessionRequise } from "@/lib/auth";
import { journaliser } from "@/lib/journal";
import { enregistrerBareme, lireBareme, retablirBareme } from "@/lib/bareme-db";
import { BAREME_DEFAUT, estBaremeDefaut } from "@/content/bareme";

/**
 * Réglage du barème (décision du 18/09/2026, question 10) — administration
 * seule. Les valeurs sont normalisées et bornées par `normaliserBareme` ; le
 * barème enregistré est journalisé en entier. Les évaluations déjà scellées
 * gardent le barème de leur époque.
 */
export async function actionEnregistrerBareme(formData: FormData) {
  const s = await sessionRequise("admin");
  const v = (cle: string) => String(formData.get(cle) ?? "");
  // Les six mêmes champs pour chaque format (question 34) ; les bornes et
  // les valeurs par défaut sont appliquées par `normaliserBareme`.
  const format = (cle: string) => ({
    mode: v(`${cle}-mode`),
    juste: v(`${cle}-juste`),
    faux: v(`${cle}-faux`),
    sansReponse: v(`${cle}-sans`),
    min: v(`${cle}-min`),
    max: v(`${cle}-max`),
  });
  // Le tirage selon le niveau cible (questions 62 et 63) se règle depuis la
  // question 81 dans Niveaux des questions : ce formulaire ne le porte plus,
  // il garde le réglage en vigueur.
  const { plafonds, repartitions } = await lireBareme();
  const bareme = await enregistrerBareme(
    {
      qcm: format("qcm"),
      qim: format("qim"),
      schema: format("schema"),
      ordre: format("ordre"),
      trous: format("trous"),
      seuilDefaut: v("seuilDefaut"),
      minQuestions: v("minQuestions"),
      tirages: { decouverte: v("tirageDecouverte"), habilitation: v("tirageHabilitation") },
      bande: { mode: v("bandeMode"), points: v("bandePoints") },
      plafonds,
      repartitions,
    },
    s,
  );
  await journaliser(s, "bareme:modification", "bareme", { ...bareme });
  revalidatePath("/");
  redirect("/admin/bareme?ok=enregistre");
}

/** Valeurs par défaut, sauf le tirage selon le niveau cible, qui se rétablit dans Niveaux des questions. */
export async function actionRetablirBareme() {
  const s = await sessionRequise("admin");
  const { plafonds, repartitions } = await lireBareme();
  const suivant = { ...BAREME_DEFAUT, plafonds, repartitions };
  if (estBaremeDefaut(suivant)) await retablirBareme();
  else await enregistrerBareme(suivant, s);
  await journaliser(s, "bareme:defaut", "bareme");
  revalidatePath("/");
  redirect("/admin/bareme?ok=defaut");
}
