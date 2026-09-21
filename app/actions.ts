"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  basculerAcces,
  creerAcces,
  ecrireRang,
  enregistrerDepot,
  supprimerAcces,
  supprimerDepot,
  type Role,
} from "@/lib/db";
import {
  confirmerCodeDeSession,
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
import { estNatureDocument } from "@/content/types";
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
  // Page demandée avant la connexion (tout le site est derrière un code, question 13) :
  // un chemin du site seulement, jamais une adresse externe.
  const suite = String(formData.get("suite") ?? "").slice(0, 300);
  if (/^\/(?![\/\\])/.test(suite) && !suite.startsWith("/connexion")) redirect(suite);
  redirect(r.session.role === "poste" ? "/" : "/admin");
}

export async function actionDeconnexion() {
  const s = await getSession();
  if (s) await journaliser({ role: s.role, libelle: s.libelle }, "deconnexion");
  await fermerSession();
  redirect("/connexion");
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

/**
 * Suppression d'un code d'accès : l'administration seule, et jamais au seul
 * clic — l'administrateur retape le code qui a ouvert sa session.
 *
 * Deux barrières distinctes, parce qu'elles répondent à deux questions
 * différentes : le rôle dit ce que la session a le droit de faire, la
 * confirmation dit qui est devant l'écran. Sur une tablette laissée ouverte
 * en zone, la seconde est la seule qui tienne. L'acte est irréversible — le
 * code est haché, il ne se retrouve pas — et il ferme les sessions ouvertes
 * avec lui.
 *
 * Le refus est journalisé au même titre que la suppression : une tentative
 * qui échoue est précisément ce qu'on veut lire après coup.
 */
export async function actionSupprimerCode(formData: FormData) {
  const s = await sessionRequise("admin");
  const id = Number(formData.get("id"));
  const confirmation = await confirmerCodeDeSession(s, String(formData.get("confirmation") ?? ""));
  if (confirmation !== "ok") {
    await journaliser(s, "suppression-code-refusee", `acces:${id}`, { motif: confirmation });
    redirect(`/admin?erreur=confirmation-${confirmation}`);
  }
  await supprimerAcces(id);
  await journaliser(s, "suppression-code", `acces:${id}`);
  revalidatePath("/admin");
  redirect("/admin?ok=code-supprime");
}

export async function actionDeposer(formData: FormData) {
  const s = await sessionRequise("tuteur");
  if (!stockageConfigure()) redirect("/admin/documents?erreur=stockage-absent");

  const fichier = formData.get("fichier") as File | null;
  if (!fichier || fichier.size === 0) redirect("/admin/documents?erreur=fichier-manquant");
  if (fichier.size > TAILLE_MAX_FICHIER) redirect("/admin/documents?erreur=fichier-trop-lourd");
  if (!typeAdmis(fichier.type)) redirect("/admin/documents?erreur=type-refuse");

  const titre = String(formData.get("titre") ?? "").trim().slice(0, 200) || fichier.name;
  const natureBrute = String(formData.get("nature") ?? "");
  const nature = estNatureDocument(natureBrute) ? natureBrute : "procedure-interne";
  const moduleId = String(formData.get("moduleId") ?? "") || null;
  const critereId = String(formData.get("critereId") ?? "") || null;
  if (moduleId && !(await moduleExiste(moduleId))) redirect("/admin/documents?erreur=module-inconnu");
  // profils (filières, niveaux) auxquels un document général est proposé — question 10
  const profils = await filtrerProfils(formData.getAll("filieres"), formData.getAll("niveaux"));

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
