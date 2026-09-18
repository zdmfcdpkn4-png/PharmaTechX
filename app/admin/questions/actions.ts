"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sessionRequise } from "@/lib/auth";
import { journaliser } from "@/lib/journal";
import { IMAGE_MAX_OCTETS, enregistrerImage } from "@/lib/images";
import { texteDocx } from "@/lib/docx";
import { analyserTexte, type QuestionImportee } from "@/lib/import-questions";
import { schemaPret, type Legende } from "@/content/schema";
import { getModule } from "@/content/store";
import type { Reference } from "@/content/types";
import {
  changerStatutQuestion,
  enregistrerDepotQuestions,
  enregistrerQuestion,
  enregistrerSituation,
  insererLot,
  lireQuestion,
  supprimerQuestion,
  supprimerSituation,
  traiterSignalement,
  type OptionBase,
  type QuestionAEnregistrer,
  type StatutQuestion,
} from "@/content/banque-db";
import type { EtatFormulaireQuestion, EtatImport, QuestionImporteeAvecImage } from "./import-etat";

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
      out.push({ id: String(x.id ?? "").slice(0, 4) || String.fromCharCode(97 + out.length), texte, vrai: x.vrai === true });
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
  const format = chaine(formData, "format", 3);
  const enonce = chaine(formData, "enonce", 2000);
  const statut = (chaine(formData, "statut", 12) || "a_verifier") as StatutQuestion;

  if (!getModule(moduleId)) return { erreur: "Module inconnu." };
  if (format !== "QCM" && format !== "QIM" && format !== "SCH") return { erreur: "Format inconnu." };
  if (!enonce) return { erreur: "L'énoncé est obligatoire." };
  if (!["a_verifier", "valide", "retire"].includes(statut)) return { erreur: "Statut inconnu." };

  let options: OptionBase[] = [];
  let legendes: Legende[] = [];
  let imageId: string | null = null;

  if (format === "SCH") {
    const lues = lireLegendes(chaine(formData, "legendes", 20000));
    if (!lues) return { erreur: "Légendes illisibles." };
    legendes = lues;
    const fichier = formData.get("image") as File | null;
    if (fichier && fichier.size > 0) {
      if (fichier.size > IMAGE_MAX_OCTETS) return { erreur: "Image trop lourde (2 Mo au plus)." };
      const im = await enregistrerImage(Buffer.from(await fichier.arrayBuffer()), chaine(formData, "imageAlt", 300));
      if (!im) return { erreur: "L'image doit être un PNG ou un JPEG lisible." };
      imageId = im.id;
    } else if (id) {
      const existante = await lireQuestion(id);
      imageId = existante?.image_id ?? null;
    }
    if (!imageId) return { erreur: "Un schéma à compléter a besoin d'une image." };
    if (!schemaPret(legendes)) return { erreur: "Chaque légende doit être posée sur l'image et porter un mot attendu." };
  } else {
    const lues = lireOptions(chaine(formData, "options", 20000));
    if (!lues || lues.length < 2) return { erreur: "Il faut au moins deux propositions." };
    if (format === "QCM" && !lues.some((o) => o.vrai)) return { erreur: "Un QCM a au moins une proposition exacte." };
    options = lues;
  }

  const q: QuestionAEnregistrer = {
    moduleId,
    situationId: chaine(formData, "situationId", 80) || null,
    format,
    enonce,
    options,
    legendes,
    modeReponse: chaine(formData, "modeReponse", 8) === "choisir" ? "choisir" : "ecrire",
    imageId,
    justification: chaine(formData, "justification", 3000),
    eliminatoire: formData.get("eliminatoire") === "on",
    refs: lireReferences(chaine(formData, "references", 3000)),
    statut,
  };
  const ident = await enregistrerQuestion(q, s, id);
  await journaliser(s, id ? "modification-question" : "creation-question", ident, { moduleId, format, statut });
  revalidatePath("/admin/questions");
  revalidatePath(`/module/${moduleId}`);
  redirect(`/admin/questions?module=${encodeURIComponent(moduleId)}&ok=${id ? "modifiee" : "creee"}`);
}

export async function actionChangerStatutQuestion(formData: FormData) {
  const s = await sessionRequise("tuteur");
  const id = chaine(formData, "id", 80);
  const statut = chaine(formData, "statut", 12) as StatutQuestion;
  const retour = chaine(formData, "retour", 200) || "/admin/questions";
  if (!["a_verifier", "valide", "retire"].includes(statut)) redirect(retour);
  const q = await lireQuestion(id);
  if (!q) redirect(retour);
  await changerStatutQuestion(id, statut, s);
  await journaliser(s, `statut-question:${statut}`, id, { moduleId: q.module_id });
  revalidatePath("/admin/questions");
  revalidatePath(`/module/${q.module_id}`);
  redirect(retour);
}

export async function actionSupprimerQuestion(formData: FormData) {
  const s = await sessionRequise("admin");
  const id = chaine(formData, "id", 80);
  const q = await lireQuestion(id);
  if (q) {
    await supprimerQuestion(id);
    await journaliser(s, "suppression-question", id, { moduleId: q.module_id, enonce: q.enonce.slice(0, 120) });
    revalidatePath(`/module/${q.module_id}`);
  }
  revalidatePath("/admin/questions");
  redirect(q ? `/admin/questions?module=${encodeURIComponent(q.module_id)}` : "/admin/questions");
}

