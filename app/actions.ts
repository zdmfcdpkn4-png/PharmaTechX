"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  basculerAcces,
  creerAcces,
  ecrireRang,
  enregistrerDepot,
  lireRoleAcces,
  reinitialiserAcces,
  relierAcces,
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
import { lireTypeCode, profilAdmisPour, typeAdmisPour } from "@/lib/codes";
import { CREER_ET_RELIER, lireChoixAgent, refusLiaison } from "@/lib/liaison";
import { agentParIdentifiant } from "@/lib/agents";
import { conservationActive } from "@/lib/config";
import { journaliser } from "@/lib/journal";
import { detacher } from "@/lib/progression";
import { moduleExiste, modulesDuParcours } from "@/content/store";
import { lireOrdreSaisi } from "@/content/ordres";
import { lireIdProgramme } from "@/content/programmes";
import { lireProgramme } from "@/content/programmes-db";
import { filtrerProfils } from "@/content/modules-db";
import { estNatureDocument } from "@/content/types";
import { retourListe } from "@/content/filtres";
import { getReferentiel } from "@/content/referentiel-db";
import { metierOuDefaut } from "@/content/habilitation";
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
  // Accueil après la connexion, pour tous les profils (question 91, choix a).
  redirect("/accueil");
}

export async function actionDeconnexion() {
  const s = await getSession();
  // En mode test, c'est le testeur qui se déconnecte : l'utilisateur test
  // n'entre jamais au journal.
  const qui = s?.essai ?? s;
  if (qui) await journaliser({ role: qui.role, libelle: qui.libelle }, "deconnexion");
  await fermerSession();
  // « Quitter » détache aussi l'agent (question 70, choix a) : le code d'accès
  // est commun à un profil de poste, et sur un poste partagé le rattachement
  // survivait à la sortie. L'agent suivant héritait alors de l'identifiant du
  // précédent.
  await detacher();
  redirect("/connexion");
}

export async function actionCreerCode(formData: FormData) {
  const s = await sessionRequise("tuteur");
  const role = String(formData.get("role") ?? "poste") as Role;
  if (!peutGererRole(s.role, role)) redirect("/admin?erreur=role-interdit");

  // Le libellé n'est plus saisi (question 95, choix a) : le type de profil, pris dans une liste
  // fermée, et le premier numéro jamais donné pour ce type le font (`creerAcces`).
  const type = lireTypeCode(formData.get("type"));
  if (!type) redirect("/admin?erreur=type-inconnu");
  // L'administration est réservée au type PHARMACIEN (question 97, choix a).
  if (!typeAdmisPour(role, type)) redirect("/admin?erreur=type-role");

  const filiere = String(formData.get("filiere") ?? "") || null;
  const niveau = String(formData.get("niveau") ?? "") || null;
  // Un code de poste prend la filière et le niveau du métier de son type (question 98, choix a) ;
  // un profil inconnu du référentiel n'a pas de métier, il est refusé avec eux.
  if (role === "poste" && (filiere || niveau)) {
    const { filieres, niveaux } = await getReferentiel();
    const metierDe = (trouve: { metier?: string } | undefined, valeur: string | null) =>
      valeur === null ? null : trouve ? metierOuDefaut(trouve.metier).id : "inconnu";
    const admis = profilAdmisPour(role, type, {
      filiere: metierDe(filieres.find((f) => f.id === filiere), filiere),
      niveau: metierDe(niveaux.find((n) => String(n.code) === niveau), niveau),
    });
    if (!admis) redirect("/admin?erreur=type-metier");
  }
  // Profil dégradé (question 50) : un code de poste peut ouvrir sur un
  // programme à la carte validé — jamais sur un brouillon, jamais un code de
  // tutorat ou d'administration.
  const idProgramme = role === "poste" ? lireIdProgramme(formData.get("programme")) : null;
  const programme = idProgramme ? await lireProgramme(idProgramme) : null;
  if (idProgramme && programme?.statut !== "valide") redirect("/admin?erreur=programme-non-valide");
  // Code de poste personnel (question 99, choix a) : la case crée l'identifiant d'agent suivant
  // et le relie au code, dans la même transaction. Un code de tutorat se relie aussi (question 104,
  // choix b : le tuteur en formation) ; un code d'administration ne se relie pas ; sans conservation
  // des rapports, il n'y a pas d'identifiants d'agents.
  const avecAgent = String(formData.get("agent") ?? "") === CREER_ET_RELIER;
  if (avecAgent && role === "admin") redirect("/admin?erreur=agent-role");
  if (avecAgent && !conservationActive()) redirect("/admin?erreur=agent-indisponible");

  const code = genererCode();
  const { id, libelle, agent } = await creerAcces(
    hacherCode(code),
    role,
    type,
    filiere,
    niveau,
    programme?.id ?? null,
    avecAgent,
  );
  if (agent) await journaliser(s, "agent:creation", `agent:${agent}`, { code: libelle });
  await journaliser(s, "creation-code", `acces:${id}`, {
    role,
    libelle,
    filiere,
    niveau,
    ...(programme ? { programme: programme.id } : {}),
    ...(agent ? { agent } : {}),
  });
  revalidatePath("/admin");
  redirect(
    `/admin?nouveau=${encodeURIComponent(code)}&libelle=${encodeURIComponent(libelle)}` +
      (agent ? `&agent=${encodeURIComponent(agent)}` : ""),
  );
}

