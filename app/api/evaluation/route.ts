import { NextResponse } from "next/server";
import { getModuleComplet } from "@/content/store";
import { ordreLecture, motAttendu, verdictLegende } from "@/content/schema";
import { RE_TROU, banqueDuModule, noterQuestion } from "@/content/types";
import type { NiveauQuestion, Question, ReponseApprenant } from "@/content/types";
import { sceller } from "@/lib/sceau";
import { decider, type Verdict } from "@/lib/decision";
import { lireBareme } from "@/lib/bareme-db";
import { lireNomsNiveaux } from "@/lib/niveaux-questions-db";
import { libellesClassiques, libellesDe } from "@/content/niveaux-questions";
import {
  admissibles,
  bilanTirage,
  niveauDe,
  tirageConforme,
  toujoursPosee,
  toujoursPoseesEcartees,
  type ContexteTirage,
  type Difficulte,
} from "@/content/tirage";
import { plafondDuNiveau } from "@/content/bareme";
import type { CibleScellee } from "@/content/cible";
import { questionsSignalees } from "@/content/banque-db";
import { baseConfiguree } from "@/lib/db";
import { LIBELLES_ROLE, confirmerCodeDeTutorat, getSession, refusApiSansSession } from "@/lib/auth";
import { journaliser } from "@/lib/journal";
import {
  estADecouvrir,
  jugementsDuTirage,
  lireJugements,
  nombreDeJugements,
  verdictDuJugement,
  type JugementScelle,
} from "@/content/jugement";
import { enregistrerEvaluation, rattachement, reserveesDejaVues } from "@/lib/progression";
import type { Bareme } from "@/content/bareme";
import { identifiantsConnus, listeFilieres, referentielDuModule } from "@/content/referentiel-db";
import { syntheseDuModule } from "@/lib/synthese";
import type { SyntheseDocument } from "@/content/types";

export const dynamic = "force-dynamic";

/**
 * Correction d'une évaluation.
 *
 * Ce que reçoit le serveur : un identifiant de module et, pour chaque question,
 * les identifiants des options cochées (QCM), jugées vraies et jugées (QIM),
 * le mot écrit par légende (schéma), le jugement porté sur chaque cache
 * (schéma à découvrir), le rang donné à chaque étape (séquence) ou la vignette
 * choisie par trou (texte à trous). Rien d'autre. Aucun nom, aucun matricule,
 * aucune adresse — et, pour un schéma à découvrir jugé en évaluation, le code
 * du tuteur qui confirme ses jugements, vérifié puis oublié (question 52).
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
  /** Séquences à ordonner : rang donné à chaque étape, par question. */
  rangs?: unknown;
  /** Textes à trous : vignette choisie par trou, par question. */
  trous?: unknown;
  /** Libellé du tirage, informatif (« Habilitation · 9 questions »). */
  tirage?: unknown;
  /** `evaluation` (tirage complet, conservé si l'apprenant est rattaché) ou `entrainement`. */
  mode?: unknown;
  /** Tirage choisi (`decouverte`, `habilitation`, `complet`) : la règle des questions réservées en dépend. */
  difficulte?: unknown;
  /** Schémas à découvrir : jugement porté sur chaque cache, par question. */
  jugements?: unknown;
  /** Évaluation : code du tuteur qui confirme les jugements. Vérifié, jamais conservé. */
  codeTuteur?: unknown;
  /** Niveau cible du tirage (questions 62 et 63) : un code de niveau connu, sinon aucun. */
  niveauCible?: unknown;
  /** Filière du profil de tirage (question 74) : une filière connue, sinon aucune. */
  filiere?: unknown;
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
  /** Obligatoire (question 63) : posée à chaque évaluation qui peut conclure. Absent des résultats antérieurs. */
  obligatoire?: boolean;
  /** Niveau de la question au moment de l'évaluation ; `null` : à préciser. Absent des résultats antérieurs. */
  niveauQuestion?: NiveauQuestion | null;
  choixApprenant: string[];
  reponsesAttendues: string[];
  /**
   * QCM et QIM : toutes les propositions présentées, pour l'analyse des
   * réponses (statistiques, question 78, 25/09/2026). Absent des résultats antérieurs.
   */
  propositions?: string[];
  /**
   * QIM en Vrai/Faux : propositions laissées sans jugement (« je ne sais
   * pas »), qu'on ne distinguait pas jusque-là d'une proposition jugée fausse.
   * Absent des résultats antérieurs.
   */
  sansJugement?: string[];
  justification: string;
  sources: string[];
  /** Schéma à compléter : le détail par légende. */
  legendes?: DetailLegende[];
  /** Schéma à découvrir : les verdicts des légendes sont des jugements, pas des mots écrits. */
  decouverte?: boolean;
}

