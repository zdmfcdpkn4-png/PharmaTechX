"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { LIBELLES_ROLE, sessionRequise } from "@/lib/auth";
import { journaliser } from "@/lib/journal";
import { getReferentiel } from "@/content/referentiel-db";
import { modulesDuProfilDeParcours } from "@/content/store";
import { lireOrdreSaisi, lireProfilDemande, requeteProfil, type ProfilDemande } from "@/content/ordres";
import { ecrireOrdreProfil, supprimerOrdreProfil } from "@/content/ordres-db";

/**
 * Ordre d'un profil de poste à un niveau cible (question 55, choix a) : le
 * tutorat et l'administration le fixent ou le retirent ; chaque acte est
 * journalisé, et le code qui a fixé l'ordre est nommé à l'écran.
 */

/** Profil du formulaire, s'il existe : filière servie (hors socle) et niveau de cette filière. */
async function profilDuFormulaire(fd: FormData): Promise<ProfilDemande> {
  const p = lireProfilDemande({ parcours: fd.get("parcours"), filiere: fd.get("filiere"), niveau: fd.get("niveau") });
  if (!p) redirect("/admin/ordonnancement?erreur=profil");
  const { filieres } = await getReferentiel();
  const f = filieres.find((x) => x.id === p.filiere && x.id !== "socle");
  if (!f || !f.niveaux.includes(p.niveau)) redirect(`/admin/ordonnancement?erreur=profil&parcours=${p.parcours}`);
  return p;
}

function rafraichir(): void {
  revalidatePath("/");
  revalidatePath("/admin/ordonnancement");
}

export async function actionOrdonnerProfil(formData: FormData) {
  const s = await sessionRequise("tuteur");
  const p = await profilDuFormulaire(formData);
  const modules = (await modulesDuProfilDeParcours(p.parcours, p.filiere, p.niveau)).map((m) => m.id);
  if (modules.length === 0) redirect(`/admin/ordonnancement${requeteProfil(p)}&erreur=profil-vide`);
  const ordre = lireOrdreSaisi(formData.getAll("modules"), modules);
  await ecrireOrdreProfil(p.filiere, p.niveau, p.parcours, ordre, `${LIBELLES_ROLE[s.role]} · ${s.libelle}`);
  await journaliser(s, "ordonnancement:profil", `${p.parcours}:${p.filiere}:${p.niveau}`, { n: ordre.length });
  rafraichir();
  redirect(`/admin/ordonnancement${requeteProfil(p)}&ok=profil`);
}

/** Retour à l'ordre général : le profil retrouve l'ordre du parcours, regroupé par bloc à l'accueil. */
export async function actionRetirerOrdreProfil(formData: FormData) {
  const s = await sessionRequise("tuteur");
  const p = await profilDuFormulaire(formData);
  if (await supprimerOrdreProfil(p.filiere, p.niveau, p.parcours)) {
    await journaliser(s, "ordonnancement:profil-retire", `${p.parcours}:${p.filiere}:${p.niveau}`);
  }
  rafraichir();
  redirect(`/admin/ordonnancement${requeteProfil(p)}&ok=retire`);
}
