"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sessionRequise } from "@/lib/auth";
import { journaliser } from "@/lib/journal";
import { IMAGE_MAX_OCTETS, enregistrerImage, imageExiste, majAltImage } from "@/lib/images";
import { lireDocx, lireOctets, type ImageCollee } from "@/lib/docx";
import { JUSTIFICATION_PROPOSITION_MAX } from "@/content/justifications";
import { analyserTexte, type QuestionImportee } from "@/lib/import-questions";
import { indexerModules, proposerModule, reperesModules, resoudreLigneModule, type IndexModules } from "@/lib/import-module";
import { schemaPret, type Legende } from "@/content/schema";
import { getTousModulesAvecDeposes, moduleExiste } from "@/content/store";
import { listeBlocs } from "@/content/blocs-db";
import { identifiantsConnus } from "@/content/referentiel-db";
import { lireBlocs, lireIdentifiants, modulesDeLaQuestion } from "@/content/rattachement-question";
import { peutValider, validationParAuteur } from "@/content/quatre-yeux";
import { retourBanque } from "@/content/arbre-banque";
import { retourListe } from "@/content/filtres";
import { lireIdentifiantsQuestions } from "@/content/reclassement";
import { AUSSI_MAX, lireGeste, lireStatutLot } from "@/content/lot-questions";
import { lireModeReponse, lireNiveauQuestion, trousDuTexte, type Reference, type TypeQuestion } from "@/content/types";
import {
  changerNiveauQuestions,
  changerStatutQuestion,
  changerStatutQuestions,
  enregistrerDepotQuestions,
  enregistrerQuestion,
  enregistrerSituation,
  insererLot,
  lireQuestion,
  poserAussiDansQuestions,
  reclasserQuestions,
  retirerDuModuleQuestions,
  supprimerQuestion,
  supprimerSituation,
  textesValidesParModule,
  traiterSignalement,
  type OptionBase,
  type QuestionAEnregistrer,
  type StatutQuestion,
} from "@/content/banque-db";
import type { EtatFormulaireQuestion, EtatImport, QuestionImporteeAvecImage } from "./import-etat";
import { modulesOuvertsAuDepot, versRepere } from "./commun";

/**
 * Actions de la banque de questions — réservées aux profils tutorat et
 * administration. Toute modification est journalisée.
 */

function chaine(fd: FormData, cle: string, max = 4000): string {
  return String(fd.get(cle) ?? "").trim().slice(0, max);
}

function lireOptions(brut: string): OptionBase[] | null {
  try {
    const v = JSON.parse(brut) as unknown;
    if (!Array.isArray(v)) return null;
    const out: OptionBase[] = [];
    for (const o of v.slice(0, 5)) {
      const x = o as Record<string, unknown>;
      const texte = typeof x.texte === "string" ? x.texte.trim().slice(0, 500) : "";
      if (!texte) continue;
      // Justification de la proposition (question 85, choix a) : gardée si écrite.
      const justification = typeof x.justification === "string" ? x.justification.trim().slice(0, JUSTIFICATION_PROPOSITION_MAX) : "";
      out.push({
        id: String(x.id ?? "").slice(0, 4) || String.fromCharCode(97 + out.length),
        texte,
        vrai: x.vrai === true,
        ...(justification ? { justification } : {}),
      });
    }
    return out;
  } catch {
    return null;
  }
}

function lireLegendes(brut: string): Legende[] | null {
  try {
    const v = JSON.parse(brut) as unknown;
    if (!Array.isArray(v)) return null;
    const out: Legende[] = [];
    for (const l of v.slice(0, 26)) {
      const x = l as Record<string, unknown>;
      const rep = x.repere as Record<string, unknown> | undefined;
      const n = (k: unknown) => (typeof k === "number" && Number.isFinite(k) ? Math.min(100, Math.max(0, k)) : null);
      const px = n(rep?.x);
      const py = n(rep?.y);
      if (px === null || py === null) continue;
      const c = rep?.cache as Record<string, unknown> | undefined;
      const cache =
        c && n(c.x) !== null && n(c.y) !== null && n(c.w) !== null && n(c.h) !== null
          ? { x: n(c.x)!, y: n(c.y)!, w: n(c.w)!, h: n(c.h)! }
          : undefined;
      out.push({
        id: String(x.id ?? "").slice(0, 8) || `l${out.length + 1}`,
        attendu: typeof x.attendu === "string" ? x.attendu.trim().slice(0, 200) : "",
        repere: { x: px, y: py, ...(cache ? { cache } : {}) },
      });
    }
    return out;
  } catch {
    return null;
  }
}

/** Une référence par ligne : « Source — Libellé — Date — URL — Localisation ». */
function lireReferences(brut: string): Reference[] {
  return brut
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 10)
    .map((l) => {
      const parts = l.split(/\s+[—–|]\s+/).map((x) => x.trim());
      const url = parts.find((p) => /^https?:\/\//i.test(p));
      const reste = parts.filter((p) => p !== url);
      return {
        source: reste[0] ?? "",
        libelle: reste[1] ?? reste[0] ?? l,
        date: reste[2] ?? "",
        ...(url ? { url } : {}),
        ...(reste[3] ? { localisation: reste[3] } : {}),
      };
    });
}

