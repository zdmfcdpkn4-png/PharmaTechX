"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  basculerAcces,
  baseConfiguree,
  creerAcces,
  ecrireRang,
  enregistrerDepot,
  existeAdmin,
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
  sessionRequise,
} from "@/lib/auth";
import { journaliser } from "@/lib/journal";
import { moduleExiste } from "@/content/store";
import { filtrerProfils } from "@/content/modules-db";
import {
  TAILLE_MAX_FICHIER,
  deposerFichier,
  stockageConfigure,
  supprimerFichier,
  typeAdmis,
} from "@/lib/stockage";

/**
 * Actions serveur : connexion, codes d'accès, documents, ordonnancement.
 *
 * Chacune revérifie le rôle de l'appelant (`sessionRequise`) : la protection
 * ne repose jamais sur le fait que l'écran soit affiché ou non. Chaque action
 * d'administration est journalisée (rôle et libellé de profil, jamais une
 * personne).
 */

export async function actionConnexion(formData: FormData) {
  const code = String(formData.get("code") ?? "");
  const r = await connecter(code);
  if (!r.ok) {
    redirect(
      r.raison === "bloque"
        ? `/connexion?erreur=bloque&minutes=${r.minutes ?? 15}`
        : `/connexion?erreur=${r.raison}`,
    );
  }
  await ouvrirSession(r.session);
  await journaliser({ role: r.session.role, libelle: r.session.libelle }, "connexion");
  redirect(r.session.role === "poste" ? "/" : "/admin");
}

export async function actionDeconnexion() {
  const s = await getSession();
  if (s) await journaliser({ role: s.role, libelle: s.libelle }, "deconnexion");
  await fermerSession();
  redirect("/connexion");
}

/**
 * Amorçage : crée le premier code admin quand la base est vide.
 * Refusé dès qu'un admin existe — la porte se referme d'elle-même.
 */
export async function actionAmorcage(): Promise<void> {
  if (!baseConfiguree()) return;
  if (await existeAdmin()) redirect("/connexion?erreur=deja-amorce");
  const code = genererCode();
  const accesId = await creerAcces(hacherCode(code), "admin", "Administrateur initial", null, null);
  await journaliser({ role: "systeme", libelle: "amorçage" }, "creation-code", "admin", {
    libelle: "Administrateur initial",
  });
  // La session de cet administrateur est ouverte dans la foulée : sans elle,
  // l'écran d'administration renverrait vers la connexion et le code —
  // affiché une seule fois — serait perdu.
  await ouvrirSession({ role: "admin", libelle: "Administrateur initial", filiere: null, niveau: null, acces: accesId });
  // Le code n'est montré qu'ici, une seule fois, via le paramètre d'URL.
  redirect(`/admin?amorce=${encodeURIComponent(code)}`);
}

export async function actionCreerCode(formData: FormData) {
  const s = await sessionRequise("tuteur");
  const role = String(formData.get("role") ?? "poste") as Role;
  if (!peutGererRole(s.role, role)) redirect("/admin?erreur=role-interdit");

  const libelle = String(formData.get("libelle") ?? "").trim().slice(0, 120);
  if (!libelle) redirect("/admin?erreur=libelle-manquant");

  const filiere = String(formData.get("filiere") ?? "") || null;
  const niveau = String(formData.get("niveau") ?? "") || null;

  const code = genererCode();
  const id = await creerAcces(hacherCode(code), role, libelle, filiere, niveau);
  await journaliser(s, "creation-code", `acces:${id}`, { role, libelle, filiere, niveau });
  revalidatePath("/admin");
  redirect(`/admin?nouveau=${encodeURIComponent(code)}&libelle=${encodeURIComponent(libelle)}`);
}

export async function actionBasculerCode(formData: FormData) {
  const s = await sessionRequise("tuteur");
  const id = Number(formData.get("id"));
  const actif = String(formData.get("actif")) === "true";
  await basculerAcces(id, actif);
  await journaliser(s, actif ? "reactivation-code" : "revocation-code", `acces:${id}`);
  revalidatePath("/admin");
}

export async function actionSupprimerCode(formData: FormData) {
  const s = await sessionRequise("admin");
  const id = Number(formData.get("id"));
  await supprimerAcces(id);
  await journaliser(s, "suppression-code", `acces:${id}`);
  revalidatePath("/admin");
}

export async function actionDeposer(formData: FormData) {
  const s = await sessionRequise("tuteur");
  if (!stockageConfigure()) redirect("/admin/documents?erreur=stockage-absent");

  const fichier = formData.get("fichier") as File | null;
  if (!fichier || fichier.size === 0) redirect("/admin/documents?erreur=fichier-manquant");
  if (fichier.size > TAILLE_MAX_FICHIER) redirect("/admin/documents?erreur=fichier-trop-lourd");
  if (!typeAdmis(fichier.type)) redirect("/admin/documents?erreur=type-refuse");

  const titre = String(formData.get("titre") ?? "").trim().slice(0, 200) || fichier.name;
  const nature = String(formData.get("nature") ?? "procedure-interne");
  const moduleId = String(formData.get("moduleId") ?? "") || null;
  const critereId = String(formData.get("critereId") ?? "") || null;
  if (moduleId && !(await moduleExiste(moduleId))) redirect("/admin/documents?erreur=module-inconnu");
  // profils (filières, niveaux) auxquels un document général est proposé — question 10
  const profils = filtrerProfils(formData.getAll("filieres"), formData.getAll("niveaux"));

  const octets = Buffer.from(await fichier.arrayBuffer());
  const { url } = await deposerFichier(fichier.name, fichier.type, octets);
  await enregistrerDepot(titre, nature, url, moduleId, critereId, s.role, profils);
  await journaliser(s, "depot-document", url, { titre, nature, moduleId, ...profils });
  revalidatePath("/admin/documents");
  revalidatePath("/");
  redirect("/admin/documents?ok=depose");
}

export async function actionSupprimerDepot(formData: FormData) {
  const s = await sessionRequise("tuteur");
  const id = Number(formData.get("id"));
  const url = await supprimerDepot(id);
  if (url) await supprimerFichier(url);
  await journaliser(s, "suppression-document", `depot:${id}`, { url });
  revalidatePath("/admin/documents");
}

export async function actionOrdonner(formData: FormData) {
  const s = await sessionRequise("tuteur");
  const parcours = String(formData.get("parcours") ?? "integration");
  const entrees = String(formData.get("ordre") ?? "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
  for (let i = 0; i < entrees.length; i++) {
    await ecrireRang(entrees[i], parcours, i);
  }
  await journaliser(s, "ordonnancement", parcours, { n: entrees.length });
  revalidatePath("/admin/ordonnancement");
  revalidatePath("/");
  redirect("/admin/ordonnancement?ok=enregistre");
}
