"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sessionRequise } from "@/lib/auth";
import { journaliser } from "@/lib/journal";
import { enregistrerBareme, lireBareme, retablirBareme } from "@/lib/bareme-db";
import { enregistrerNomsNiveaux, retablirNomsNiveaux } from "@/lib/niveaux-questions-db";
import { BAREME_DEFAUT, estBaremeDefaut } from "@/content/bareme";
import { ORDRE_NIVEAUX } from "@/content/tirage";
import { libellesDe, nomsEnDouble, normaliserNomsNiveaux, sontLesNomsDefaut } from "@/content/niveaux-questions";

/**
 * Niveaux des questions (question 81, choix a, 26/09/2026) — administration
 * seule, comme le barème : leurs noms, et le tirage selon le niveau cible
 * (questions 62 et 63), qui quitte l'écran du barème mais reste rangé dans
 * le barème, copié dans chaque résultat scellé.
 */

const PAGE = "/admin/niveaux-questions";

export async function actionEnregistrerNomsNiveaux(formData: FormData) {
  const s = await sessionRequise("admin");
  const v = (cle: string) => String(formData.get(cle) ?? "");
  const noms = normaliserNomsNiveaux(
    Object.fromEntries(ORDRE_NIVEAUX.map((n) => [n, { libelle: v(`libelle-${n}`), definition: v(`definition-${n}`) }])),
  );
  if (nomsEnDouble(libellesDe(noms))) redirect(`${PAGE}?erreur=doublon#noms`);
  // Revenir aux noms d'origine efface la ligne : rien ne reste à relire.
  if (sontLesNomsDefaut(noms)) await retablirNomsNiveaux();
  else await enregistrerNomsNiveaux(noms, s);
  await journaliser(s, "niveaux-questions:noms", "niveaux_questions", { ...noms });
  revalidatePath("/");
  redirect(`${PAGE}?ok=noms#noms`);
}

export async function actionRetablirNomsNiveaux() {
  const s = await sessionRequise("admin");
  await retablirNomsNiveaux();
  await journaliser(s, "niveaux-questions:defaut", "niveaux_questions");
  revalidatePath("/");
  redirect(`${PAGE}?ok=noms-defaut#noms`);
}

/**
 * Plafonds et répartitions, enregistrés dans le barème sans toucher au reste :
 * codes et valeurs vérifiés par `normaliserBareme`.
 */
export async function actionEnregistrerTirageNiveaux(formData: FormData) {
  const s = await sessionRequise("admin");
  const v = (cle: string) => String(formData.get(cle) ?? "");
  const plafonds: Record<string, string> = {};
  for (const [cle, valeur] of formData.entries()) {
    if (cle.startsWith("plafond-")) plafonds[cle.slice("plafond-".length)] = String(valeur);
  }
  const repartitions = Object.fromEntries(
    ORDRE_NIVEAUX.map((p) => [p, Object.fromEntries(ORDRE_NIVEAUX.map((n) => [n, v(`part-${p}-${n}`)]))]),
  );
  const bareme = await enregistrerBareme({ ...(await lireBareme()), plafonds, repartitions }, s);
  await journaliser(s, "bareme:tirage-niveaux", "bareme", { plafonds: bareme.plafonds, repartitions: bareme.repartitions });
  revalidatePath("/");
  redirect(`${PAGE}?ok=tirage#tirage`);
}

/** Plafonds et répartitions d'origine ; le reste du barème garde son réglage. */
export async function actionRetablirTirageNiveaux() {
  const s = await sessionRequise("admin");
  const suivant = { ...(await lireBareme()), plafonds: BAREME_DEFAUT.plafonds, repartitions: BAREME_DEFAUT.repartitions };
  if (estBaremeDefaut(suivant)) await retablirBareme();
  else await enregistrerBareme(suivant, s);
  await journaliser(s, "bareme:tirage-niveaux-defaut", "bareme");
  revalidatePath("/");
  redirect(`${PAGE}?ok=tirage-defaut#tirage`);
}