export async function actionEnregistrerQuestion(
  _prec: EtatFormulaireQuestion,
  formData: FormData,
): Promise<EtatFormulaireQuestion> {
  const s = await sessionRequise("tuteur");
  const id = chaine(formData, "id", 80) || undefined;
  const moduleId = chaine(formData, "moduleId", 80);
  const format = chaine(formData, "format", 3) as TypeQuestion;
  const enonce = chaine(formData, "enonce", 2000);
  const statut = (chaine(formData, "statut", 12) || "a_verifier") as StatutQuestion;

  if (!(await moduleExiste(moduleId))) return { erreur: "Module inconnu." };
  if (!["QCM", "QIM", "SCH", "ORD", "TAT"].includes(format)) return { erreur: "Format inconnu." };
  if (!enonce) return { erreur: "L'énoncé est obligatoire." };
  // Règle des quatre yeux (question 12) : on ne valide pas en écrivant ; une
  // question créée ou modifiée repart « à vérifier » (ou retirée).
  if (!["a_verifier", "retire"].includes(statut)) {
    return {
      erreur:
        "Une question ne se valide pas à l'enregistrement : elle se valide depuis la banque, par un autre code que son auteur — ou par lui, s'il est d'administration.",
    };
  }

  let options: OptionBase[] = [];
  let legendes: Legende[] = [];
  let imageId: string | null = null;

  // Image : le schéma en exige une, les autres formats peuvent en porter une
  // en illustration (« Possibilité d'intégrer des images », 19/09/2026).
  const fichier = formData.get("image") as File | null;
  if (fichier && fichier.size > 0) {
    if (fichier.size > IMAGE_MAX_OCTETS) return { erreur: "Image trop lourde (2 Mo au plus)." };
    const im = await enregistrerImage(Buffer.from(await fichier.arrayBuffer()), chaine(formData, "imageAlt", 300));
    if (!im) return { erreur: "L'image doit être un PNG ou un JPEG lisible." };
    imageId = im.id;
  } else if (id && formData.get("retirerImage") !== "on") {
    const existante = await lireQuestion(id);
    imageId = existante?.image_id ?? null;
  }

  if (format === "SCH") {
    const lues = lireLegendes(chaine(formData, "legendes", 20000));
    if (!lues) return { erreur: "Légendes illisibles." };
    legendes = lues;
    if (!imageId) return { erreur: "Un schéma à compléter a besoin d'une image." };
    if (!schemaPret(legendes)) return { erreur: "Chaque légende doit être posée sur l'image et porter un mot attendu." };
  } else if (format === "ORD") {
    // L'ordre de la liste EST la réponse : toutes les étapes sont « vraies »,
    // et `bonnesReponses` les relit dans cet ordre.
    const lues = lireOptions(chaine(formData, "options", 20000));
    if (!lues || lues.length < 2) return { erreur: "Une séquence a au moins deux étapes." };
    if (lues.some((o) => !o.texte.trim())) return { erreur: "Chaque étape doit porter un texte." };
    options = lues.map(({ justification: _j, ...o }) => ({ ...o, vrai: true }));
  } else if (format === "TAT") {
    const lues = lireOptions(chaine(formData, "options", 20000));
    if (!lues) return { erreur: "Vignettes illisibles." };
    const numeros = trousDuTexte(enonce);
    if (numeros.length === 0) {
      return { erreur: "Un texte à trous porte au moins une marque de trou : {1}, {2}…" };
    }
    const attendues = lues.filter((o) => o.vrai);
    if (attendues.length !== numeros.length) {
      return { erreur: `Il faut une vignette attendue par trou : ${numeros.length} attendue(s), ${attendues.length} donnée(s).` };
    }
    if (attendues.some((o) => !o.texte.trim())) {
      return { erreur: "Chaque trou doit recevoir la vignette attendue." };
    }
    // Attendues d'abord, dans l'ordre des trous ; leurres ensuite.
    options = [...attendues, ...lues.filter((o) => !o.vrai && o.texte.trim())].map(({ justification: _j, ...o }) => o);
  } else {
    const lues = lireOptions(chaine(formData, "options", 20000));
    if (!lues || lues.length < 2) return { erreur: "Il faut au moins deux propositions." };
    if (format === "QCM" && !lues.some((o) => o.vrai)) return { erreur: "Un QCM a au moins une proposition exacte." };
    options = lues;
  }

  // Question 74 (choix c) : autres modules, blocs et profils — seuls les identifiants connus sont gardés.
  const [tousModules, connus, blocsServis] = await Promise.all([getTousModulesAvecDeposes(), identifiantsConnus(), listeBlocs()]);
  const modulesConnus = new Set(tousModules.map((m) => m.id));
  const aussiDans = lireIdentifiants(formData.getAll("aussiDans"))
    .filter((m) => modulesConnus.has(m) && m !== moduleId)
    .slice(0, 80);
  const numerosBlocs = new Set(blocsServis.map((b) => b.numero));
  const blocs = lireBlocs(formData.getAll("blocs")).filter((n) => numerosBlocs.has(n));
  const profilFilieres = lireIdentifiants(formData.getAll("profilFilieres")).filter(
    (f) => f !== "socle" && connus.filieres.includes(f),
  );
  const profilNiveaux = lireIdentifiants(formData.getAll("profilNiveaux"))
    .map((n) => connus.niveaux.find((c) => c.toUpperCase() === n.toUpperCase()))
    .filter((n): n is string => Boolean(n));

  const q: QuestionAEnregistrer = {
    moduleId,
    situationId: chaine(formData, "situationId", 80) || null,
    format,
    enonce,
    options,
    legendes,
    modeReponse: lireModeReponse(chaine(formData, "modeReponse", 12)),
    imageId,
    justification: chaine(formData, "justification", 3000),
    eliminatoire: formData.get("eliminatoire") === "on",
    reservee: formData.get("reservee") === "on",
    obligatoire: formData.get("obligatoire") === "on",
    niveauQuestion: lireNiveauQuestion(formData.get("niveauQuestion")),
    refs: lireReferences(chaine(formData, "references", 3000)),
    statut,
    aussiDans,
    blocs,
    profilFilieres: [...new Set(profilFilieres)],
    profilNiveaux: [...new Set(profilNiveaux)],
  };
  // Les modules qu'elle quitte sont aussi à revalider.
  const avant = id ? await lireQuestion(id) : null;
  const ident = await enregistrerQuestion(q, s, id);
  await journaliser(s, id ? "modification-question" : "creation-question", ident, {
    moduleId,
    format,
    statut,
    ...(aussiDans.length > 0 ? { aussiDans } : {}),
    ...(blocs.length > 0 ? { blocs } : {}),
    ...(q.profilFilieres!.length > 0 || q.profilNiveaux!.length > 0
      ? { profils: { filieres: q.profilFilieres, niveaux: q.profilNiveaux } }
      : {}),
  });
  revalidatePath("/admin/questions");
  for (const m of new Set([moduleId, ...aussiDans, ...(avant ? modulesDeLaQuestion(avant) : [])])) {
    revalidatePath(`/module/${m}`);
  }
  // Venu de l'arborescence (question 64) ou de la liste : retour d'où l'on est parti. Sans adresse
  // de retour, l'arborescence réduite au module (vue par défaut, 01/10/2026).
  const ok = id ? "modifiee" : "creee";
  redirect(retourBanque(formData.get("retour"), { ok }) ?? `/admin/questions?module=${encodeURIComponent(moduleId)}&ok=${ok}`);
}