/** Filières et niveaux du module, figés au moment de l'évaluation. */
export interface ReferentielScelle {
  filieres: { id: string; libelle: string }[];
  niveaux: { code: string; libelle: string; condition: string }[];
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
  /**
   * Référentiel du module au moment de l'évaluation (copié, scellé) : filières
   * et niveaux avec leurs libellés du moment. Depuis le 19/09/2026, ces listes
   * sont modifiables en base (question 38, choix b) ; un rapport renommé ou
   * retiré du référentiel se relit donc tel qu'il a été émis. Absent des
   * résultats antérieurs : un rapport ancien s'affiche sans cette mention.
   */
  referentiel?: ReferentielScelle;
  detail: DetailQuestion[];
  horodatage: string;
  horodatageIso: string;
  tirage: string;
  /**
   * Questions réservées à l'évaluation : posées dans ce tirage, disponibles dans la banque à cet instant (absent des
   * résultats antérieurs) et, parmi elles, déjà vues corrigées par l'agent rattaché (question 71, choix b ; absent à zéro).
   */
  reservees?: { posees: number; disponibles: number; dejaVues?: number };
  /**
   * Évaluation ou entraînement (depuis le 22/09/2026) : un résultat
   * d'entraînement ne s'émet pas en rapport (`refusEmissionEntrainement`).
   * Absent des résultats antérieurs.
   */
  mode?: "evaluation" | "entrainement";
  /**
   * Qui a jugé les caches des schémas à découvrir du tirage (question 52) :
   * le code de tutorat ou d'administration qui l'a confirmé, ou
   * l'auto-évaluation en entraînement. Absent sans cache jugé.
   */
  jugement?: JugementScelle;
  /**
   * Fiches de synthèse montrées en fin de test (question 59, choix a,
   * 23/09/2026) : les fiches validées du module à l'instant de la correction,
   * avec leur validation — scellées ici, citées par le rapport. Absent des
   * résultats antérieurs.
   */
  fiches?: SyntheseDocument[];
  /**
   * Tirage selon le niveau cible (questions 62 et 63, 23/09/2026) : niveau
   * visé, plafond, questions posées par niveau, questions toujours posées
   * qu'un signalement a écartées. Évaluation seulement ; absent des
   * résultats antérieurs.
   */
  cible?: CibleScellee;
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

function dictionnaireDeNombres(brut: unknown): Record<string, Record<string, number>> {
  const out: Record<string, Record<string, number>> = {};
  if (brut && typeof brut === "object") {
    for (const [cle, val] of Object.entries(brut as Record<string, unknown>)) {
      if (val && typeof val === "object") {
        const d: Record<string, number> = {};
        for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
          if (typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 50) d[k] = v;
        }
        out[cle] = d;
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

  // Questions réservées à l'évaluation (question 18, choix c) : le tirage,
  // fait dans le navigateur, doit respecter leur règle — aucune en
  // entraînement ni en Découverte, priorité en Habilitation et Complet.
  const modeTirage = corps.mode === "entrainement" ? "entrainement" : "evaluation";
  const difficulte: Difficulte =
    corps.difficulte === "decouverte" || corps.difficulte === "complet" ? corps.difficulte : "habilitation";
  // Tirage selon le niveau cible (questions 62 et 63) : même règle qu'au
  // navigateur — plafond et répartition du barème, questions signalées
  // écartées, éliminatoires et obligatoires posées. Un niveau cible inconnu
  // vaut « non précisé » : aucun plafond.
  const bareme = await lireBareme();
  // Noms des niveaux de question en vigueur (question 81) : message de
  // conformité, et copie dans le résultat scellé s'ils ne sont plus ceux d'origine.
  const libellesNiveaux = libellesDe(await lireNomsNiveaux());
  const niveauDemande = typeof corps.niveauCible === "string" ? corps.niveauCible.slice(0, 12) : "";
  const filiereDemandee = typeof corps.filiere === "string" ? corps.filiere.slice(0, 40) : "";
  const connus = niveauDemande || filiereDemandee ? await identifiantsConnus() : { niveaux: [], filieres: [] };
  const niveauCible = connus.niveaux.find((c) => c.toUpperCase() === niveauDemande.toUpperCase()) ?? null;
  // Profil de tirage (question 74) : une filière inconnue vaut « non précisée », comme un niveau inconnu.
  const filiereCible = connus.filieres.find((f) => f !== "socle" && f === filiereDemandee) ?? null;
  const signalements = baseConfiguree()
    ? await questionsSignalees(banque.map((q) => q.id)).catch(() => ({ ouvertes: [] as string[], tolerees: [] as string[] }))
    : { ouvertes: [] as string[], tolerees: [] as string[] };
  const plafond = plafondDuNiveau(bareme, niveauCible);
  // Réservées déjà vues corrigées par l'agent rattaché (question 71, choix b) :
  // le tirage les pose en dernier, le contrôle ne les exige pas.
  const ratt = modeTirage === "evaluation" ? await rattachement() : null;
  const dejaVues = ratt ? await reserveesDejaVues(ratt.agentId, banque).catch(() => [] as string[]) : [];
  const contexte: ContexteTirage = {
    mode: modeTirage,
    difficulte,
    nb: difficulte === "complet" ? null : bareme.tirages[difficulte],
    plafond,
    repartition: bareme.repartitions[plafond],
    // Signalements ouverts, et clos depuis moins de sept jours : une clôture
    // survenue pendant l'épreuve ne fait pas refuser le tirage.
    signalees: signalements.tolerees,
    dejaVues,
    profil: { filiere: filiereCible, niveau: niveauCible },
  };

  // Le tirage est décidé côté client ; le serveur ne corrige que les questions
  // effectivement posées, en vérifiant qu'elles appartiennent bien au module.
  // Sans liste, toute la banque admise au tirage : plafond et signalements
  // ouverts — la tolérance aux signalements clos ne vaut que pour le contrôle.
  const idsDemandes =
    Array.isArray(corps.questionIds) && corps.questionIds.every((v) => typeof v === "string")
      ? (corps.questionIds as string[])
      : null;
  const posees = idsDemandes
    ? banque.filter((q) => idsDemandes.includes(q.id))
    : admissibles(banque, { ...contexte, signalees: signalements.ouvertes });
  if (posees.length === 0) {
    return NextResponse.json({ erreur: "Aucune question valide dans la soumission." }, { status: 400 });
  }
  const conformite = tirageConforme(posees, banque, contexte, libellesNiveaux);
  if (!conformite.ok) return NextResponse.json({ erreur: conformite.raison }, { status: 400 });

  // Schémas à découvrir (question 52, choix b) : les jugements portés sur les
  // caches ne valent en évaluation que confirmés par le code d'un tuteur ou
  // de l'administration, tapé à la validation. Sans cache jugé, rien n'est à
  // confirmer : les caches comptent comme des légendes vides.
  const maintenant = new Date();
  const jugementsRetenus = jugementsDuTirage(lireJugements(corps.jugements), posees);
  const nbJuges = nombreDeJugements(jugementsRetenus);
  let jugement: JugementScelle | undefined;
  if (nbJuges > 0 && modeTirage === "entrainement") {
    jugement = { par: "auto-évaluation", role: "apprenant", le: maintenant.toISOString() };
  } else if (nbJuges > 0) {
    const session = await getSession();
    const c = await confirmerCodeDeTutorat(session, typeof corps.codeTuteur === "string" ? corps.codeTuteur.slice(0, 40) : "");
    if (!c.ok) {
      const erreur =
        c.raison === "bloque"
          ? `Trop de codes refusés : réessayez dans ${c.minutes ?? 15} minute${(c.minutes ?? 15) > 1 ? "s" : ""}. Les réponses sont conservées à l'écran.`
          : c.raison === "meme-code"
            ? "Ce code est celui qui a ouvert la session : il ne peut pas juger sa propre évaluation. Le tuteur tape le sien."
            : c.raison === "indisponible"
              ? "Aucun code de tutorat n'est vérifiable sur ce site : les caches ne peuvent être jugés qu'en entraînement."
              : "Code du tuteur refusé. Les réponses et les jugements sont conservés à l'écran : le tuteur retape son code.";
      return NextResponse.json(
        { erreur, code: "jugement" },
        { status: c.raison === "bloque" ? 429 : 403, headers: { "Cache-Control": "no-store" } },
      );
    }
    jugement = { par: `${LIBELLES_ROLE[c.role]} · ${c.libelle}`, role: c.role, le: maintenant.toISOString() };
    // Mode test (23/09/2026) : le code est vérifié comme d'ordinaire, limiteur
    // compris, mais le jugement d'un test n'entre pas au journal.
    if (!session?.essai) {
      await journaliser({ role: c.role, libelle: c.libelle }, "evaluation:jugement-tuteur", `module:${mod.id}`, {
        caches: nbJuges,
        questions: Object.keys(jugementsRetenus).length,
        session: session ? `${session.role} · ${session.libelle}` : "sans code",
      });
    }
  }

  const reponses = listeDeChaines(corps.reponses);
  const juges = listeDeChaines(corps.juges);
  const legendes = dictionnaireDeChaines(corps.legendes);
  const rangs = dictionnaireDeNombres(corps.rangs);
  const trous = dictionnaireDeChaines(corps.trous);

  const titresSituations = new Map<string, string>();
  for (const s of mod.misesEnSituation) {
    for (const q of s.questions) titresSituations.set(q.id, s.titre);
  }

  const detail: DetailQuestion[] = posees.map((q) => {
    const rep: ReponseApprenant = {
      choix: reponses[q.id] ?? [],
      juges: q.id in juges ? juges[q.id] : undefined,
      legendes: legendes[q.id] ?? {},
      rangs: rangs[q.id] ?? {},
      trous: trous[q.id] ?? {},
      jugements: jugementsRetenus[q.id] ?? {},
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
      obligatoire: q.obligatoire === true,
      niveauQuestion: q.niveauQuestion ?? null,
      choixApprenant: libelle(rep.choix),
      reponsesAttendues: libelle(q.bonnesReponses),
      justification: q.justification,
      sources: (q.references ?? []).map(
        (r) => `${r.source} — ${r.libelle}${r.localisation ? ` (${r.localisation})` : ""}`,
      ),
    };

    if (q.type === "QCM" || q.type === "QIM") {
      base.propositions = q.options.map((o) => o.texte);
      const jugees = rep.juges;
      if (q.type === "QIM" && jugees) base.sansJugement = libelle(q.options.filter((o) => !jugees.includes(o.id)).map((o) => o.id));
    }

    if (q.type === "ORD") {
      // L'ordre juste est celui de `bonnesReponses` ; la réponse de
      // l'apprenant se relit rang par rang, « — » pour une étape sans rang.
      const texteDe = (id: string) => q.options.find((o) => o.id === id)?.texte ?? id;
      const donne = rep.rangs ?? {};
      base.reponsesAttendues = q.bonnesReponses.map((id, i) => `${i + 1}. ${texteDe(id)}`);
      base.choixApprenant = q.bonnesReponses
        .map((id) => ({ rang: donne[id] ?? 0, texte: texteDe(id) }))
        .sort((a, b) => (a.rang || 99) - (b.rang || 99))
        .map((e) => `${e.rang ? `${e.rang}.` : "—"} ${e.texte}`);
    }

    if (q.type === "TAT") {
      const texteDe = (id: string) => q.options.find((o) => o.id === id)?.texte ?? "";
      const donne = rep.trous ?? {};
      base.enonce = q.enonce.replace(RE_TROU, (_m, n) => `[${n}]`);
      base.reponsesAttendues = q.bonnesReponses.map((id, i) => `${i + 1} → ${texteDe(id)}`);
      base.choixApprenant = q.bonnesReponses.map(
        (_id, i) => `${i + 1} → ${texteDe(donne[String(i + 1)] ?? "") || "—"}`,
      );
    }

    if (q.type === "SCH") {
      const liste = q.legendes ?? [];
      const ordre = ordreLecture(liste);
      // Schéma à découvrir : rien n'est écrit, le verdict est le jugement porté sur le cache.
      const decouverte = estADecouvrir(q);
      const detailLegendes: DetailLegende[] = ordre.map((i, k) => {
        const l = liste[i];
        const reponse = decouverte ? "" : ((rep.legendes ?? {})[l.id] ?? "");
        return {
          numero: k + 1,
          reponse,
          attendu: motAttendu(l.attendu),
          verdict: decouverte ? verdictDuJugement(rep.jugements?.[l.id]) : verdictLegende(reponse, l.attendu),
        };
      });
      base.legendes = detailLegendes;
      base.choixApprenant = decouverte
        ? detailLegendes.map((d) => `${d.numero} → ${d.verdict === "juste" ? "jugé juste" : d.verdict === "fausse" ? "jugé faux" : "non jugé"}`)
        : detailLegendes.map((d) => `${d.numero} → ${d.reponse || "—"}`);
      base.reponsesAttendues = detailLegendes.map((d) => `${d.numero} → ${d.attendu}`);
      if (decouverte) base.decouverte = true;
    }
    return base;
  });

  const decision = decider(detail, mod.seuilReussite, { minQuestions: bareme.minQuestions, bande: bareme.bande });

  // Ce que le tirage a visé et posé (questions 62 et 63), scellé avec le
  // résultat et cité par le rapport. Une question toujours posée qu'un
  // signalement a écartée est dite remplacée tant que la banque admise
  // offrait une autre question de son niveau.
  let cible: CibleScellee | undefined;
  if (modeTirage === "evaluation") {
    const ids = new Set(posees.map((q) => q.id));
    const parNiveau: CibleScellee["parNiveau"] = { initial: 0, intermediaire: 0, avance: 0, a_preciser: 0 };
    for (const q of posees) parNiveau[niveauDe(q) ?? "a_preciser"] += 1;
    const libres = new Map<NiveauQuestion | null, number>();
    for (const q of admissibles(banque, contexte)) {
      if (!toujoursPosee(q, contexte)) libres.set(niveauDe(q), (libres.get(niveauDe(q)) ?? 0) + 1);
    }
    const horsProfil = bilanTirage(banque, contexte).horsProfil;
    cible = {
      niveau: niveauCible,
      plafond,
      parNiveau,
      obligatoires: posees.filter((q) => q.obligatoire && !q.eliminatoire).length,
      ecartees: toujoursPoseesEcartees(banque, contexte)
        .filter((q) => !ids.has(q.id))
        .map((q) => {
          const reste = libres.get(niveauDe(q)) ?? 0;
          if (reste > 0) libres.set(niveauDe(q), reste - 1);
          return { questionId: q.id, enonce: q.enonce, eliminatoire: q.eliminatoire === true, remplacee: reste > 0 };
        }),
      ...(horsProfil > 0
        ? {
            horsProfil,
            filiere: filiereCible
              ? ((await listeFilieres().catch(() => [])).find((f) => f.id === filiereCible)?.libelle ?? filiereCible)
              : null,
          }
        : {}),
      ...(libellesClassiques(libellesNiveaux) ? {} : { noms: libellesNiveaux }),
    };
  }

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
    referentiel: await referentielDuModule(mod),
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
      ...(dejaVues.length > 0 ? { dejaVues: dejaVues.length } : {}),
    },
    mode: modeTirage,
    ...(jugement ? { jugement } : {}),
    fiches: await syntheseDuModule(mod).catch(() => []),
    ...(cible ? { cible } : {}),
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
