import { NextResponse } from "next/server";
import { getModuleComplet } from "@/content/store";
import { ordreLecture, motAttendu, verdictLegende } from "@/content/schema";
import { banqueDuModule, noterQuestion } from "@/content/types";
import type { Question, ReponseApprenant } from "@/content/types";
import { sceller } from "@/lib/sceau";
import { decider, type Verdict } from "@/lib/decision";
import { lireBareme } from "@/lib/bareme-db";
import { tirageConforme, type Difficulte } from "@/content/tirage";
import { refusApiSansSession } from "@/lib/auth";
import { enregistrerEvaluation, rattachement } from "@/lib/progression";
import type { Bareme } from "@/content/bareme";

export const dynamic = "force-dynamic";

/**
 * Correction d'une évaluation.
 *
 * Ce que reçoit le serveur : un identifiant de module et, pour chaque question,
 * les identifiants des options cochées (QCM), jugées vraies et jugées (QIM),
 * ou le mot écrit par légende (schéma). Rien d'autre. Aucun nom, aucun
 * matricule, aucune adresse.
 *
 * Ce que fait le serveur : il corrige, renvoie le résultat et le scelle
 * (`jeton`) pour que le rapport émis plus tard soit bien celui-ci.
 *
 * Ce que le serveur écrit : rien, sauf dans deux cas. Si l'apprenant s'est
 * rattaché à son identifiant d'agent (question 11, choix c), une évaluation
 * complète (`mode: "evaluation"`) est conservée dans sa progression, avec son
 * sceau ; et, si la conservation des rapports est activée, le rapport qu'il
 * émet ensuite entre dans la table des rapports sous cet identifiant. Un
 * entraînement, corrigé question par question, n'est jamais conservé ici.
 */

interface CorpsRequete {
  moduleId?: unknown;
  reponses?: unknown;
  questionIds?: unknown;
  /** QIM en Vrai/Faux : propositions effectivement jugées, par question. */
  juges?: unknown;
  /** Schémas : mot écrit par légende, par question. */
  legendes?: unknown;
  /** Libellé du tirage, informatif (« Habilitation · 9 questions »). */
  tirage?: unknown;
  /** `evaluation` (tirage complet, conservé si l'apprenant est rattaché) ou `entrainement`. */
  mode?: unknown;
  /** Tirage choisi (`decouverte`, `habilitation`, `complet`) : la règle des questions réservées en dépend. */
  difficulte?: unknown;
}

export interface DetailLegende {
  numero: number;
  reponse: string;
  attendu: string;
  verdict: "juste" | "fausse" | "vide";
}

export interface DetailQuestion {
  questionId: string;
  enonce: string;
  type: Question["type"];
  situation: string | null;
  note: number;
  /** Poids de la question selon le barème (plafond) ; absent = 1. */
  max?: number;
  discordances: number;
  /** QIM : propositions laissées sans réponse ; schéma : légendes vides. */
  nonJugees: number;
  correct: boolean;
  eliminatoire: boolean;
  /** Réservée à l'évaluation (question 18) : jamais vue en entraînement. */
  reservee: boolean;
  choixApprenant: string[];
  reponsesAttendues: string[];
  justification: string;
  sources: string[];
  /** Schéma à compléter : le détail par légende. */
  legendes?: DetailLegende[];
}

