/**
 * Gestes en lot sur la banque de questions (02/10/2026, question 89, choix a) :
 * poser aussi dans d'autres modules, retirer d'un module, changer le niveau,
 * changer le statut. Le reclassement, premier geste en lot (question 88), est
 * dans `reclassement.ts`. Calculs purs, partagés par la fenêtre de la barre de
 * sélection (l'effet annoncé avant d'appliquer) et par le serveur (l'effet
 * appliqué) : les deux disent la même chose.
 *
 * Règle de la question 89 (choix a), celle de toute modification depuis les
 * questions 12 et 74 :
 *   - poser aussi, retirer d'un module et changer le niveau modifient la
 *     question : une validée repasse « à vérifier », et celui qui agit devient
 *     son auteur courant ;
 *   - changer le statut est un geste de relecture, comme les boutons de chaque
 *     question : il ne change pas l'auteur, et la règle des quatre yeux joue
 *     question par question — refus pour l'auteur courant au tutorat,
 *     validation tracée « par son auteur » en administration.
 * Une question que le geste ne change pas n'est pas touchée.
 */

import { bilanReclassement, type StatutReclasse } from "./reclassement";

export type GesteLot = "classer" | "aussi" | "retirer" | "niveau" | "statut";

export const GESTES_LOT: readonly GesteLot[] = ["classer", "aussi", "retirer", "niveau", "statut"];

/** Libellés des boutons de la barre de sélection. */
export const LIBELLES_GESTE: Record<GesteLot, string> = {
  classer: "Classer dans un module",
  aussi: "Poser aussi dans",
  retirer: "Retirer d'un module",
  niveau: "Niveau",
  statut: "Statut",
};

export function lireGeste(brut: unknown): GesteLot | null {
  return typeof brut === "string" && (GESTES_LOT as readonly string[]).includes(brut) ? (brut as GesteLot) : null;
}

export function lireStatutLot(brut: unknown): StatutReclasse | null {
  return brut === "valide" || brut === "a_verifier" || brut === "retire" ? brut : null;
}

/** Au plus autant de modules cochés par geste « Poser aussi dans » : la limite de l'éditeur. */
export const AUSSI_MAX = 80;

/** Geste refusé par le serveur, faute de question cochée ou de choix valable. */
export const ERREURS_LOT: Record<GesteLot, string> = {
  classer: "Classement impossible : cochez au moins une question et choisissez un module qui n'est pas retiré.",
  aussi: "Rien n'est posé : cochez au moins une question, et au moins un module qui n'est pas retiré.",
  retirer: "Rien n'est retiré : cochez au moins une question et choisissez un module.",
  niveau: "Niveau inchangé : cochez au moins une question et choisissez un niveau.",
  statut: "Statut inchangé : cochez au moins une question et choisissez un statut.",
};

/** Ce qu'un geste en lot lit d'une question. */
export interface QuestionLot {
  id: string;
  /** Module d'origine. */
  module_id: string;
  statut: StatutReclasse;
  /** Modules où elle est aussi posée, l'origine mise à part (question 74). */
  aussi_dans: readonly string[];
  /** Niveau de question ; `null` : à préciser. */
  niveau: string | null;
  /** Celui qui agit est son auteur courant (règle des quatre yeux, question 12). */
  moi: boolean;
}

export interface PlanLot {
  /** Questions que le geste change. */
  touchees: string[];
  /** Questions déjà dans l'état demandé, ou que le geste ne concerne pas : inchangées. */
  inchangees: string[];
  /** Parmi les touchées, les validées qui repasseront « à vérifier ». */
  revues: string[];
  /** « Poser aussi dans » : rattachements nouveaux, une question dans un module. */
  ajouts: number;
  /** « Retirer d'un module » : questions dont c'est le module d'origine ; elles ne bougent pas. */
  origine: string[];
  /** « Valider » : refusées par la règle des quatre yeux, leur auteur courant étant du tutorat. */
  refusees: string[];
  /** « Valider » : validées par leur auteur courant, ce que l'administration seule peut faire ; tracé. */
  parAuteur: string[];
}

function planVide(): PlanLot {
  return { touchees: [], inchangees: [], revues: [], ajouts: 0, origine: [], refusees: [], parAuteur: [] };
}