export async function actionChangerStatutQuestion(formData: FormData) {
  const s = await sessionRequise("tuteur");
  const id = chaine(formData, "id", 80);
  const statut = chaine(formData, "statut", 12) as StatutQuestion;
  // La banque seulement, ancre gardée : l'arborescence y rouvre la branche du geste.
  const retour = retourBanque(formData.get("retour")) ?? "/admin/questions";
  if (!["a_verifier", "valide", "retire"].includes(statut)) redirect(retour);
  const q = await lireQuestion(id);
  if (!q) redirect(retour);
  // Règle des quatre yeux (question 12) : un autre code que l'auteur courant
  // valide — sauf l'administration, qui valide aussi les siennes (23/09/2026),
  // la validation par l'auteur étant alors tracée sur la question et au journal.
  if (statut === "valide" && !peutValider(q, s)) {
    await journaliser(s, "statut-question:refus-quatre-yeux", id, { moduleId: q.module_id, auteur: q.edite_par ?? q.cree_par });
    redirect(retourBanque(retour, { erreur: "quatre-yeux" }) ?? retour);
  }
  const parAuteur = statut === "valide" && validationParAuteur(q, s);
  await changerStatutQuestion(id, statut, s, parAuteur);
  await journaliser(s, parAuteur ? "statut-question:valide-par-auteur" : `statut-question:${statut}`, id, { moduleId: q.module_id });
  revalidatePath("/admin/questions");
  for (const m of modulesDeLaQuestion(q)) revalidatePath(`/module/${m}`);
  redirect(retour);
}

/**
 * Gestes en lot de la barre de sélection (questions 88 et 89, choix a) :
 * classer, poser aussi dans, retirer d'un module, niveau, statut. Tutorat et
 * administration, comme toute modification d'une question ; une transaction
 * par geste ; une ligne au journal par question changée, et par validation
 * refusée ; retour sur la même vue de la banque, avec le bilan.
 *
 * Classer, poser aussi et retirer d'un module, changer le niveau : une
 * modification — une validée repasse « à vérifier », celui qui agit devient
 * l'auteur courant. Le statut : ce que font les boutons de chaque question,
 * la règle des quatre yeux jouant question par question.
 */