export interface ResultatEvaluation {
  moduleId: string;
  moduleTitre: string;
  critereId: string | null;
  seuilReussite: number;
  pointsObtenus: number;
  pointsTotal: number;
  score: number;
  echecEliminatoire: boolean;
  /** `true` si et seulement si le verdict brut est « acquis ». */
  reussi: boolean;
  /**
   * Verdict brut (voir `lib/decision.ts`) : acquis, non acquis, indéterminé
   * (bande de garde, arbitrage du tuteur) ou non concluant (tirage trop court).
   */
  verdict: Verdict;
  /** Largeur de la bande de garde, en points de pourcentage, et ses bornes. */
  bande: number;
  bandeBasse: number;
  bandeHaute: number;
  concluant: boolean;
  minQuestions: number;
  /** Barème en vigueur à l'évaluation (copié, scellé) : le rapport se relit avec lui. */
  bareme: Bareme;
  detail: DetailQuestion[];
  horodatage: string;
  horodatageIso: string;
  tirage: string;
  /** Questions réservées à l'évaluation : posées dans ce tirage, disponibles dans la banque à cet instant (absent des résultats antérieurs). */
  reservees?: { posees: number; disponibles: number };
  /** Sceau du serveur sur ce résultat (vérifié à l'émission du rapport). */
  jeton: string;
}

function listeDeChaines(brut: unknown): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  if (brut && typeof brut === "object") {
    for (const [cle, val] of Object.entries(brut as Record<string, unknown>)) {
      if (Array.isArray(val)) {
        out[cle] = val.filter((v): v is string => typeof v === "string").slice(0, 50);
      }
    }
  }
  return out;
}

function dictionnaireDeChaines(brut: unknown): Record<string, Record<string, string>> {
  const out: Record<string, Record<string, string>> = {};
  if (brut && typeof brut === "object") {
    for (const [cle, val] of Object.entries(brut as Record<string, unknown>)) {
      if (val && typeof val === "object") {
        const d: Record<string, string> = {};
        for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
          if (typeof v === "string") d[k] = v.slice(0, 200);
        }
        out[cle] = d;
      }
    }
  }
  return out;
}