/** Chaque question une fois, dans l'ordre reçu : une question posée dans plusieurs modules a une case sous chacun. */
function distinctes<T extends { id: string }>(liste: readonly T[]): T[] {
  const vues = new Set<string>();
  return liste.filter((q) => {
    if (vues.has(q.id)) return false;
    vues.add(q.id);
    return true;
  });
}

/** Modules à ajouter à une question : ceux choisis, hors son module d'origine et ceux où elle est déjà posée. */
export function modulesAAjouter(q: Pick<QuestionLot, "module_id" | "aussi_dans">, modules: readonly string[]): string[] {
  return [...new Set(modules)].filter((m) => m !== q.module_id && !q.aussi_dans.includes(m));
}

export function planAussiDans(liste: readonly QuestionLot[], modules: readonly string[]): PlanLot {
  const plan = planVide();
  for (const q of distinctes(liste)) {
    const ajouts = modulesAAjouter(q, modules);
    if (ajouts.length === 0) {
      plan.inchangees.push(q.id);
      continue;
    }
    plan.touchees.push(q.id);
    plan.ajouts += ajouts.length;
    if (q.statut === "valide") plan.revues.push(q.id);
  }
  return plan;
}

export function planRetrait(liste: readonly QuestionLot[], module: string): PlanLot {
  const plan = planVide();
  for (const q of distinctes(liste)) {
    if (q.module_id === module) plan.origine.push(q.id);
    else if (q.aussi_dans.includes(module)) {
      plan.touchees.push(q.id);
      if (q.statut === "valide") plan.revues.push(q.id);
    } else plan.inchangees.push(q.id);
  }
  return plan;
}

export function planNiveau(liste: readonly QuestionLot[], niveau: string | null): PlanLot {
  const plan = planVide();
  for (const q of distinctes(liste)) {
    if ((q.niveau ?? null) === niveau) plan.inchangees.push(q.id);
    else {
      plan.touchees.push(q.id);
      if (q.statut === "valide") plan.revues.push(q.id);
    }
  }
  return plan;
}

/** `role` : celui de la session qui agit ; l'administration valide aussi les siennes (23/09/2026). */
export function planStatut(liste: readonly QuestionLot[], statut: StatutReclasse, role: string): PlanLot {
  const plan = planVide();
  for (const q of distinctes(liste)) {
    if (q.statut === statut) plan.inchangees.push(q.id);
    else if (statut === "valide" && q.moi && role !== "admin") plan.refusees.push(q.id);
    else {
      plan.touchees.push(q.id);
      if (statut === "valide" && q.moi) plan.parAuteur.push(q.id);
      // Remise « à vérifier » : les validées sortent des tirages jusqu'à leur revalidation.
      if (statut === "a_verifier" && q.statut === "valide") plan.revues.push(q.id);
    }
  }
  return plan;
}

// ───────────────────────────────────────────────────────────── phrases

function compte(n: number, un: string, plusieurs: string): string {
  return `${n} ${n > 1 ? plusieurs : un}`;
}

const questions = (n: number) => compte(n, "question", "questions");

function phrases(...p: (string | null | false)[]): string {
  return p.filter((x): x is string => Boolean(x)).join(" ");
}

/** Les validées qui repassent « à vérifier » : au futur dans l'annonce, au présent dans le bilan. */
function phraseRevues(n: number, futur: boolean): string | false {
  if (n === 0) return false;
  return futur
    ? `${compte(n, "validée repassera", "validées repasseront")} « à vérifier ».`
    : `${compte(n, "validée repasse", "validées repassent")} « à vérifier ».`;
}

function phraseAuteur(n: number): string {
  return n > 1 ? "Vous deviendrez l'auteur courant des questions modifiées." : "Vous deviendrez l'auteur courant de la question modifiée.";
}