export async function actionLotQuestions(formData: FormData) {
  const s = await sessionRequise("tuteur");
  const geste = lireGeste(formData.get("geste"));
  const ids = lireIdentifiantsQuestions(formData.getAll("ids"));
  const retour = retourBanque(formData.get("retour")) ?? "/admin/questions";
  function refuser(): never {
    redirect(retourBanque(retour, { erreur: "lot", geste: geste ?? "" }) ?? retour);
  }
  // `fait` distingue deux gestes au bilan identique : la page repart d'une sélection vide.
  function conclure(bilan: Record<string, string | number>, modules: Iterable<string>): never {
    revalidatePath("/admin/questions");
    for (const m of new Set(modules)) revalidatePath(`/module/${m}`);
    const ajouts = Object.fromEntries(Object.entries(bilan).map(([k, v]) => [k, String(v)]));
    redirect(retourBanque(retour, { ok: "lot", geste: geste ?? "", ...ajouts, fait: Date.now().toString(36) }) ?? retour);
  }
  if (!geste || ids.length === 0) refuser();
  const modules = await getTousModulesAvecDeposes();
  const ouverts = new Set(modules.filter((m) => m.statut !== "retire").map((m) => m.id));
  const apres = (statut: StatutQuestion) => (statut === "valide" ? "a_verifier" : statut);
  const revues = (faits: { statut_avant: StatutQuestion }[]) => faits.filter((f) => f.statut_avant === "valide").length;

  if (geste === "classer") {
    const cible = chaine(formData, "module", 80);
    if (!ouverts.has(cible)) refuser();
    const faits = await reclasserQuestions(ids, cible, s);
    for (const f of faits) {
      await journaliser(s, "reclassement-question", f.id, {
        de: f.de,
        vers: cible,
        statutAvant: f.statut_avant,
        statutApres: apres(f.statut_avant),
        lot: ids.length,
      });
    }
    conclure({ nb: faits.length, revues: revues(faits), vers: cible }, [cible, ...faits.map((f) => f.de)]);
  }

  if (geste === "aussi") {
    const choisis = lireIdentifiants(formData.getAll("modules")).filter((m) => ouverts.has(m)).slice(0, AUSSI_MAX);
    if (choisis.length === 0) refuser();
    const faits = await poserAussiDansQuestions(ids, choisis, s);
    for (const f of faits) {
      await journaliser(s, "rattachement-question:ajout", f.id, {
        moduleId: f.module_id,
        modules: f.ajoutes,
        statutAvant: f.statut_avant,
        statutApres: apres(f.statut_avant),
        lot: ids.length,
      });
    }
    conclure(
      { nb: faits.length, revues: revues(faits), mods: choisis.length, ajouts: faits.reduce((t, f) => t + f.ajoutes.length, 0) },
      faits.flatMap((f) => [...f.modules, ...f.ajoutes]),
    );
  }

  if (geste === "retirer") {
    const quitte = chaine(formData, "module", 80);
    if (!modules.some((m) => m.id === quitte)) refuser();
    const { faits } = await retirerDuModuleQuestions(ids, quitte, s);
    for (const f of faits) {
      await journaliser(s, "rattachement-question:retrait", f.id, {
        moduleId: f.module_id,
        module: quitte,
        statutAvant: f.statut_avant,
        statutApres: apres(f.statut_avant),
        lot: ids.length,
      });
    }
    conclure({ nb: faits.length, revues: revues(faits), vers: quitte }, faits.flatMap((f) => f.modules));
  }

  if (geste === "niveau") {
    const brut = chaine(formData, "niveau", 20);
    const niveau = lireNiveauQuestion(brut);
    if (brut !== "a_preciser" && niveau === null) refuser();
    const faits = await changerNiveauQuestions(ids, niveau, s);
    for (const f of faits) {
      await journaliser(s, "niveau-question", f.id, {
        moduleId: f.module_id,
        de: f.niveau_avant,
        vers: niveau,
        statutAvant: f.statut_avant,
        statutApres: apres(f.statut_avant),
        lot: ids.length,
      });
    }
    conclure({ nb: faits.length, revues: revues(faits), cible: niveau ?? "a_preciser" }, faits.flatMap((f) => f.modules));
  }

  const statut = lireStatutLot(chaine(formData, "statut", 12));
  if (!statut) refuser();
  const { faits, refusees } = await changerStatutQuestions(ids, statut, s);
  for (const f of faits) {
    await journaliser(s, f.parAuteur ? "statut-question:valide-par-auteur" : `statut-question:${statut}`, f.id, {
      moduleId: f.module_id,
      lot: ids.length,
    });
  }
  for (const r of refusees) {
    await journaliser(s, "statut-question:refus-quatre-yeux", r.id, { moduleId: r.module_id, auteur: r.auteur, lot: ids.length });
  }
  conclure(
    {
      nb: faits.length,
      revues: statut === "a_verifier" ? revues(faits) : 0,
      cible: statut,
      auteur: faits.filter((f) => f.parAuteur).length,
      refus: refusees.length,
    },
    faits.flatMap((f) => f.modules),
  );
}

