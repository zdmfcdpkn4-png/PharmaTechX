"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { put, del } from "@vercel/blob";
import {
  basculerAcces,
  baseConfiguree,
  blobConfigure,
  creerAcces,
  ecrireRang,
  enregistrerDepot,
  existeAdmin,
  initSchema,
  supprimerAcces,
  supprimerDepot,
  type Role,
} from "@/lib/db";
import {
  connecter,
  fermerSession,
  genererCode,
  getSession,
  hacherCode,
  ouvrirSession,
  peutGererRole,
} from "@/lib/auth";

/**
 * Actions serveur de l'administration.
 *
 * Chacune revérifie le rôle de l'appelant : la protection ne repose jamais sur
 * le fait que l'écran soit affiché ou non.
 */

async function exigerRole(minimum: Role) {
  const s = await getSession();
  if (!s) redirect("/connexion");
  if (minimum === "admin" && s.role !== "admin") redirect("/");
  if (minimum === "tuteur" && s.role === "poste") redirect("/");
  return s;
}

export async function actionConnexion(formData: FormData) {
  const code = String(formData.get("code") ?? "");
  const r = await connecter(code);
  if (!r.ok) {
    redirect(`/connexion?erreur=${r.raison}`);
  }
  await ouvrirSession(r.session);
  redirect("/");
}

export async function actionDeconnexion() {
  await fermerSession();
  redirect("/connexion");
}

/**
 * Amorçage : crée le premier code admin quand la base est vide.
 * Refusé dès qu'un admin existe — la porte se referme d'elle-même.
 */
export async function actionAmorcage(): Promise<void> {
  if (!baseConfiguree()) return;
  await initSchema();
  if (await existeAdmin()) return;
  const code = genererCode();
  await creerAcces(hacherCode(code), "admin", "Administrateur initial", null, null);
  // Le code n'est montré qu'ici, une seule fois, via le paramètre d'URL.
  redirect(`/admin?amorce=${encodeURIComponent(code)}`);
}

export async function actionCreerCode(formData: FormData) {
  const s = await exigerRole("tuteur");
  const role = String(formData.get("role") ?? "poste") as Role;
  if (!peutGererRole(s.role, role)) redirect("/admin?erreur=role-interdit");

  const libelle = String(formData.get("libelle") ?? "").trim();
  if (!libelle) redirect("/admin?erreur=libelle-manquant");

  const filiere = String(formData.get("filiere") ?? "") || null;
  const niveau = String(formData.get("niveau") ?? "") || null;

  const code = genererCode();
  await creerAcces(hacherCode(code), role, libelle, filiere, niveau);
  revalidatePath("/admin");
  redirect(`/admin?nouveau=${encodeURIComponent(code)}&libelle=${encodeURIComponent(libelle)}`);
}

export async function actionBasculerCode(formData: FormData) {
  await exigerRole("tuteur");
  const id = Number(formData.get("id"));
  const actif = String(formData.get("actif")) === "true";
  await basculerAcces(id, actif);
  revalidatePath("/admin");
}

export async function actionSupprimerCode(formData: FormData) {
  await exigerRole("admin");
  await supprimerAcces(Number(formData.get("id")));
  revalidatePath("/admin");
}

export async function actionDeposer(formData: FormData) {
  const s = await exigerRole("tuteur");
  if (!blobConfigure()) redirect("/admin?erreur=blob-absent");

  const fichier = formData.get("fichier") as File | null;
  if (!fichier || fichier.size === 0) redirect("/admin?erreur=fichier-manquant");

  const titre = String(formData.get("titre") ?? fichier.name).trim();
  const nature = String(formData.get("nature") ?? "procedure-interne");
  const moduleId = String(formData.get("moduleId") ?? "") || null;
  const critereId = String(formData.get("critereId") ?? "") || null;

  const blob = await put(`depots/${Date.now()}-${fichier.name}`, fichier, {
    access: "public",
    addRandomSuffix: true,
  });
  await enregistrerDepot(titre, nature, blob.url, moduleId, critereId, s.role);
  revalidatePath("/admin");
}

export async function actionSupprimerDepot(formData: FormData) {
  await exigerRole("tuteur");
  const url = await supprimerDepot(Number(formData.get("id")));
  if (url && blobConfigure()) {
    try {
      await del(url);
    } catch {
      // Le fichier a pu être supprimé côté Blob : l'index reste la référence.
    }
  }
  revalidatePath("/admin");
}

export async function actionOrdonner(formData: FormData) {
  await exigerRole("tuteur");
  const parcours = String(formData.get("parcours") ?? "integration");
  const entrees = String(formData.get("ordre") ?? "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
  for (let i = 0; i < entrees.length; i++) {
    await ecrireRang(entrees[i], parcours, i);
  }
  revalidatePath("/admin");
  revalidatePath("/");
}