/** Ce que fera « Poser aussi dans », dit avant d'appliquer. `libelles` : les modules cochés. */
export function annonceAussiDans(plan: PlanLot, libelles: readonly string[]): string {
  if (libelles.length === 0) return "Cochez au moins un module.";
  const ou = libelles.length === 1 ? `« ${libelles[0]} »` : compte(libelles.length, "module", "modules");
  if (plan.touchees.length === 0) {
    return plan.inchangees.length > 1
      ? `Rien à ajouter : les questions choisies sont déjà posées dans ${ou}, ou c'est leur module d'origine.`
      : `Rien à ajouter : la question choisie est déjà posée dans ${ou}, ou c'est son module d'origine.`;
  }
  return phrases(
    `Poser ${questions(plan.touchees.length)} aussi dans ${ou} : ${compte(plan.ajouts, "rattachement nouveau", "rattachements nouveaux")}.`,
    plan.touchees.length > 1 ? "Chacune reste dans son module d'origine." : "Elle reste dans son module d'origine.",
    plan.inchangees.length > 0 && `${compte(plan.inchangees.length, "y est déjà posée : inchangée", "y sont déjà posées : inchangées")}.`,
    phraseRevues(plan.revues.length, true),
    phraseAuteur(plan.touchees.length),
  );
}

/** Ce que fera « Retirer d'un module », dit avant d'appliquer. */
export function annonceRetrait(plan: PlanLot, libelleModule: string): string {
  const m = `« ${libelleModule} »`;
  return phrases(
    plan.touchees.length === 0
      ? `Rien à retirer de ${m}.`
      : `Retirer ${m} de ${questions(plan.touchees.length)}, qui ${plan.touchees.length > 1 ? "y sont aussi posées" : "y est aussi posée"}.`,
    plan.inchangees.length > 0 && `${compte(plan.inchangees.length, "n'y est pas posée", "n'y sont pas posées")}.`,
    plan.origine.length > 0 &&
      (plan.origine.length > 1
        ? `${plan.origine.length} l'ont pour module d'origine : elles ne bougent pas ; pour les en sortir, classez-les dans un autre module.`
        : "1 l'a pour module d'origine : elle ne bouge pas ; pour l'en sortir, classez-la dans un autre module."),
    phraseRevues(plan.revues.length, true),
    plan.touchees.length > 0 && phraseAuteur(plan.touchees.length),
  );
}

/** Ce que fera « Niveau », dit avant d'appliquer. `libelleNiveau` : le nom en vigueur, ou « à préciser ». */
export function annonceNiveau(plan: PlanLot, libelleNiveau: string): string {
  const n = `« ${libelleNiveau} »`;
  if (plan.touchees.length === 0) {
    return plan.inchangees.length > 1
      ? `Rien à changer : les questions choisies sont déjà au niveau ${n}.`
      : `Rien à changer : la question choisie est déjà au niveau ${n}.`;
  }
  return phrases(
    `Mettre ${questions(plan.touchees.length)} au niveau ${n}.`,
    plan.inchangees.length > 0 && `${compte(plan.inchangees.length, "y est déjà : inchangée", "y sont déjà : inchangées")}.`,
    phraseRevues(plan.revues.length, true),
    phraseAuteur(plan.touchees.length),
  );
}

/** Ce que fera « Statut », dit avant d'appliquer. */
export function annonceStatut(plan: PlanLot, statut: StatutReclasse): string {
  const deja = plan.inchangees.length;
  const dejaFaites = deja > 0 && (deja > 1 ? `${deja} le sont déjà : inchangées.` : "1 l'est déjà : inchangée.");
  if (statut === "valide") {
    const refus =
      plan.refusees.length > 0 &&
      (plan.refusees.length > 1
        ? `${plan.refusees.length} refusées : vous en êtes l'auteur courant, un autre code doit les valider (règle des quatre yeux).`
        : "1 refusée : vous en êtes l'auteur courant, un autre code doit la valider (règle des quatre yeux).");
    if (plan.touchees.length === 0) {
      return phrases(
        plan.refusees.length > 0
          ? "Rien à valider."
          : deja > 1
            ? "Rien à valider : les questions choisies le sont déjà."
            : "Rien à valider : la question choisie l'est déjà.",
        plan.refusees.length > 0 && dejaFaites,
        refus,
      );
    }
    const p = plan.parAuteur.length;
    return phrases(
      `Valider ${questions(plan.touchees.length)} : ${plan.touchees.length > 1 ? "elles entreront" : "elle entrera"} dans les tirages.`,
      p > 0 &&
        (plan.touchees.length === 1
          ? "Vous en êtes l'auteur courant : validation tracée « validée par son auteur »."
          : p > 1
            ? `Vous êtes l'auteur courant de ${p} d'entre elles : validation tracée « validée par son auteur ».`
            : "Vous êtes l'auteur courant de l'une d'elles : validation tracée « validée par son auteur »."),
      dejaFaites,
      refus,
    );
  }
  if (plan.touchees.length === 0) {
    const etat = statut === "retire" ? (deja > 1 ? "retirées" : "retirée") : "« à vérifier »";
    return deja > 1 ? `Rien à changer : les questions choisies sont déjà ${etat}.` : `Rien à changer : la question choisie est déjà ${etat}.`;
  }
  if (statut === "retire") {
    return phrases(
      `Retirer ${questions(plan.touchees.length)} : ${plan.touchees.length > 1 ? "elles ne seront plus posées" : "elle ne sera plus posée"}, l'historique ${plan.touchees.length > 1 ? "les" : "la"} garde.`,
      dejaFaites,
    );
  }
  return phrases(
    `Remettre ${questions(plan.touchees.length)} « à vérifier ».`,
    plan.revues.length > 0 &&
      `${compte(plan.revues.length, "validée sort", "validées sortent")} des tirages jusqu'à ${plan.revues.length > 1 ? "leur" : "sa"} revalidation.`,
    dejaFaites,
  );
}

