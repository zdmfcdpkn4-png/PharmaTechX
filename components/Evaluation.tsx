"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { QuestionPublique } from "@/content/types";
import { libelleBareme, libelleFormat } from "@/content/types";
import { MOTIFS_SIGNALEMENT } from "@/content/signalements";
import type { DetailQuestion, ResultatEvaluation } from "@/app/api/evaluation/route";
import { useSessionFormation } from "./SessionFormation";
import { SchemaQuestion } from "./SchemaQuestion";

/**
 * Moteur d'évaluation.
 *
 * Le navigateur ne détient jamais les bonnes réponses : les questions arrivent
 * expurgées et la correction est faite par la route API à la soumission. Le
 * tirage est fait ici, pour que la difficulté soit réglable sans aller-retour.
 *
 * Deux modes, choisis au réglage :
 *  - **évaluation** : toutes les questions, correction à la fin, résultat
 *    enregistré dans la session (c'est lui qui alimente le rapport) ;
 *  - **entraînement** : une question à la fois, correction immédiate après
 *    chaque réponse, rien n'est enregistré ni comptabilisé. C'est le retour
 *    immédiat des outils d'e-learning, sans gamification : une justification
 *    sourcée, pas une récompense.
 *
 * Les QIM sont posées en Vrai/Faux proposition par proposition ; chaque
 * proposition non jugée compte comme une discordance, et c'est annoncé. Le
 * mode cases à cocher reste disponible via `qimEnVraiFaux={false}`.
 *
 * Les schémas à compléter (repris du Lecteur QIM · QCM) affichent l'image avec
 * ses repères numérotés et un champ par légende.
 */

type Difficulte = "decouverte" | "habilitation" | "complet";
type Mode = "evaluation" | "entrainement";

const DIFFICULTES: Record<Difficulte, { libelle: string; description: string; nb: number | null }> = {
  decouverte: {
    libelle: "Découverte",
    description: "Tirage court, pour se situer avant de reprendre le module.",
    nb: 5,
  },
  habilitation: {
    libelle: "Habilitation",
    description: "Tirage de référence, toutes les questions éliminatoires incluses.",
    nb: 10,
  },
  complet: {
    libelle: "Complet",
    description: "La totalité de la banque du critère.",
    nb: null,
  },
};

/** QCM à réponse unique : l'énoncé ne mentionne pas « plusieurs ». */
function estUneSeule(q: QuestionPublique): boolean {
  return q.type === "QCM" && !q.enonce.includes("plusieurs");
}