export async function actionSupprimerQuestion(formData: FormData) {
  const s = await sessionRequise("admin");
  const id = chaine(formData, "id", 80);
  const q = await lireQuestion(id);
  if (q) {
    await supprimerQuestion(id);
    await journaliser(s, "suppression-question", id, { moduleId: q.module_id, enonce: q.enonce.slice(0, 120) });
    for (const m of modulesDeLaQuestion(q)) revalidatePath(`/module/${m}`);
  }
  revalidatePath("/admin/questions");
  // Depuis l'arborescence, retour au module de la question supprimée ; sans adresse, l'arborescence
  // réduite au module (vue par défaut, 01/10/2026).
  redirect(retourBanque(formData.get("retour")) ?? (q ? `/admin/questions?module=${encodeURIComponent(q.module_id)}` : "/admin/questions"));
}

export async function actionEnregistrerSituation(formData: FormData) {
  const s = await sessionRequise("tuteur");
  const id = chaine(formData, "id", 80) || undefined;
  const moduleId = chaine(formData, "moduleId", 80);
  const titre = chaine(formData, "titre", 200);
  const contexte = chaine(formData, "contexte", 4000);
  // Modifiée depuis la liste, elle y revient, filtre compris (question 92, choix a) ; créée, la liste
  // de son module, où elle paraît.
  const retour = (ajouts: Record<string, string>) =>
    id
      ? retourListe(formData.get("liste"), "/admin/questions/situations", ajouts)
      : `/admin/questions/situations?${new URLSearchParams({ module: moduleId, ...ajouts })}`;
  if (!(await moduleExiste(moduleId)) || !titre || !contexte) {
    redirect(retour({ erreur: "incomplet" }));
  }
  const ident = await enregistrerSituation({ moduleId, titre, contexte }, id);
  await journaliser(s, id ? "modification-situation" : "creation-situation", ident, { moduleId });
  revalidatePath("/admin/questions/situations");
  revalidatePath(`/module/${moduleId}`);
  redirect(retour({ ok: "1" }));
}

export async function actionSupprimerSituation(formData: FormData) {
  const s = await sessionRequise("admin");
  const id = chaine(formData, "id", 80);
  const moduleId = chaine(formData, "moduleId", 80);
  await supprimerSituation(id);
  await journaliser(s, "suppression-situation", id, { moduleId });
  revalidatePath("/admin/questions/situations");
  redirect(retourListe(formData.get("liste"), "/admin/questions/situations"));
}

// ─────────────────────────────────────────────────────────── import en deux temps

function cleFichier(nom: string): string {
  return (nom.split(/[\\/]/).pop() ?? nom)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\.[a-z0-9]+$/, "");
}

/**
 * Apparie les images déposées aux questions lues.
 *
 * Schéma : par nom annoncé, sinon l'image unique, sinon le rang — l'image y
 * est la question elle-même. Illustration de toute autre question (QCM, QIM,
 * séquence, texte à trous) : par nom seulement, jamais au rang, qui collerait
 * l'image d'un schéma voisin sur une question qui n'en demandait pas.
 */
function apparierImages(
  questions: QuestionImportee[],
  images: { nom: string; id: string }[],
): QuestionImporteeAvecImage[] {
  const cles = images.map((i) => cleFichier(i.nom));
  return questions.map((q) => {
    if (q.format !== "SCH") {
      if (!q.imageNom) return q;
      const n = cles.indexOf(cleFichier(q.imageNom));
      if (n < 0) {
        return {
          ...q,
          imageId: null,
          avertissements: [...q.avertissements, `Image « ${q.imageNom} » non déposée : ajoutez-la dans l'aperçu.`],
        };
      }
      return { ...q, imageId: images[n].id };
    }
    let k = -1;
    if (q.imageNom) k = cles.indexOf(cleFichier(q.imageNom));
    if (k < 0 && images.length === 1) k = 0;
    if (k < 0 && q.numeroSchema && q.numeroSchema - 1 < images.length) k = q.numeroSchema - 1;
    if (k < 0) {
      return { ...q, imageId: null, avertissements: [...q.avertissements.filter((a) => !a.startsWith("Image à choisir")), "Aucune image appariée : à choisir dans l'éditeur après l'import."] };
    }
    return { ...q, imageId: images[k].id, avertissements: q.avertissements.filter((a) => !a.startsWith("Image à choisir")) };
  });
}

/**
 * Image collée dans le Word, lue dans l'archive et enregistrée (question 84,
 * choix a) ; `null` si elle ne peut pas l'être, et l'avertissement dit
 * pourquoi. Elle n'est pas réduite : au-delà de 2 Mo, elle s'ajoute dans
 * l'aperçu, où l'appareil la réduit avant l'envoi.
 */