/**
 * Relier un code de poste — ou de tutorat (question 104, choix b) — à un
 * identifiant d'agent, ou le délier (question 99, choix a). Même barrière que
 * la révocation : le rôle de la cible est revérifié ici, et un refus est
 * journalisé ; un code de tutorat ne se gère que depuis l'administration, qui
 * supervise les tuteurs. Un code d'administration ne se relie pas, et seul un
 * identifiant actif se relie ; la requête le redit. Le lien prend effet à la
 * requête suivante des sessions ouvertes avec ce code : sous un code relié,
 * seul l'agent du code se rattache (`lib/progression.ts`).
 */
export async function actionRelierCode(formData: FormData) {
  const s = await sessionRequise("tuteur");
  const id = Number(formData.get("id"));
  const liste = formData.get("liste");
  const cible = Number.isInteger(id) && id > 0 ? await lireRoleAcces(id) : null;
  if (!cible || !peutGererRole(s.role, cible)) {
    await journaliser(s, "liaison-code-refusee", `acces:${id}`, { motif: "role-interdit" });
    redirect(retourListe(liste, "/admin", { erreur: "role-interdit-bascule" }));
  }
  const choix = lireChoixAgent(formData.get("agent"));
  if (!choix) redirect(retourListe(liste, "/admin", { erreur: "liaison-agent" }));
  const agent = choix.identifiant ? await agentParIdentifiant(choix.identifiant) : null;
  const refus = choix.identifiant ? refusLiaison(cible, agent) : cible === "admin" ? "role" : null;
  if (refus) {
    if (refus === "role") await journaliser(s, "liaison-code-refusee", `acces:${id}`, { motif: "role" });
    redirect(retourListe(liste, "/admin", { erreur: refus === "role" ? "liaison-role" : "liaison-agent" }));
  }
  const fait = await relierAcces(id, agent?.id ?? null);
  if (!fait) redirect(retourListe(liste, "/admin", { erreur: "liaison-agent" }));
  await journaliser(s, agent ? "liaison-code" : "deliaison-code", `acces:${id}`, {
    libelle: fait.libelle,
    ...(agent ? { agent: agent.identifiant } : {}),
  });
  revalidatePath("/admin");
  revalidatePath("/admin/personnel");
  redirect(
    retourListe(liste, "/admin", {
      ok: agent ? "relie" : "delie",
      libelle: fait.libelle,
      ...(agent ? { agent: agent.identifiant } : {}),
    }),
  );
}

/**
 * Révocation et réactivation d'un code.
 *
 * Le rôle de la cible est revérifié ici (21/09/2026) : l'écran n'affiche le
 * bouton qu'à qui peut l'actionner, mais l'action, elle, ne le vérifiait pas —
 * un code de tutorat pouvait donc révoquer un code d'administration par une
 * requête forgée. C'est la règle posée en tête de ce fichier, qui n'était pas
 * tenue ici.
 *
 * Révoquer le code de **sa propre** session demande de le retaper (21/09/2026,
 * question 42) : la session se ferme à la requête suivante et le code révoqué
 * ne permet plus de se reconnecter pour le réactiver — le verrouillage est
 * celui de la suppression, il mérite la même barrière. Révoquer le code d'un
 * autre reste d'un clic : c'est le geste d'urgence quand un code circule.
 */