export async function POST(request: Request) {
  const refus = await refusApiSansSession();
  if (refus) return refus;
  let corps: CorpsRequete;
  try {
    corps = await request.json();
  } catch {
    return NextResponse.json({ erreur: "Requête illisible." }, { status: 400 });
  }

  const moduleId = typeof corps.moduleId === "string" ? corps.moduleId : null;
  if (!moduleId) {
    return NextResponse.json({ erreur: "Identifiant de module manquant." }, { status: 400 });
  }

  const mod = await getModuleComplet(moduleId);
  if (!mod) {
    return NextResponse.json({ erreur: "Module inconnu." }, { status: 404 });
  }

  const banque = banqueDuModule(mod);
  if (banque.length === 0) {
    return NextResponse.json(
      { erreur: "Ce module ne comporte pas encore d'évaluation." },
      { status: 404 },
    );
  }

  // Le tirage est décidé côté client ; le serveur ne corrige que les questions
  // effectivement posées, en vérifiant qu'elles appartiennent bien au module.
  const idsDemandes =
    Array.isArray(corps.questionIds) && corps.questionIds.every((v) => typeof v === "string")
      ? (corps.questionIds as string[])
      : null;

  const posees = idsDemandes ? banque.filter((q) => idsDemandes.includes(q.id)) : banque;

  if (posees.length === 0) {
    return NextResponse.json({ erreur: "Aucune question valide dans la soumission." }, { status: 400 });
  }
  // Questions réservées à l'évaluation (question 18, choix c) : le tirage,
  // fait dans le navigateur, doit respecter leur règle — aucune en
  // entraînement ni en Découverte, priorité en Habilitation et Complet.
  const modeTirage = corps.mode === "entrainement" ? "entrainement" : "evaluation";
  const difficulte: Difficulte =
    corps.difficulte === "decouverte" || corps.difficulte === "complet" ? corps.difficulte : "habilitation";
  const conformite = tirageConforme(posees, banque, modeTirage, difficulte);
  if (!conformite.ok) return NextResponse.json({ erreur: conformite.raison }, { status: 400 });

  const reponses = listeDeChaines(corps.reponses);
  const juges = listeDeChaines(corps.juges);
  const legendes = dictionnaireDeChaines(corps.legendes);
  const bareme = await lireBareme();

  const titresSituations = new Map<string, string>();
  for (const s of mod.misesEnSituation) {
    for (const q of s.questions) titresSituations.set(q.id, s.titre);
  }

  const detail: DetailQuestion[] = posees.map((q) => {
    const rep: ReponseApprenant = {
      choix: reponses[q.id] ?? [],
      juges: q.id in juges ? juges[q.id] : undefined,
      legendes: legendes[q.id] ?? {},
    };
    const { note, discordances, nonJugees, max } = noterQuestion(q, rep, bareme);
    const libelle = (ids: string[]) =>
      ids
        .map((id) => q.options.find((o) => o.id === id)?.texte)
        .filter((t): t is string => typeof t === "string");

    const base: DetailQuestion = {
      questionId: q.id,
      enonce: q.enonce,
      type: q.type,
      situation: titresSituations.get(q.id) ?? null,
      note,
      max,
      discordances,
      nonJugees,
      correct: discordances === 0,
      eliminatoire: q.eliminatoire === true,
      reservee: q.reservee === true,
      choixApprenant: libelle(rep.choix),
      reponsesAttendues: libelle(q.bonnesReponses),
      justification: q.justification,
      sources: (q.references ?? []).map(
        (r) => `${r.source} — ${r.libelle}${r.localisation ? ` (${r.localisation})` : ""}`,
      ),
    };

    if (q.type === "SCH") {
      const liste = q.legendes ?? [];
      const ordre = ordreLecture(liste);
      const detailLegendes: DetailLegende[] = ordre.map((i, k) => {
        const l = liste[i];
        const reponse = (rep.legendes ?? {})[l.id] ?? "";
        return {
          numero: k + 1,
          reponse,
          attendu: motAttendu(l.attendu),
          verdict: verdictLegende(reponse, l.attendu),
        };
      });
      base.legendes = detailLegendes;
      base.choixApprenant = detailLegendes.map((d) => `${d.numero} → ${d.reponse || "—"}`);
      base.reponsesAttendues = detailLegendes.map((d) => `${d.numero} → ${d.attendu}`);
    }
    return base;
  });

  const decision = decider(detail, mod.seuilReussite, { minQuestions: bareme.minQuestions, bande: bareme.bande });
  const maintenant = new Date();

  const sansJeton: Omit<ResultatEvaluation, "jeton"> = {
    moduleId: mod.id,
    moduleTitre: mod.titre,
    critereId: typeof mod.critereId === "string" && mod.critereId !== "[à préciser]" ? mod.critereId : null,
    seuilReussite: mod.seuilReussite,
    pointsObtenus: decision.pointsObtenus,
    pointsTotal: decision.pointsTotal,
    score: decision.score,
    echecEliminatoire: decision.echecEliminatoire,
    reussi: decision.verdictBrut === "acquis",
    verdict: decision.verdictBrut,
    bande: decision.bande,
    bandeBasse: decision.bandeBasse,
    bandeHaute: decision.bandeHaute,
    concluant: decision.concluant,
    minQuestions: decision.minQuestions,
    bareme,
    detail,
    horodatage: maintenant.toLocaleString("fr-FR", {
      timeZone: "Europe/Paris",
      dateStyle: "long",
      timeStyle: "short",
    }),
    horodatageIso: maintenant.toISOString(),
    tirage: typeof corps.tirage === "string" ? corps.tirage.slice(0, 80) : "",
    reservees: {
      posees: posees.filter((q) => q.reservee).length,
      disponibles: banque.filter((q) => q.reservee).length,
    },
  };

  const resultat: ResultatEvaluation = { ...sansJeton, jeton: sceller(sansJeton) };

  // Progression rattachée : l'évaluation complète est conservée avec son sceau.
  if (corps.mode === "evaluation") {
    const r = await rattachement();
    if (r) await enregistrerEvaluation(r.agentId, resultat).catch(() => undefined);
  }

  return NextResponse.json(resultat, {
    headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
  });
}