async function enregistrerImageCollee(docx: Buffer, c: ImageCollee, avertissements: string[]): Promise<string | null> {
  let octets: Buffer;
  try {
    octets = lireOctets(docx, c.chemin);
  } catch {
    avertissements.push(`Image collée « ${c.nom} » introuvable dans le fichier : ajoutez-la dans l'aperçu.`);
    return null;
  }
  if (octets.length > IMAGE_MAX_OCTETS) {
    avertissements.push(`Image collée « ${c.nom} » refusée : plus de 2 Mo. Ajoutez-la dans l'aperçu, où elle est réduite avant l'envoi.`);
    return null;
  }
  const im = await enregistrerImage(octets, c.nom.replace(/\.[a-z0-9]+$/i, ""));
  if (!im) {
    avertissements.push(`Image collée « ${c.nom} » refusée : ni PNG ni JPEG lisible. Ajoutez-la dans l'aperçu en PNG ou en JPEG.`);
    return null;
  }
  return im.id;
}

/** Texte d'une question tel que la proposition de module le compare : tout ce qu'elle dit. */
function texteDeQuestion(q: QuestionImportee): string {
  return [
    q.enonce,
    ...q.options.map((o) => `${o.texte} ${o.justification ?? ""}`),
    ...q.legendes.map((l) => l.attendu),
    q.justification,
  ].join(" ");
}

/**
 * Module de chaque question (question 57, choix a) : sa ligne « Module : »,
 * sinon le module choisi au formulaire, sinon la proposition du site ; à
 * défaut, à choisir dans l'aperçu. La proposition ne lit la base que si une
 * question en a besoin.
 */
async function rattacherModules(questions: QuestionImportee[], moduleFormulaire: string): Promise<QuestionImporteeAvecImage[]> {
  const ouverts = await modulesOuvertsAuDepot();
  const reperes = ouverts.map(versRepere);
  const noms = reperesModules(reperes);
  let index: IndexModules | null = null;
  if (!moduleFormulaire && questions.some((q) => !q.moduleLigne)) {
    const valides = await textesValidesParModule();
    index = indexerModules(
      ouverts.map((m) => ({
        ...versRepere(m),
        textes: [
          m.objectif,
          ...[...m.questions, ...m.misesEnSituation.flatMap((x) => x.questions)].flatMap((q) => [q.enonce, ...q.options.map((o) => o.texte)]),
          ...(valides.get(m.id) ?? []),
        ],
      })),
    );
  }
  return questions.map((q): QuestionImporteeAvecImage => {
    if (q.moduleLigne) {
      const r = resoudreLigneModule(q.moduleLigne, reperes);
      return r.id
        ? { ...q, moduleId: r.id, origineModule: "ligne", detailModule: `ligne « Module : ${q.moduleLigne} »` }
        : { ...q, moduleId: null, origineModule: "a-choisir", detailModule: `ligne « Module : ${q.moduleLigne} » : ${r.raison}` };
    }
    if (moduleFormulaire) return { ...q, moduleId: moduleFormulaire, origineModule: "formulaire", detailModule: "module choisi au formulaire" };
    const p = proposerModule(index as IndexModules, texteDeQuestion(q));
    if (p.id) {
      const retenu = p.candidats[0];
      return { ...q, moduleId: p.id, origineModule: "proposition", detailModule: `proposé — mots communs : ${retenu.mots.join(", ")}` };
    }
    const hesitation = p.candidats
      .slice(0, 2)
      .map((c) => `${noms.get(c.id) ?? c.id} (${c.mots.slice(0, 3).join(", ")})`)
      .join(" ou ");
    return {
      ...q,
      moduleId: null,
      origineModule: "a-choisir",
      detailModule: hesitation ? `à choisir — rien de net : ${hesitation}` : "à choisir — aucun mot commun avec un module",
    };
  });
}