export async function actionBasculerCode(formData: FormData) {
  const s = await sessionRequise("tuteur");
  const id = Number(formData.get("id"));
  const actif = String(formData.get("actif")) === "true";
  const cible = await lireRoleAcces(id);
  if (!cible || !peutGererRole(s.role, cible)) {
    await journaliser(s, "bascule-code-refusee", `acces:${id}`, { motif: "role-interdit" });
    redirect(retourListe(formData.get("liste"), "/admin", { erreur: "role-interdit-bascule" }));
  }
  if (!actif && s.acces && id === s.acces) {
    const confirmation = await confirmerCodeDeSession(s, String(formData.get("confirmation") ?? ""));
    if (confirmation !== "ok") {
      await journaliser(s, "revocation-code-refusee", `acces:${id}`, { motif: confirmation });
      redirect(retourListe(formData.get("liste"), "/admin", { erreur: `confirmation-${confirmation}` }));
    }
  }
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
 *
 * Son propre code ne se supprime pas (21/09/2026, question 41) : supprimer le
 * code de sa propre session, c'est se fermer la porte, et si c'était le
 * dernier administrateur actif la remise en service passe par l'hébergeur.
 * Le refus tombe **avant** la confirmation : la question n'est pas de savoir
 * qui est devant l'écran, elle ne se pose plus.
 */
export async function actionSupprimerCode(formData: FormData) {
  const s = await sessionRequise("admin");
  const id = Number(formData.get("id"));
  if (s.acces && id === s.acces) {
    await journaliser(s, "suppression-code-refusee", `acces:${id}`, { motif: "propre-code" });
    redirect(retourListe(formData.get("liste"), "/admin", { erreur: "suppression-propre-code" }));
  }
  const confirmation = await confirmerCodeDeSession(s, String(formData.get("confirmation") ?? ""));
  if (confirmation !== "ok") {
    await journaliser(s, "suppression-code-refusee", `acces:${id}`, { motif: confirmation });
    redirect(retourListe(formData.get("liste"), "/admin", { erreur: `confirmation-${confirmation}` }));
  }
  await supprimerAcces(id);
  await journaliser(s, "suppression-code", `acces:${id}`);
  revalidatePath("/admin");
  redirect(retourListe(formData.get("liste"), "/admin", { ok: "code-supprime" }));
}

/**
 * Réinitialisation d'un code d'accès perdu ou corrompu (demande du
 * 22/09/2026) : l'administration seule, et jamais au seul clic — comme la
 * suppression, l'administrateur retape le code de sa session. Le code est
 * haché : perdu, il ne se retrouve pas, il se remplace. La réinitialisation
 * le remplace **sans changer de profil** ; supprimer puis recréer perdrait la
 * signature déposée et l'identité du code pour les quatre yeux.
 *
 * L'ancien code cesse de valoir à l'instant, et les sessions ouvertes avec
 * lui se ferment à la requête suivante. Le nouveau code s'affiche une fois.
 *
 * Son propre code ne se réinitialise pas d'ici : la session se fermerait
 * avant d'afficher le nouveau code, et la porte avec elle.
 */
export async function actionReinitialiserCode(formData: FormData) {
  const s = await sessionRequise("admin");
  const id = Number(formData.get("id"));
  const liste = formData.get("liste");
  if (!Number.isInteger(id) || id < 1 || !(await lireRoleAcces(id))) redirect(retourListe(liste, "/admin"));
  if (s.acces && id === s.acces) {
    await journaliser(s, "reinitialisation-code-refusee", `acces:${id}`, { motif: "propre-code" });
    redirect(retourListe(liste, "/admin", { erreur: "reinitialisation-propre-code" }));
  }
  const confirmation = await confirmerCodeDeSession(s, String(formData.get("confirmation") ?? ""));
  if (confirmation !== "ok") {
    await journaliser(s, "reinitialisation-code-refusee", `acces:${id}`, { motif: confirmation });
    redirect(retourListe(liste, "/admin", { erreur: `confirmation-${confirmation}` }));
  }
  const code = genererCode();
  const cible = await reinitialiserAcces(id, hacherCode(code));
  if (!cible) redirect(retourListe(liste, "/admin"));
  await journaliser(s, "reinitialisation-code", `acces:${id}`, { role: cible.role, libelle: cible.libelle });
  revalidatePath("/admin");
  redirect(retourListe(liste, "/admin", { nouveau: code, libelle: cible.libelle, reinitialise: "1" }));
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
  // Une fiche de synthèse se montre en fin de test d'un module et se valide
  // depuis sa banque (question 59) : sans module, elle ne serait ni l'un ni l'autre.
  if (nature === "synthese" && !moduleId) redirect("/admin/documents?erreur=fiche-sans-module");
  // profils (filières, niveaux) auxquels un document général est proposé — question 10
  const profils = await filtrerProfils(formData.getAll("filieres"), formData.getAll("niveaux"));

  const octets = Buffer.from(await fichier.arrayBuffer());
  const { url } = await deposerFichier(fichier.name, fichier.type, octets);
  const id = await enregistrerDepot(titre, nature, url, moduleId, critereId, s, profils);
  await journaliser(s, nature === "synthese" ? "depot-fiche" : "depot-document", url, { id, titre, nature, moduleId, ...profils });
  revalidatePath("/admin/documents");
  revalidatePath("/");
  redirect(nature === "synthese" ? "/admin/documents?ok=fiche-a-verifier" : "/admin/documents?ok=depose");
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
  const parcours = formData.get("parcours") === "maintien" ? "maintien" : "integration";
  // Liste rangée à l'écran (question 55) : les modules du parcours, dans
  // l'ordre affiché ; rien d'étranger au parcours n'est retenu.
  const entrees = lireOrdreSaisi(formData.getAll("modules"), (await modulesDuParcours(parcours)).map((m) => m.id));
  for (let i = 0; i < entrees.length; i++) {
    await ecrireRang(entrees[i], parcours, i);
  }
  await journaliser(s, "ordonnancement", parcours, { n: entrees.length });
  revalidatePath("/admin/ordonnancement");
  revalidatePath("/");
  redirect(`/admin/ordonnancement?ok=enregistre&parcours=${parcours}`);
}