function melanger<T>(xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Tirage. Les questions éliminatoires sont toujours retenues — laisser au
 * hasard le soin de poser ou non la question de sécurité n'aurait pas de sens.
 * Les mises en situation sont tirées par vignette entière.
 */
function tirer(banque: QuestionPublique[], nb: number | null): QuestionPublique[] {
  if (nb === null || nb >= banque.length) return banque;

  const eliminatoires = banque.filter((q) => q.eliminatoire);
  const reste = melanger(banque.filter((q) => !q.eliminatoire));
  const choisies = [...eliminatoires];
  for (const q of reste) {
    if (choisies.length >= nb) break;
    choisies.push(q);
  }

  const situations = new Map<string, QuestionPublique[]>();
  const isolees: QuestionPublique[] = [];
  for (const q of banque) {
    if (!choisies.includes(q)) continue;
    if (q.situation) {
      const liste = situations.get(q.situation.id) ?? [];
      liste.push(q);
      situations.set(q.situation.id, liste);
    } else {
      isolees.push(q);
    }
  }
  return [...isolees, ...[...situations.values()].flat()];
}

type EtatQim = Record<string, Record<string, boolean>>;
type EtatLegendes = Record<string, Record<string, string>>;

function nombre(n: number): string {
  return String(Math.round(n * 100) / 100).replace(".", ",");
}

function etatLisible(d: DetailQuestion): string {
  if (d.correct) return d.type === "SCH" ? "Toutes les légendes justes" : "Réponse exacte";
  if (d.type === "QIM") {
    return `${d.discordances} discordance${d.discordances > 1 ? "s" : ""}${d.nonJugees > 0 ? ` — dont ${d.nonJugees} proposition${d.nonJugees > 1 ? "s" : ""} sans réponse` : ""}`;
  }
  if (d.type === "SCH") {
    const fausses = d.discordances - d.nonJugees;
    return `${fausses} légende${fausses > 1 ? "s" : ""} fausse${fausses > 1 ? "s" : ""}${d.nonJugees > 0 ? `, ${d.nonJugees} sans réponse` : ""}`;
  }
  return "Réponse erronée";
}

function classeCorrection(d: DetailQuestion): string {
  if (d.correct) return "correction--exacte";
  if (d.note > 0) return "correction--partielle";
  return "correction--erronee";
}

/** Signalement d'une question — motif fermé, note libre, rien de nominatif. */
function Signaler({ questionId, moduleId }: { questionId: string; moduleId: string }) {
  const [motif, setMotif] = useState<string>(MOTIFS_SIGNALEMENT[0]);
  const [note, setNote] = useState("");
  const [etat, setEtat] = useState<"repos" | "envoi" | "fait" | "erreur">("repos");

  if (etat === "fait") {
    return <p className="legende">Signalement transmis au tutorat. Merci.</p>;
  }
  return (
    <details className="signaler">
      <summary>Signaler un problème sur cette question</summary>
      <div className="signaler-corps">
        <label className="champ">
          <span>Motif</span>
          <select value={motif} onChange={(e) => setMotif(e.target.value)}>
            {MOTIFS_SIGNALEMENT.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </label>
        <label className="champ">
          <span>Précision (facultative, ne mentionnez personne)</span>
          <textarea rows={3} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        {etat === "erreur" && <p className="encart encart--attention">Le signalement n&apos;a pas pu être transmis.</p>}
        <div className="actions">
          <button
            type="button"
            className="bouton bouton--compact"
            disabled={etat === "envoi"}
            onClick={async () => {
              setEtat("envoi");
              try {
                const r = await fetch("/api/signalement", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ questionId, moduleId, motif, note }),
                });
                setEtat(r.ok ? "fait" : "erreur");
              } catch {
                setEtat("erreur");
              }
            }}
          >
            {etat === "envoi" ? "Envoi…" : "Transmettre"}
          </button>
        </div>
      </div>
    </details>
  );
}