export async function actionAnalyserImport(prec: EtatImport, formData: FormData): Promise<EtatImport> {
  await sessionRequise("tuteur");
  // Module du formulaire : facultatif depuis la question 57 (choix a) ; choisi,
  // il vaut pour les questions sans ligne « Module : ».
  const moduleId = chaine(formData, "moduleId", 80);
  const formatDefaut = chaine(formData, "formatDefaut", 3) === "QIM" ? "QIM" : "QCM";
  const base: EtatImport = { ...prec, etape: "saisie", moduleId, formatDefaut, questions: [], images: [], avertissements: [], erreur: undefined };
  if (moduleId && !(await moduleExiste(moduleId))) return { ...base, erreur: "Module inconnu." };

  let texte = chaine(formData, "texte", 400_000);
  let nom = "texte collé";
  // Fichier Word et ses images collées (question 84, choix a).
  let docx: Buffer | null = null;
  let collees: ImageCollee[] = [];
  const fichier = formData.get("fichier") as File | null;
  if (fichier && fichier.size > 0) {
    if (fichier.size > 8 * 1024 * 1024) return { ...base, erreur: "Fichier trop lourd (8 Mo au plus)." };
    const octets = Buffer.from(await fichier.arrayBuffer());
    nom = fichier.name;
    if (/\.docx$/i.test(fichier.name)) {
      try {
        ({ texte, images: collees } = lireDocx(octets));
        docx = octets;
      } catch (e) {
        return { ...base, erreur: e instanceof Error ? e.message : "Fichier .docx illisible." };
      }
    } else if (/\.(txt|md|json)$/i.test(fichier.name)) {
      texte = octets.toString("utf8");
    } else {
      return { ...base, erreur: "Formats acceptés : .txt, .md, .docx, .json — ou du texte collé." };
    }
  }
  if (!texte.trim()) return { ...base, erreur: "Rien à analyser : collez un texte ou choisissez un fichier." };

  const images: { nom: string; id: string }[] = [];
  const avertissements: string[] = [];
  for (const f of formData.getAll("images")) {
    if (!(f instanceof File) || f.size === 0) continue;
    if (f.size > IMAGE_MAX_OCTETS) {
      avertissements.push(`Image « ${f.name} » ignorée : plus de 2 Mo.`);
      continue;
    }
    const im = await enregistrerImage(Buffer.from(await f.arrayBuffer()), f.name.replace(/\.[a-z0-9]+$/i, ""));
    if (!im) {
      avertissements.push(`Image « ${f.name} » ignorée : ni PNG ni JPEG lisible.`);
      continue;
    }
    images.push({ nom: f.name, id: im.id });
  }

  const r = analyserTexte(texte, { formatDefaut });
  // Images collées dans le Word (question 84, choix a) : seules celles
  // qu'une question garde sont enregistrées, une fois chacune.
  if (docx && collees.length > 0) {
    const gardees = new Set(r.questions.flatMap((q) => (q.imageNom ? [cleFichier(q.imageNom)] : [])));
    const parChemin = new Map<string, string | null>();
    for (const c of collees) {
      if (!gardees.has(cleFichier(c.nom))) continue;
      let id = parChemin.get(c.chemin);
      if (id === undefined) {
        id = await enregistrerImageCollee(docx, c, avertissements);
        parChemin.set(c.chemin, id);
      }
      if (id) images.push({ nom: c.nom, id });
    }
  }
  const questions = apparierImages(await rattacherModules(r.questions, moduleId), images);
  // « Description de l'image » : elle remplace le nom du fichier, posé par
  // défaut à l'enregistrement. Appliquée ici, sur les images que cette
  // requête vient de créer — pas sur ce que renverrait l'aperçu.
  const creees = new Set(images.map((i) => i.id));
  for (const q of questions) {
    if (q.imageId && q.imageAlt && creees.has(q.imageId)) await majAltImage(q.imageId, q.imageAlt.slice(0, 300));
  }
  return {
    ...base,
    etape: r.questions.length ? "apercu" : "saisie",
    nom,
    questions,
    images,
    avertissements: [...avertissements, ...r.avertissements],
    erreur: r.questions.length ? undefined : "Aucune question reconnue dans ce texte.",
  };
}

/**
 * Image ajoutée ou changée dans l'aperçu d'un dépôt (question 84, choix a).
 * L'appareil l'a préparée (réduite à 2 000 px, sans métadonnées) ; elle est
 * enregistrée ici, avec la description lue au dépôt. Une image que l'ajout
 * à la banque ne retient pas reste orpheline, et part au nettoyage après
 * sept jours, comme celles d'un dépôt abandonné.
 */
export async function actionImageApercu(formData: FormData): Promise<{ id: string } | { erreur: string }> {
  await sessionRequise("tuteur");
  const f = formData.get("image");
  if (!(f instanceof File) || f.size === 0) return { erreur: "Aucune image choisie." };
  if (f.size > IMAGE_MAX_OCTETS) return { erreur: "Image de plus de 2 Mo que ce navigateur n'a pas pu réduire : réduisez-la, puis choisissez-la de nouveau." };
  const alt = chaine(formData, "alt", 300) || f.name.replace(/\.[a-z0-9]+$/i, "");
  const im = await enregistrerImage(Buffer.from(await f.arrayBuffer()), alt);
  return im ? { id: im.id } : { erreur: "Image refusée : ni PNG ni JPEG lisible." };
}