export async function actionEnregistrerSituation(formData: FormData) {
  const s = await sessionRequise("tuteur");
  const id = chaine(formData, "id", 80) || undefined;
  const moduleId = chaine(formData, "moduleId", 80);
  const titre = chaine(formData, "titre", 200);
  const contexte = chaine(formData, "contexte", 4000);
  if (!getModule(moduleId) || !titre || !contexte) {
    redirect(`/admin/questions/situations?module=${encodeURIComponent(moduleId)}&erreur=incomplet`);
  }
  const ident = await enregistrerSituation({ moduleId, titre, contexte }, id);
  await journaliser(s, id ? "modification-situation" : "creation-situation", ident, { moduleId });
  revalidatePath("/admin/questions/situations");
  revalidatePath(`/module/${moduleId}`);
  redirect(`/admin/questions/situations?module=${encodeURIComponent(moduleId)}&ok=1`);
}

export async function actionSupprimerSituation(formData: FormData) {
  const s = await sessionRequise("admin");
  const id = chaine(formData, "id", 80);
  const moduleId = chaine(formData, "moduleId", 80);
  await supprimerSituation(id);
  await journaliser(s, "suppression-situation", id, { moduleId });
  revalidatePath("/admin/questions/situations");
  redirect(`/admin/questions/situations?module=${encodeURIComponent(moduleId)}`);
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

/** Apparie les schémas lus aux images déposées : par nom annoncé, sinon par rang, sinon l'image unique. */
function apparierImages(
  questions: QuestionImportee[],
  images: { nom: string; id: string }[],
): QuestionImporteeAvecImage[] {
  const cles = images.map((i) => cleFichier(i.nom));
  return questions.map((q) => {
    if (q.format !== "SCH") return q;
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

export async function actionAnalyserImport(prec: EtatImport, formData: FormData): Promise<EtatImport> {
  await sessionRequise("tuteur");
  const moduleId = chaine(formData, "moduleId", 80);
  const formatDefaut = chaine(formData, "formatDefaut", 3) === "QIM" ? "QIM" : "QCM";
  const base: EtatImport = { ...prec, etape: "saisie", moduleId, formatDefaut, questions: [], images: [], avertissements: [], erreur: undefined };
  if (!getModule(moduleId)) return { ...base, erreur: "Choisir le module de rattachement." };

  let texte = chaine(formData, "texte", 400_000);
  let nom = "texte collé";
  const fichier = formData.get("fichier") as File | null;
  if (fichier && fichier.size > 0) {
    if (fichier.size > 8 * 1024 * 1024) return { ...base, erreur: "Fichier trop lourd (8 Mo au plus)." };
    const octets = Buffer.from(await fichier.arrayBuffer());
    nom = fichier.name;
    if (/\.docx$/i.test(fichier.name)) {
      try {
        texte = texteDocx(octets);
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
  const questions = apparierImages(r.questions, images);
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

export async function actionConfirmerImport(prec: EtatImport, formData: FormData): Promise<EtatImport> {
  const s = await sessionRequise("tuteur");
  const moduleId = chaine(formData, "moduleId", 80);
  const nom = chaine(formData, "nom", 200) || "dépôt";
  let questions: QuestionImporteeAvecImage[];
  try {
    questions = JSON.parse(chaine(formData, "questions", 2_000_000)) as QuestionImporteeAvecImage[];
    if (!Array.isArray(questions)) throw new Error();
  } catch {
    return { ...prec, erreur: "Aperçu illisible : relancer l'analyse." };
  }
  if (!getModule(moduleId)) return { ...prec, erreur: "Module inconnu." };
  const retenues = questions.filter((_, i) => formData.get(`exclure-${i}`) !== "on");
  if (retenues.length === 0) return { ...prec, erreur: "Aucune question retenue." };

  const depotId = await enregistrerDepotQuestions(
    { nom, moduleId, nb: retenues.length, nbAVerifier: retenues.length },
    s,
  );
  const lot: QuestionAEnregistrer[] = retenues.map((q) => ({
    moduleId,
    situationId: null,
    format: q.format,
    enonce: q.enonce.slice(0, 2000),
    options: q.format === "SCH" ? [] : q.options.map((o) => ({ id: o.id, texte: o.texte.slice(0, 500), vrai: o.vrai })),
    legendes: q.format === "SCH" ? q.legendes : [],
    modeReponse: "ecrire",
    imageId: q.format === "SCH" ? (q.imageId ?? null) : null,
    justification: q.justification.slice(0, 3000),
    eliminatoire: q.eliminatoire,
    refs: q.refs,
    statut: "a_verifier",
    depotId,
  }));
  const ids = await insererLot(lot, s);
  await journaliser(s, "import-questions", depotId, { moduleId, nom, n: ids.length });
  revalidatePath("/admin/questions");
  return { ...prec, etape: "fait", ajoutees: ids.length, erreur: undefined, questions: [], images: [] };
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
  redirect("/admin/signalements");
}