export function Evaluation({
  moduleId,
  moduleTitre,
  banque,
  seuil,
  qimEnVraiFaux = true,
  signalementPossible = false,
}: {
  moduleId: string;
  moduleTitre: string;
  banque: QuestionPublique[];
  seuil: number;
  qimEnVraiFaux?: boolean;
  signalementPossible?: boolean;
}) {
  const [difficulte, setDifficulte] = useState<Difficulte>("habilitation");
  const [mode, setMode] = useState<Mode>("evaluation");
  const [demarre, setDemarre] = useState(false);
  const [graine, setGraine] = useState(0);
  const [reponses, setReponses] = useState<Record<string, string[]>>({});
  const [qim, setQim] = useState<EtatQim>({});
  const [legendes, setLegendes] = useState<EtatLegendes>({});
  const [resultat, setResultat] = useState<ResultatEvaluation | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  // Entraînement : une question à la fois, correction immédiate.
  const [indexCourant, setIndexCourant] = useState(0);
  const [corrections, setCorrections] = useState<Record<string, DetailQuestion>>({});
  const [entrainementFini, setEntrainementFini] = useState(false);
  const { enregistrer } = useSessionFormation();

  const posees = useMemo(
    () => tirer(banque, DIFFICULTES[difficulte].nb),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [banque, difficulte, graine],
  );

  const libelleTirage = `${DIFFICULTES[difficulte].libelle} · ${posees.length} question${posees.length > 1 ? "s" : ""}${mode === "entrainement" ? " · entraînement" : ""}`;

  const basculer = (q: QuestionPublique, optionId: string) => {
    setReponses((prec) => {
      const actuel = prec[q.id] ?? [];
      if (estUneSeule(q)) return { ...prec, [q.id]: [optionId] };
      return {
        ...prec,
        [q.id]: actuel.includes(optionId) ? actuel.filter((x) => x !== optionId) : [...actuel, optionId],
      };
    });
  };

  const jugerQim = (qid: string, optId: string, vrai: boolean) => {
    setQim((prec) => ({ ...prec, [qid]: { ...(prec[qid] ?? {}), [optId]: vrai } }));
  };

  const ecrireLegende = (qid: string, lid: string, valeur: string) => {
    setLegendes((prec) => ({ ...prec, [qid]: { ...(prec[qid] ?? {}), [lid]: valeur } }));
  };

  /** Une question est « renseignée » dès qu'elle a reçu au moins une réponse. */
  const estRenseignee = (q: QuestionPublique): boolean => {
    if (q.type === "SCH") return Object.values(legendes[q.id] ?? {}).some((v) => v.trim() !== "");
    if (q.type === "QIM" && qimEnVraiFaux) return Object.keys(qim[q.id] ?? {}).length > 0;
    return (reponses[q.id] ?? []).length > 0;
  };

  const chargeUtile = (questions: QuestionPublique[]) => {
    const rep: Record<string, string[]> = {};
    const juges: Record<string, string[]> = {};
    const legs: EtatLegendes = {};
    for (const q of questions) {
      if (q.type === "SCH") {
        legs[q.id] = legendes[q.id] ?? {};
      } else if (q.type === "QIM" && qimEnVraiFaux) {
        const verdicts = qim[q.id] ?? {};
        juges[q.id] = Object.keys(verdicts);
        rep[q.id] = Object.entries(verdicts).filter(([, v]) => v).map(([k]) => k);
      } else {
        rep[q.id] = reponses[q.id] ?? [];
      }
    }
    return {
      moduleId,
      questionIds: questions.map((q) => q.id),
      reponses: rep,
      juges,
      legendes: legs,
      tirage: libelleTirage,
    };
  };

  const corriger = async (questions: QuestionPublique[]): Promise<ResultatEvaluation> => {
    const reponse = await fetch("/api/evaluation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(chargeUtile(questions)),
    });
    if (!reponse.ok) {
      const j = await reponse.json().catch(() => ({}));
      throw new Error(j.erreur ?? "La correction a échoué.");
    }
    return (await reponse.json()) as ResultatEvaluation;
  };

  const soumettre = async () => {
    setEnvoi(true);
    setErreur(null);
    try {
      const r = await corriger(posees);
      setResultat(r);
      enregistrer(r);
      const doux = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      window.scrollTo({ top: 0, behavior: doux ? "smooth" : "auto" });
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Erreur inconnue.");
    } finally {
      setEnvoi(false);
    }
  };

  const verifierCourante = async () => {
    const q = posees[indexCourant];
    if (!q) return;
    setEnvoi(true);
    setErreur(null);
    try {
      const r = await corriger([q]);
      const d = r.detail[0];
      if (d) setCorrections((prec) => ({ ...prec, [q.id]: d }));
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Erreur inconnue.");
    } finally {
      setEnvoi(false);
    }
  };

  const recommencer = () => {
    setResultat(null);
    setReponses({});
    setQim({});
    setLegendes({});
    setCorrections({});
    setIndexCourant(0);
    setEntrainementFini(false);
    setGraine((g) => g + 1);
    setDemarre(false);
  };

  // ───────────────────────────────────────────────────── réglage du tirage
  if (!demarre && !resultat) {
    return (
      <section className="carte">
        <h2>Régler l&apos;évaluation</h2>
        <p>
          Les questions sont tirées au sort dans la banque du critère ({banque.length} disponibles).
          Les questions éliminatoires sont toujours posées, et les mises en situation sont tirées avec
          leur vignette entière.
        </p>
        <p className="encart">
          Seuil de réussite <strong>{seuil}&nbsp;%</strong>. Une erreur sur une question éliminatoire
          rend le critère non acquis, quel que soit le score.
        </p>
        <fieldset className="choix-difficulte">
          <legend className="champ-titre">Tirage</legend>
          {(Object.keys(DIFFICULTES) as Difficulte[]).map((d) => {
            const vise = DIFFICULTES[d].nb;
            const reel = vise === null ? banque.length : Math.min(vise, banque.length);
            return (
              <label key={d} className={`option${difficulte === d ? " est-choisie" : ""}`}>
                <input
                  type="radio"
                  name="difficulte"
                  checked={difficulte === d}
                  onChange={() => setDifficulte(d)}
                />
                <span>
                  <strong>{DIFFICULTES[d].libelle}</strong> — {reel} question{reel > 1 ? "s" : ""}
                  <br />
                  <span className="legende">
                    {DIFFICULTES[d].description}
                    {vise !== null && vise > banque.length
                      ? " La banque du critère en compte moins : toutes sont posées."
                      : ""}
                  </span>
                </span>
              </label>
            );
          })}
        </fieldset>
        <fieldset className="choix-difficulte">
          <legend className="champ-titre">Mode</legend>
          <label className={`option${mode === "evaluation" ? " est-choisie" : ""}`}>
            <input type="radio" name="mode" checked={mode === "evaluation"} onChange={() => setMode("evaluation")} />
            <span>
              <strong>Évaluation</strong> — correction à la fin
              <br />
              <span className="legende">Le résultat entre dans la session et peut être porté au rapport (étape 2 sur 6).</span>
            </span>
          </label>
          <label className={`option${mode === "entrainement" ? " est-choisie" : ""}`}>
            <input type="radio" name="mode" checked={mode === "entrainement"} onChange={() => setMode("entrainement")} />
            <span>
              <strong>Entraînement</strong> — correction immédiate, question par question
              <br />
              <span className="legende">Rien n&apos;est enregistré ni comptabilisé : la justification et la source s&apos;affichent après chaque réponse.</span>
            </span>
          </label>
        </fieldset>
        <div className="actions">
          <button type="button" className="bouton" onClick={() => setDemarre(true)}>
            Commencer
          </button>
          <Link href={`/module/${moduleId}`} className="bouton bouton--secondaire">
            Revoir le module
          </Link>
        </div>
      </section>
    );
  }

  // ──────────────────────────────────────────────────── blocs partagés
  const rendreCorrection = (d: DetailQuestion, i: number, q: QuestionPublique | undefined) => (
    <div key={d.questionId} className={`correction ${classeCorrection(d)}`}>
      <div className="etape-tete">
        <strong>Question {i + 1}</strong>
        <span className="etiquette etiquette--neutre">{etatLisible(d)}</span>
        {d.eliminatoire && <span className="etiquette etiquette--obligatoire">Éliminatoire</span>}
        <span style={{ marginLeft: "auto", fontWeight: 650 }}>{nombre(d.note)} pt</span>
      </div>
      <p>
        <strong>{d.enonce}</strong>
      </p>
      {d.type === "SCH" && q && d.legendes ? (
        <SchemaQuestion question={q} valeurs={{}} verrouille revelation={d.legendes} />
      ) : (
        <p className="legende">
          Votre réponse&nbsp;: {d.choixApprenant.length > 0 ? d.choixApprenant.join(" · ") : "aucune"}
          <br />
          Attendu&nbsp;: {d.reponsesAttendues.join(" · ")}
        </p>
      )}
      {d.justification && <p style={{ maxWidth: "66ch" }}>{d.justification}</p>}
      {d.sources.length > 0 && (
        <p className="source">Source&nbsp;: {d.sources.join(" ; ")}</p>
      )}
      {signalementPossible && <Signaler questionId={d.questionId} moduleId={moduleId} />}
    </div>
  );

  const rendreVignette = (q: QuestionPublique, nbQuestions: number) =>
    q.situation ? (
      <section className="vignette">
        <p className="sur-titre">Mise en situation — lisez posément</p>
        <h3>{q.situation.titre}</h3>
        {q.situation.contexte.split(/\n{2,}/).map((p, j) => (
          <p key={j}>{p}</p>
        ))}
        <p className="legende" style={{ marginBottom: 0 }}>
          {nbQuestions > 1 ? `${nbQuestions} questions portent` : "Une question porte"} sur cette situation.
        </p>
      </section>
    ) : null;

  const rendreQuestion = (q: QuestionPublique, i: number, total: number, verrouille: boolean) => {
    const enVraiFaux = q.type === "QIM" && qimEnVraiFaux;
    return (
      <fieldset className="question" disabled={verrouille}>
        <legend>
          <span className="legende">
            Question {i + 1} / {total}
          </span>
        </legend>

        <div className="etape-tete">
          <span className="etiquette etiquette--site">{libelleFormat(q)}</span>
          {q.eliminatoire && <span className="etiquette etiquette--obligatoire">Éliminatoire</span>}
        </div>

        <p className="question-enonce">{q.enonce}</p>
        <p className="question-bareme">{libelleBareme(q)}</p>

        {q.type === "SCH" ? (
          <SchemaQuestion
            question={q}
            valeurs={legendes[q.id] ?? {}}
            onChange={(lid, v) => ecrireLegende(q.id, lid, v)}
            verrouille={verrouille}
          />
        ) : enVraiFaux ? (
          <>
            <p className="question-avertissement">
              Chaque proposition se juge séparément — une proposition laissée sans réponse compte
              comme une discordance.
            </p>
            {q.options.map((o) => {
              const v = qim[q.id]?.[o.id];
              return (
                <div key={o.id} className="proposition">
                  <span className="libelle">{o.texte}</span>
                  <span className="jugement">
                    <label>
                      <input
                        type="radio"
                        name={`${q.id}-${o.id}`}
                        checked={v === true}
                        onChange={() => jugerQim(q.id, o.id, true)}
                      />
                      <span>Vrai</span>
                    </label>
                    <label>
                      <input
                        type="radio"
                        name={`${q.id}-${o.id}`}
                        checked={v === false}
                        onChange={() => jugerQim(q.id, o.id, false)}
                      />
                      <span>Faux</span>
                    </label>
                  </span>
                </div>
              );
            })}
          </>
        ) : (
          q.options.map((o) => (
            <label key={o.id} className="option">
              <input
                type={estUneSeule(q) ? "radio" : "checkbox"}
                name={q.id}
                checked={(reponses[q.id] ?? []).includes(o.id)}
                onChange={() => basculer(q, o.id)}
              />
              <span>{o.texte}</span>
            </label>
          ))
        )}
      </fieldset>
    );
  };

  // ────────────────────────────────────────────────────────────── correction
  if (resultat) {
    return (
      <>
        <div
          className={`resultat-entete ${resultat.reussi ? "resultat-entete--acquis" : "resultat-entete--refuse"}`}
          role="status"
        >
          <span className="score">{resultat.score}&nbsp;%</span>
          <div>
            <h2 style={{ margin: 0 }}>
              {resultat.reussi ? "Critère acquis pour cette évaluation" : "Critère non acquis"}
            </h2>
            <p style={{ margin: ".25rem 0 0" }}>
              {nombre(resultat.pointsObtenus)} / {resultat.pointsTotal} points — seuil de réussite {seuil}&nbsp;%
              — {resultat.tirage}
            </p>
          </div>
        </div>

        {resultat.echecEliminatoire && (
          <p className="encart encart--attention">
            <strong>Échec sur une question éliminatoire :</strong> le critère est non acquis quel que
            soit le score.
          </p>
        )}

        {resultat.detail.map((d, i) => rendreCorrection(d, i, posees.find((q) => q.id === d.questionId)))}

        <p className="encart">
          <strong>Ce résultat ne vaut pas habilitation.</strong> Il constitue la preuve de
          l&apos;étape 2 sur 6 : exportez le rapport depuis l&apos;accueil et remettez-le pour votre
          dossier. Le compagnonnage et l&apos;évaluation pratique au poste restent à faire.
        </p>

        <div className="actions">
          <button type="button" className="bouton" onClick={recommencer}>
            Nouveau tirage
          </button>
          <Link href="/#rapport" className="bouton bouton--secondaire">
            Rapport de session
          </Link>
          <Link href={`/module/${moduleId}`} className="bouton bouton--secondaire">
            Revoir le module
          </Link>
        </div>
      </>
    );
  }

  // ───────────────────────────────────────────── entraînement, une à la fois
  if (mode === "entrainement") {
    if (entrainementFini || posees.length === 0) {
      const justes = posees.filter((q) => corrections[q.id]?.correct).length;
      const points = posees.reduce((s, q) => s + (corrections[q.id]?.note ?? 0), 0);
      return (
        <>
          <div className="resultat-entete" role="status">
            <span className="score">{justes} / {posees.length}</span>
            <div>
              <h2 style={{ margin: 0 }}>Entraînement terminé</h2>
              <p style={{ margin: ".25rem 0 0" }}>
                {nombre(points)} point{points > 1 ? "s" : ""} sur {posees.length} — non enregistré, non comptabilisé.
                Pour produire une preuve, relancez en mode évaluation.
              </p>
            </div>
          </div>
          {posees.map((q, i) => corrections[q.id] && rendreCorrection(corrections[q.id], i, q))}
          <div className="actions">
            <button type="button" className="bouton" onClick={recommencer}>
              Nouveau tirage
            </button>
            <Link href={`/module/${moduleId}`} className="bouton bouton--secondaire">
              Revoir le module
            </Link>
          </div>
        </>
      );
    }
    const q = posees[indexCourant];
    const correction = corrections[q.id];
    const nbSituation = q.situation ? posees.filter((x) => x.situation?.id === q.situation!.id).length : 0;
    return (
      <div style={{ paddingBottom: "120px" }}>
        {rendreVignette(q, nbSituation)}
        {rendreQuestion(q, indexCourant, posees.length, Boolean(correction))}
        {erreur && <p className="encart encart--attention">{erreur}</p>}
        {correction && rendreCorrection(correction, indexCourant, q)}
        <div className="barre-passation">
          <div className="barre-passation-interne">
            <div style={{ flex: "1 1 14rem", minWidth: 0 }}>
              <p className="legende" style={{ margin: "0 0 .25rem" }}>
                Question {indexCourant + 1} / {posees.length} — {moduleTitre} — entraînement
              </p>
              <div
                className="avancement"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={posees.length}
                aria-valuenow={indexCourant + (correction ? 1 : 0)}
                aria-label="Questions corrigées"
              >
                <span style={{ width: `${((indexCourant + (correction ? 1 : 0)) / posees.length) * 100}%` }} />
              </div>
              <p className="legende" style={{ margin: ".25rem 0 0" }}>
                Avancement de cet entraînement — rien n&apos;est enregistré.
              </p>
            </div>
            {correction ? (
              <button
                type="button"
                className="bouton"
                onClick={() => {
                  if (indexCourant + 1 >= posees.length) setEntrainementFini(true);
                  else setIndexCourant(indexCourant + 1);
                  const doux = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
                  window.scrollTo({ top: 0, behavior: doux ? "smooth" : "auto" });
                }}
              >
                {indexCourant + 1 >= posees.length ? "Terminer" : "Question suivante"}
              </button>
            ) : (
              <button
                type="button"
                className="bouton"
                disabled={envoi || !estRenseignee(q)}
                onClick={() => void verifierCourante()}
              >
                {envoi ? "Correction…" : "Vérifier"}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ───────────────────────────────────────────────────── passation complète
  const repondues = posees.filter(estRenseignee).length;
  let situationCourante: string | null = null;

  return (
    <div style={{ paddingBottom: "120px" }}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void soumettre();
        }}
      >
        {posees.map((q, i) => {
          const nouvelleSituation = q.situation && q.situation.id !== situationCourante;
          if (q.situation) situationCourante = q.situation.id;
          const nbSituation = q.situation ? posees.filter((x) => x.situation?.id === q.situation!.id).length : 0;
          return (
            <div key={q.id}>
              {nouvelleSituation && rendreVignette(q, nbSituation)}
              {rendreQuestion(q, i, posees.length, false)}
            </div>
          );
        })}

        {erreur && <p className="encart encart--attention">{erreur}</p>}

        <div className="barre-passation">
          <div className="barre-passation-interne">
            <div style={{ flex: "1 1 14rem", minWidth: 0 }}>
              <p className="legende" style={{ margin: "0 0 .25rem" }}>
                {repondues} / {posees.length} questions renseignées — {moduleTitre}
              </p>
              <div
                className="avancement"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={posees.length}
                aria-valuenow={repondues}
                aria-label="Questions renseignées"
              >
                <span style={{ width: `${(repondues / posees.length) * 100}%` }} />
              </div>
              <p className="legende" style={{ margin: ".25rem 0 0" }}>
                Avancement de cette session — ce n&apos;est pas un avancement d&apos;habilitation.
              </p>
            </div>
            <button type="submit" className="bouton" disabled={envoi || repondues === 0}>
              {envoi ? "Correction…" : "Valider l'évaluation"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