export async function actionConfirmerImport(prec: EtatImport, formData: FormData): Promise<EtatImport> {
  const s = await sessionRequise("tuteur");
  const nom = chaine(formData, "nom", 200) || "dépôt";
  let questions: QuestionImporteeAvecImage[];
  try {
    questions = JSON.parse(chaine(formData, "questions", 2_000_000)) as QuestionImporteeAvecImage[];
    if (!Array.isArray(questions)) throw new Error();
  } catch {
    return { ...prec, erreur: "Aperçu illisible : relancer l'analyse." };
  }
  // Module et format de chaque question : ceux de l'aperçu, où ils se changent
  // (questions 57 et 58, choix a). Rien n'entre en base sans module ; le
  // format ne passe que de QCM à QIM ou l'inverse.
  const retenues: { q: QuestionImporteeAvecImage; moduleId: string; format: TypeQuestion; imageId: string | null }[] = [];
  let sansModule = 0;
  questions.forEach((q, i) => {
    if (formData.get(`exclure-${i}`) === "on") return;
    const moduleId = chaine(formData, `module-${i}`, 80);
    if (!moduleId) {
      sansModule++;
      return;
    }
    const demande = chaine(formData, `format-${i}`, 3);
    const format = (q.format === "QCM" || q.format === "QIM") && (demande === "QCM" || demande === "QIM") ? demande : q.format;
    // Image : celle de l'aperçu, où elle s'ajoute, se change ou se retire
    // (question 84, choix a). Sans ce champ (schéma), celle de l'analyse.
    const champImage = formData.get(`image-${i}`);
    const imageId =
      typeof champImage === "string" ? (/^[A-Za-z0-9_-]{1,40}$/.test(champImage) ? champImage : null) : (q.imageId ?? null);
    retenues.push({ q, moduleId, format, imageId });
  });
  if (sansModule > 0) {
    return {
      ...prec,
      erreur: `${sansModule} question${sansModule > 1 ? "s" : ""} sans module : choisissez-le, ou excluez-la${sansModule > 1 ? "s" : ""}.`,
    };
  }
  if (retenues.length === 0) return { ...prec, erreur: "Aucune question retenue." };
  const modules = [...new Set(retenues.map((r) => r.moduleId))];
  for (const id of modules) {
    if (!(await moduleExiste(id))) return { ...prec, erreur: `Module inconnu : ${id}.` };
  }
  for (const id of new Set(retenues.flatMap((r) => (r.imageId ? [r.imageId] : [])))) {
    if (!(await imageExiste(id))) return { ...prec, erreur: "Une image de l'aperçu n'existe plus : choisissez-la de nouveau, ou relancez l'analyse." };
  }

  const depotId = await enregistrerDepotQuestions(
    { nom, moduleId: modules.length === 1 ? modules[0] : null, nb: retenues.length, nbAVerifier: retenues.length },
    s,
  );
  const lot: QuestionAEnregistrer[] = retenues.map(({ q, moduleId, format, imageId }) => ({
    moduleId,
    situationId: null,
    format,
    enonce: q.enonce.slice(0, 2000),
    options:
      q.format === "SCH"
        ? []
        : q.options.map((o) => ({
            id: o.id,
            texte: o.texte.slice(0, 500),
            vrai: o.vrai,
            // Justification de la proposition (question 85, choix a) : QCM et QIM seulement.
            ...((format === "QCM" || format === "QIM") && o.justification
              ? { justification: o.justification.slice(0, JUSTIFICATION_PROPOSITION_MAX) }
              : {}),
          })),
    legendes: q.format === "SCH" ? q.legendes : [],
    modeReponse: "ecrire",
    imageId,
    justification: q.justification.slice(0, 3000),
    eliminatoire: q.eliminatoire,
    reservee: q.reservee,
    obligatoire: q.obligatoire,
    niveauQuestion: lireNiveauQuestion(q.niveauQuestion),
    refs: q.refs,
    statut: "a_verifier",
    depotId,
  }));
  const ids = await insererLot(lot, s);
  await journaliser(s, "import-questions", depotId, { modules, nom, n: ids.length });
  revalidatePath("/admin/questions");
  return {
    ...prec,
    etape: "fait",
    ajoutees: ids.length,
    ajouteesParModule: modules.map((id) => ({ id, n: retenues.filter((r) => r.moduleId === id).length })),
    erreur: undefined,
    questions: [],
    images: [],
  };
}

// ────────────────────────────────────────────────────────────── signalements

export async function actionTraiterSignalement(formData: FormData) {
  const s = await sessionRequise("tuteur");
  const id = Number(formData.get("id"));
  const statut = chaine(formData, "statut", 8) === "rejete" ? "rejete" : "traite";
  const reponse = chaine(formData, "reponse", 1000);
  if (Number.isFinite(id)) {
    await traiterSignalement(id, statut, reponse, s);
    await journaliser(s, `signalement:${statut}`, `signalement:${id}`);
  }
  revalidatePath("/admin/signalements");
  redirect(retourListe(formData.get("liste"), "/admin/signalements"));
}

/**
 * « Rejeter » a sa propre action, posée sur le bouton (`formAction`) : la
 * valeur du bouton cliqué ne parvenait pas à l'action du formulaire, et un
 * rejet s'enregistrait « traité » (constaté le 23/09/2026, question 54).
 */
export async function actionRejeterSignalement(formData: FormData) {
  formData.set("statut", "rejete");
  return actionTraiterSignalement(formData);
}
