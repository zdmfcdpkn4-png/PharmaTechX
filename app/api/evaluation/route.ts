import { NextResponse } from "next/server";
import { getModule } from "@/content/store";
import { banqueDuModule, noterQuestion } from "@/content/types";
import type { Question } from "@/content/types";

export const dynamic = "force-dynamic";

/**
 * Correction d'une évaluation.
 *
 * Ce que reçoit le serveur : un identifiant de module et, pour chaque question,
 * les identifiants des options cochées. Rien d'autre. Aucun nom, aucun
 * matricule, aucune adresse.
 *
 * Ce que fait le serveur : il corrige et renvoie le résultat.
 *
 * Ce que le serveur écrit : rien. Aucune base, aucun journal applicatif de
 * résultat, aucun cookie. Le résultat n'existe que dans la réponse HTTP, puis
 * dans le fichier que l'apprenant télécharge sur son poste.
 */

interface CorpsRequete {
  moduleId?: unknown;
  reponses?: unknown;
  questionIds?: unknown;
  /** QIM en Vrai/Faux : propositions effectivement jugées, par question. */
  juges?: unknown;
}

export interface DetailQuestion {
  questionId: string;
  enonce: string;
  type: Question["type"];
  situation: string | null;
  note: number;
  discordances: number;
  /** QIM : propositions laissées sans réponse, comptées comme discordances. */
  nonJugees: number;
  correct: boolean;
  eliminatoire: boolean;
  choixApprenant: string[];
  reponsesAttendues: string[];
  justification: string;
  sources: string[];
}

export interface ResultatEvaluation {
  moduleId: string;
  moduleTitre: string;
  seuilReussite: number;
  pointsObtenus: number;
  pointsTotal: number;
  score: number;
  echecEliminatoire: boolean;
  reussi: boolean;
  detail: DetailQuestion[];
  horodatage: string;
}

export async function POST(request: Request) {
  let corps: CorpsRequete;
  try {
    corps = await request.json();
  } catch {
    return NextResponse.json({ erreur: "Requête illisible." }, { status: 400 });
  }

  const moduleId = typeof corps.moduleId === "string" ? corps.moduleId : null;
  if (!moduleId) {
    return NextResponse.json(
      { erreur: "Identifiant de module manquant." },
      { status: 400 },
    );
  }

  const mod = getModule(moduleId);
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
    Array.isArray(corps.questionIds) &&
    corps.questionIds.every((v) => typeof v === "string")
      ? (corps.questionIds as string[])
      : null;

  const posees = idsDemandes
    ? banque.filter((q) => idsDemandes.includes(q.id))
    : banque;

  if (posees.length === 0) {
    return NextResponse.json(
      { erreur: "Aucune question valide dans la soumission." },
      { status: 400 },
    );
  }

  const listeDeChaines = (brut: unknown): Record<string, string[]> => {
    const out: Record<string, string[]> = {};
    if (brut && typeof brut === "object") {
      for (const [cle, val] of Object.entries(brut as Record<string, unknown>)) {
        if (Array.isArray(val)) {
          out[cle] = val.filter((v): v is string => typeof v === "string");
        }
      }
    }
    return out;
  };

  const reponses = listeDeChaines(corps.reponses);
  const juges = listeDeChaines(corps.juges);

  const titresSituations = new Map<string, string>();
  for (const s of mod.misesEnSituation) {
    for (const q of s.questions) titresSituations.set(q.id, s.titre);
  }

  const detail: DetailQuestion[] = posees.map((q) => {
    const choix = reponses[q.id] ?? [];
    const { note, discordances, nonJugees } = noterQuestion(
      q,
      choix,
      q.id in juges ? juges[q.id] : undefined,
    );
    const libelle = (ids: string[]) =>
      ids
        .map((id) => q.options.find((o) => o.id === id)?.texte)
        .filter((t): t is string => typeof t === "string");

    return {
      questionId: q.id,
      enonce: q.enonce,
      type: q.type,
      situation: titresSituations.get(q.id) ?? null,
      note,
      discordances,
      nonJugees,
      correct: discordances === 0,
      eliminatoire: q.eliminatoire === true,
      choixApprenant: libelle(choix),
      reponsesAttendues: libelle(q.bonnesReponses),
      justification: q.justification,
      sources: (q.references ?? []).map(
        (r) => `${r.source} — ${r.libelle}${r.localisation ? ` (${r.localisation})` : ""}`,
      ),
    };
  });

  const pointsTotal = posees.length;
  const pointsObtenus =
    Math.round(detail.reduce((s, d) => s + d.note, 0) * 100) / 100;
  const score =
    pointsTotal === 0 ? 0 : Math.round((pointsObtenus / pointsTotal) * 100);
  const echecEliminatoire = detail.some((d) => d.eliminatoire && !d.correct);

  const resultat: ResultatEvaluation = {
    moduleId: mod.id,
    moduleTitre: mod.titre,
    seuilReussite: mod.seuilReussite,
    pointsObtenus,
    pointsTotal,
    score,
    echecEliminatoire,
    reussi: score >= mod.seuilReussite && !echecEliminatoire,
    detail,
    horodatage: new Date().toLocaleString("fr-FR", {
      timeZone: "Europe/Paris",
      dateStyle: "long",
      timeStyle: "short",
    }),
  };

  return NextResponse.json(resultat, {
    headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
  });
}
