"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sessionRequise } from "@/lib/auth";
import { journaliser } from "@/lib/journal";
import { getCritere } from "@/content/habilitation";
import { getModule } from "@/content/store";
import { LIMITES_BAREME } from "@/content/bareme";
import { NOMS_ILLUSTRATION, NOMS_PICTOGRAMME, SANS_BADGE } from "@/content/badges";
import { identifiantsConnus } from "@/content/referentiel-db";
import { listeConnue, niveauxConnus, parcoursConnus } from "@/content/reglages";
import {
  changerStatutModule,
  enregistrerModuleDepose,
  enregistrerReglageModule,
  filtrerParcours,
  filtrerProfils,
  lireModuleDepose,
  supprimerModuleDepose,
  type StatutModule,
} from "@/content/modules-db";

/**
 * Actions des modules déposés (décision du 18/09/2026, question 10) :
 * tutorat et administration créent, modifient, publient et retirent ;
 * l'administration seule supprime et règle le seuil d'un module du code.
 * Chaque action est journalisée (rôle et libellé de profil, jamais une personne).
 */

function chaine(fd: FormData, cle: string, max: number): string {
  // Un textarea soumet des fins de ligne CRLF : le rendu (paragraphes, listes) attend LF.
  return String(fd.get(cle) ?? "").replace(/\r\n?/g, "\n").trim().slice(0, max);
}

function borneSeuil(v: unknown, defaut: number): number {
  const n = Number(v);
  return Number.isFinite(n) && String(v ?? "").trim() !== ""
    ? Math.min(LIMITES_BAREME.seuil.max, Math.max(LIMITES_BAREME.seuil.min, Math.round(n)))
    : defaut;
}

function rafraichir(): void {
  revalidatePath("/");
  revalidatePath("/admin/modules");
  revalidatePath("/admin/questions");
  revalidatePath("/admin/documents");
}

/**
 * Badge du formulaire, validé contre la banque : un identifiant inconnu est
 * ramené à la chaîne vide (« jamais renseigné »), jamais enregistré tel quel.
 * `SANS_BADGE` est accepté : c'est le refus explicite d'illustration.
 */
function badgeChoisi(formData: FormData): string {
  const v = String(formData.get("badge") ?? "").trim().slice(0, 40);
  if (v === SANS_BADGE) return SANS_BADGE;
  return NOMS_ILLUSTRATION.includes(v) || (NOMS_PICTOGRAMME as readonly string[]).includes(v) ? v : "";
}

export async function actionEnregistrerModule(formData: FormData) {
  const s = await sessionRequise("tuteur");
  const id = chaine(formData, "id", 40) || undefined;
  const retourErreur = (code: string) => (id ? `/admin/modules/${id}?erreur=${code}` : `/admin/modules?erreur=${code}`);
  const titre = chaine(formData, "titre", 200);
  if (!titre) redirect(retourErreur("titre"));
  const critereId = chaine(formData, "critereId", 20);
  const critere = critereId ? getCritere(critereId) : undefined;
  if (critereId && !critere) redirect(retourErreur("critere"));
  const existant = id ? await lireModuleDepose(id) : null;
  if (id && !existant) redirect("/admin/modules?erreur=inconnu");
  // Règle des quatre yeux (question 12, choix c) : un module publié ne se modifie qu'en administration.
  if (existant?.statut === "publie" && s.role !== "admin") redirect(retourErreur("publie"));

  const { filieres, niveaux } = await filtrerProfils(formData.getAll("filieres"), formData.getAll("niveaux"));
  const parcours = filtrerParcours(formData.getAll("parcours"));
  const m = {
    titre,
    objectif: chaine(formData, "objectif", 300),
    presentation: chaine(formData, "presentation", 20000),
    critereId: critere?.id ?? null,
    filieres,
    niveaux,
    parcours,
    seuil: borneSeuil(formData.get("seuil"), 80),
    dureeMinutes: Math.min(600, Math.max(0, Math.round(Number(formData.get("dureeMinutes")) || 0))),
    badge: badgeChoisi(formData),
  };
  const ident = await enregistrerModuleDepose(m, s, id);
  await journaliser(s, id ? "module:modification" : "module:creation", ident, {
    titre,
    critere: m.critereId,
    filieres,
    niveaux,
    parcours,
    seuil: m.seuil,
  });
  rafraichir();
  redirect(`/admin/modules/${ident}?ok=${id ? "modifie" : "cree"}`);
}

const ACTIONS_STATUT: Record<StatutModule, string> = {
  brouillon: "module:brouillon",
  publie: "module:publication",
  retire: "module:retrait",
};

/** Publier, retirer, repasser en brouillon : administration seulement (question 12, choix c). */
export async function actionStatutModule(formData: FormData) {
  const s = await sessionRequise("admin");
  const id = chaine(formData, "id", 40);
  const statut = chaine(formData, "statut", 20) as StatutModule;
  const retour = chaine(formData, "retour", 200) || "/admin/modules";
  if (!(statut in ACTIONS_STATUT) || !(await lireModuleDepose(id))) redirect("/admin/modules?erreur=inconnu");
  await changerStatutModule(id, statut);
  await journaliser(s, ACTIONS_STATUT[statut], id);
  rafraichir();
  redirect(`${retour}${retour.includes("?") ? "&" : "?"}ok=${statut}`);
}

export async function actionSupprimerModule(formData: FormData) {
  const s = await sessionRequise("admin");
  const id = chaine(formData, "id", 40);
  const r = await supprimerModuleDepose(id);
  if (!r.ok) redirect(`/admin/modules?erreur=suppression&message=${encodeURIComponent(r.raison)}`);
  await journaliser(s, "module:suppression", id);
  rafraichir();
  redirect("/admin/modules?ok=supprime");
}

/** Seuil de réussite d'un module du code : réglé, ou remis au seuil par défaut du barème. */
/**
 * Réglage d'un module du code (question 36, choix a) : seuil, filières,
 * niveaux et parcours. « Rétablir la fiche » efface le réglage entier.
 */
export async function actionReglerSeuil(formData: FormData) {
  const s = await sessionRequise("admin");
  const moduleId = chaine(formData, "moduleId", 80);
  if (!getModule(moduleId)) redirect("/admin/modules?erreur=inconnu#seuils");
  if (String(formData.get("mode") ?? "") === "defaut") {
    await enregistrerReglageModule(moduleId, {}, s);
    await journaliser(s, "module:reglage", moduleId, { reglage: "fiche" });
    rafraichir();
    redirect("/admin/modules?ok=seuil#seuils");
  }
  const liste = (cle: string) => formData.getAll(cle).map((v) => String(v));
  // Le référentiel servi, dépôts compris : c'est lui que le formulaire propose.
  const connus = await identifiantsConnus();
  const reglage = {
    seuil: borneSeuil(formData.get("seuil"), 80),
    filieres: listeConnue(liste("filieres"), connus.filieres),
    niveaux: niveauxConnus(liste("niveaux"), connus.niveaux),
    parcours: parcoursConnus(liste("parcours")),
  };
  await enregistrerReglageModule(moduleId, reglage, s);
  await journaliser(s, "module:reglage", moduleId, {
    seuil: reglage.seuil,
    filieres: reglage.filieres ?? "fiche",
    niveaux: reglage.niveaux ?? "fiche",
    parcours: reglage.parcours ?? "fiche",
  });
  rafraichir();
  redirect("/admin/modules?ok=seuil#seuils");
}