// ───────────────────────────────────────────────────────────── bilan au retour

/**
 * Ce que l'adresse de retour porte d'un geste fait (`ok=lot`) : des nombres,
 * sous des noms qu'aucun filtre de la banque n'emploie — un filtre « niveau »
 * ou « statut » en cours ne doit pas être écrasé par le bilan.
 */
export interface BilanLot {
  geste: GesteLot;
  /** Questions changées. */
  nb: number;
  /** Validées repassées « à vérifier ». */
  revues: number;
  /** « Poser aussi dans » : modules cochés, rattachements ajoutés. */
  mods?: number;
  ajouts?: number;
  /** « Statut » : le statut demandé. */
  statut?: StatutReclasse;
  /** « Valider » : validées par leur auteur, refusées par la règle des quatre yeux. */
  auteur?: number;
  refus?: number;
}

/** Message affiché au retour. `cible` : le module (classer, retirer) ou le niveau, en clair. */
export function bilanLot(b: BilanLot, cible: string): string {
  const revues = phraseRevues(b.revues, false);
  switch (b.geste) {
    case "classer":
      return bilanReclassement(b.nb, b.revues, cible);
    case "aussi":
      if (b.nb === 0) return "Aucune question modifiée : celles choisies étaient déjà posées dans ces modules.";
      return phrases(
        `${compte(b.nb, "question posée", "questions posées")} aussi dans ${compte(b.mods ?? 0, "module", "modules")} (${compte(b.ajouts ?? 0, "rattachement ajouté", "rattachements ajoutés")}).`,
        revues,
      );
    case "retirer":
      if (b.nb === 0) return `Aucune question modifiée : aucune n'était aussi posée dans « ${cible} ».`;
      return phrases(`« ${cible} » retiré de ${questions(b.nb)}.`, revues);
    case "niveau":
      if (b.nb === 0) return `Aucune question modifiée : celles choisies étaient déjà au niveau « ${cible} ».`;
      return phrases(`${compte(b.nb, "question mise", "questions mises")} au niveau « ${cible} ».`, revues);
    case "statut": {
      if (b.statut === "valide") {
        const refus = b.refus ?? 0;
        const auteur = b.auteur ?? 0;
        return phrases(
          b.nb === 0
            ? "Aucune question validée."
            : `${compte(b.nb, "question validée", "questions validées")}${auteur > 0 ? `, dont ${auteur} par ${auteur > 1 ? "leur" : "son"} auteur` : ""}.`,
          refus > 0 &&
            (refus > 1
              ? `${refus} refusées : un autre code que leur auteur courant doit les valider.`
              : "1 refusée : un autre code que son auteur courant doit la valider."),
        );
      }
      if (b.statut === "retire") {
        return b.nb === 0 ? "Aucune question retirée : celles choisies l'étaient déjà." : `${compte(b.nb, "question retirée", "questions retirées")}.`;
      }
      return b.nb === 0
        ? "Aucune question changée : celles choisies étaient déjà « à vérifier »."
        : phrases(`${compte(b.nb, "question remise", "questions remises")} « à vérifier ».`, b.revues > 0 && `${compte(b.revues, "validée sort", "validées sortent")} des tirages.`);
    }
  }
}
