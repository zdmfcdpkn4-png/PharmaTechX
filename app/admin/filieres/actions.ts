"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sessionRequise } from "@/lib/auth";
import { journaliser } from "@/lib/journal";
import { getModule, getTousModulesAvecDeposes } from "@/content/store";
import { getReferentiel, identifiantsConnus } from "@/content/referentiel-db";
import { enregistrerReglageModule, lireReglagesModules, reglerProfilsModuleDepose } from "@/content/modules-db";
import {
  changementDuModule,
  codesDeLaFiliere,
  estDansLaFiliere,
  reglageApres,
  saisieDepuisEnvoi,
  SOCLE,
  type Changement,
  type Refus,
} from "@/content/programme-filiere";

/**
 * Programme d'une filière, réglé depuis sa page (question 80, choix a) :
 * administration seule, comme le réglage des modules du code.
 *
 * Chaque ligne affichée porte l'identifiant de son module (`m`) et ce
 * qu'elle a montré (`vu:<module>`, `vus:<module>`) ; la case « au
 * programme » (`dans`) et les cases de niveau (`niv:<module>`) disent la
 * saisie. Seules les cases changées comptent (`saisieDepuisEnvoi`) : une
 * page restée ouverte ne défait pas ce qu'un autre écran a fait depuis. Une
 * ligne non affichée ne change pas.
 *
 * Tout ou rien : une ligne refusée — dernière filière, tronc commun, plus
 * aucun niveau — n'enregistre aucune ligne, et la page dit lesquelles.
 */
export async function actionProgrammeFiliere(formData: FormData) {
  const s = await sessionRequise("admin");
  const filiere = String(formData.get("filiere") ?? "");
  const connus = await identifiantsConnus();
  if (!filiere || filiere === SOCLE || !connus.filieres.includes(filiere)) redirect("/admin/filieres?erreur=filiere-inconnue");
  const page = `/admin/filieres/${encodeURIComponent(filiere)}`;

  const [{ niveaux }, modules, reglages] = await Promise.all([
    getReferentiel(),
    getTousModulesAvecDeposes(),
    lireReglagesModules(),
  ]);
  const niveauxDeLaFiliere = codesDeLaFiliere(niveaux, filiere);
  const affiches = new Set(formData.getAll("m").map(String));
  const coches = new Set(formData.getAll("dans").map(String));

  const refus: { id: string; raison: Refus }[] = [];
  const changements: { id: string; depose: boolean; apres: Changement }[] = [];
  for (const m of modules) {
    // Un module déposé retiré n'est plus proposé : il ne s'affiche pas, il ne se règle pas ici.
    if (!affiches.has(m.id) || m.statut === "retire") continue;
    const rattache = { id: m.id, affectation: m.affectation, postes: m.postes, niveaux: m.niveaux.map(String) };
    // Sans trace de l'affichage, l'état du moment en tient lieu.
    const vu = formData.get(`vu:${m.id}`);
    const vus = formData.get(`vus:${m.id}`);
    const saisie = saisieDepuisEnvoi(rattache, filiere, niveauxDeLaFiliere, {
      dansAffiche: vu === null ? estDansLaFiliere(rattache, filiere) : vu === "1",
      dansVoulu: coches.has(m.id),
      niveauxAffiches: vus === null ? rattache.niveaux : String(vus).split(",").filter(Boolean),
      niveauxVoulus: formData.getAll(`niv:${m.id}`).map(String),
    });
    const r = changementDuModule(rattache, filiere, niveauxDeLaFiliere, saisie);
    if ("refus" in r) refus.push({ id: m.id, raison: r.refus });
    else if (r.changement) changements.push({ id: m.id, depose: m.origine === "base", apres: r.changement });
  }
  if (refus.length > 0) {
    redirect(`${page}?erreur=programme&refus=${encodeURIComponent(refus.map((x) => `${x.raison}:${x.id}`).join(","))}#programme`);
  }

  for (const c of changements) {
    if (c.depose) {
      await reglerProfilsModuleDepose(c.id, c.apres.postes, c.apres.niveaux);
      continue;
    }
    const fiche = getModule(c.id);
    if (!fiche) continue;
    await enregistrerReglageModule(
      c.id,
      reglageApres(reglages[c.id], { postes: fiche.postes, niveaux: fiche.niveaux.map(String) }, c.apres),
      s,
    );
  }
  if (changements.length > 0) {
    await journaliser(s, "filiere:programme", filiere, {
      modules: changements.map((c) => ({ id: c.id, filieres: c.apres.postes, niveaux: c.apres.niveaux })),
    });
  }
  revalidatePath("/");
  revalidatePath("/admin/modules");
  redirect(`${page}?ok=programme&n=${changements.length}#programme`);
}
