"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { QuestionPublique } from "@/content/types";
import type { ResultatEvaluation } from "@/app/api/evaluation/route";
import { useSessionFormation } from "./SessionFormation";

/**
 * Moteur d'évaluation.
 *
 * Le navigateur ne détient jamais les bonnes réponses : les questions arrivent
 * expurgées et la correction est faite par la route API à la soumission. Le
 * tirage est fait ici, pour que la difficulté soit réglable sans aller-retour.
 *
 * Les QIM sont posées en **Vrai/Faux proposition par proposition** plutôt qu'en
 * cases à cocher : avec des cases, ne rien cocher passait pour une réponse et
 * le barème à la discordance devenait illisible. Chaque proposition non jugée
 * compte désormais explicitement comme une discordance, et c'est annoncé.
 * Le mode cases à cocher reste disponible via `qimEnVraiFaux={false}` : la
 * présentation à retenir est à trancher avec les préparateurs.
 */

type Difficulte = "decouverte" | "habilitation" | "complet";

const DIFFICULTES: Record<
  Difficulte,
  { libelle: string; description: string; nb: number | null }
> = {
  decouverte: {
    libelle: "Découverte",
    description: "Tirage court, pour se situer avant de reprendre le module.",
    nb: 5,
  },
  habilitation: {
    libelle: "Habilitation",
    description:
      "Tirage de référence, toutes les questions éliminatoires incluses.",
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

function formatLisible(q: QuestionPublique): string {
  if (q.type === "QIM") return "QIM — barème à la discordance";
  return estUneSeule(q)
    ? "QCM — une seule réponse"
    : "QCM — plusieurs réponses";
}

function baremeLisible(q: QuestionPublique): string {
  if (q.type === "QIM") {
    return "0 discordance → 1 point ; 1 discordance → 0,5 ; 2 ou plus → 0.";
  }
  return estUneSeule(q)
    ? "1 point si la réponse est exacte, 0 sinon."
    : "Tout ou rien : l'ensemble coché doit être exactement l'ensemble attendu.";
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
function tirer(
  banque: QuestionPublique[],
  nb: number | null,
): QuestionPublique[] {
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

/** État des QIM : par question, par proposition, un verdict Vrai/Faux. */
type EtatQim = Record<string, Record<string, boolean>>;

export function Evaluation({
  moduleId,
  moduleTitre,
  banque,
  seuil,
  qimEnVraiFaux = true,
}: {
  moduleId: string;
  moduleTitre: string;
  banque: QuestionPublique[];
  seuil: number;
  qimEnVraiFaux?: boolean;
}) {
  const [difficulte, setDifficulte] = useState<Difficulte>("habilitation");
  const [demarre, setDemarre] = useState(false);
  const [graine, setGraine] = useState(0);
  const [reponses, setReponses] = useState<Record<string, string[]>>({});
  const [qim, setQim] = useState<EtatQim>({});
  const [resultat, setResultat] = useState<ResultatEvaluation | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const { enregistrer } = useSessionFormation();

  const posees = useMemo(
    () => tirer(banque, DIFFICULTES[difficulte].nb),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [banque, difficulte, graine],
  );

  const basculer = (q: QuestionPublique, optionId: string) => {
    setReponses((prec) => {
      const actuel = prec[q.id] ?? [];
      if (estUneSeule(q)) return { ...prec, [q.id]: [optionId] };
      return {
        ...prec,
        [q.id]: actuel.includes(optionId)
          ? actuel.filter((x) => x !== optionId)
          : [...actuel, optionId],
      };
    });
  };

  const jugerQim = (qid: string, optId: string, vrai: boolean) => {
    setQim((prec) => ({ ...prec, [qid]: { ...(prec[qid] ?? {}), [optId]: vrai } }));
  };

  /** Une question est « renseignée » dès qu'elle a reçu au moins un verdict. */
  const estRenseignee = (q: QuestionPublique): boolean =>
    q.type === "QIM" && qimEnVraiFaux
      ? Object.keys(qim[q.id] ?? {}).length > 0
      : (reponses[q.id] ?? []).length > 0;

  const soumettre = async () => {
    setEnvoi(true);
    setErreur(null);

    // Les QIM en Vrai/Faux alimentent deux champs : les propositions jugées
    // vraies (`reponses`) et l'ensemble des propositions jugées (`juges`).
    const rep: Record<string, string[]> = { ...reponses };
    const juges: Record<string, string[]> = {};
    if (qimEnVraiFaux) {
      for (const q of posees) {
        if (q.type !== "QIM") continue;
        const verdicts = qim[q.id] ?? {};
        juges[q.id] = Object.keys(verdicts);
        rep[q.id] = Object.entries(verdicts)
          .filter(([, v]) => v)
          .map(([k]) => k);
      }
    }

    try {
      const reponse = await fetch("/api/evaluation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          moduleId,
          questionIds: posees.map((q) => q.id),
          reponses: rep,
          juges,
        }),
      });
      if (!reponse.ok) {
        const j = await reponse.json().catch(() => ({}));
        throw new Error(j.erreur ?? "La correction a échoué.");
      }
      const r: ResultatEvaluation = await reponse.json();
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

  const recommencer = () => {
    setResultat(null);
    setReponses({});
    setQim({});
    setGraine((g) => g + 1);
    setDemarre(false);
  };

  // ───────────────────────────────────────────────────── réglage du tirage
  if (!demarre && !resultat) {
    return (
      <section className="carte">
        <h2>Régler l&apos;évaluation</h2>
        <p>
          Les questions sont tirées au sort dans la banque du critère (
          {banque.length} disponibles). Les questions éliminatoires sont
          toujours posées, et les mises en situation sont tirées avec leur
          vignette entière.
        </p>
        <p className="encart">
          Seuil de réussite <strong>{seuil}&nbsp;%</strong>. Une erreur sur une
          question éliminatoire rend le critère non acquis, quel que soit le
          score.
        </p>
        <div className="choix-difficulte">
          {(Object.keys(DIFFICULTES) as Difficulte[]).map((d) => {
            const vise = DIFFICULTES[d].nb;
            const reel =
              vise === null ? banque.length : Math.min(vise, banque.length);
            return (
              <label
                key={d}
                className={`option${difficulte === d ? " est-choisie" : ""}`}
              >
                <input
                  type="radio"
                  name="difficulte"
                  checked={difficulte === d}
                  onChange={() => setDifficulte(d)}
                />
                <span>
                  <strong>{DIFFICULTES[d].libelle}</strong> — {reel} question
                  {reel > 1 ? "s" : ""}
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
        </div>
        <div className="actions">
          <button
            type="button"
            className="bouton"
            onClick={() => setDemarre(true)}
          >
            Commencer
          </button>
          <Link
            href={`/module/${moduleId}`}
            className="bouton bouton--secondaire"
          >
            Revoir le module
          </Link>
        </div>
      </section>
    );
  }

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
              {resultat.reussi
                ? "Critère acquis pour cette évaluation"
                : "Critère non acquis"}
            </h2>
            <p style={{ margin: ".25rem 0 0" }}>
              {resultat.pointsObtenus.toString().replace(".", ",")} /{" "}
              {resultat.pointsTotal} points — seuil de réussite {seuil}&nbsp;%
            </p>
          </div>
        </div>

        {resultat.echecEliminatoire && (
          <p className="encart encart--attention">
            <strong>Échec sur une question éliminatoire :</strong> le critère est
            non acquis quel que soit le score.
          </p>
        )}

        {resultat.detail.map((d, i) => {
          const classe = d.correct
            ? "correction--exacte"
            : d.discordances === 1 && d.type === "QIM"
              ? "correction--partielle"
              : "correction--erronee";
          const etat = d.correct
            ? "Réponse exacte"
            : d.type === "QIM"
              ? `${d.discordances} discordance${d.discordances > 1 ? "s" : ""}${d.nonJugees > 0 ? ` — dont ${d.nonJugees} proposition${d.nonJugees > 1 ? "s" : ""} sans réponse` : ""}`
              : "Réponse erronée";

          return (
            <div key={d.questionId} className={`correction ${classe}`}>
              <div className="etape-tete">
                <strong>Question {i + 1}</strong>
                <span className="etiquette etiquette--neutre">{etat}</span>
                {d.eliminatoire && (
                  <span className="etiquette etiquette--obligatoire">
                    Éliminatoire
                  </span>
                )}
                <span style={{ marginLeft: "auto", fontWeight: 650 }}>
                  {d.note.toString().replace(".", ",")} pt
                </span>
              </div>

              <p>
                <strong>{d.enonce}</strong>
              </p>
              <p className="legende">
                Votre réponse&nbsp;:{" "}
                {d.choixApprenant.length > 0
                  ? d.choixApprenant.join(" · ")
                  : "aucune"}
                <br />
                Attendu&nbsp;: {d.reponsesAttendues.join(" · ")}
              </p>
              <p style={{ maxWidth: "66ch" }}>{d.justification}</p>
              {d.sources.length > 0 && (
                <p className="legende" style={{ marginBottom: 0 }}>
                  Source&nbsp;: {d.sources.join(" ; ")}
                </p>
              )}
            </div>
          );
        })}

        <p className="encart">
          <strong>Ce résultat ne vaut pas habilitation.</strong> Il constitue la
          preuve de l&apos;étape 2 sur 6 : exportez le rapport et remettez-le
          pour votre dossier. Le compagnonnage et l&apos;évaluation pratique au
          poste restent à faire.
        </p>

        <div className="actions">
          <button type="button" className="bouton" onClick={recommencer}>
            Nouveau tirage
          </button>
          <Link
            href={`/module/${moduleId}`}
            className="bouton bouton--secondaire"
          >
            Revoir le module
          </Link>
          <Link href="/" className="bouton bouton--secondaire">
            Retour au programme
          </Link>
        </div>
      </>
    );
  }

  // ───────────────────────────────────────────────────────────── passation
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
          const nouvelleSituation =
            q.situation && q.situation.id !== situationCourante;
          if (q.situation) situationCourante = q.situation.id;
          const enVraiFaux = q.type === "QIM" && qimEnVraiFaux;

          return (
            <div key={q.id}>
              {nouvelleSituation && q.situation && (
                <section className="vignette">
                  <p className="sur-titre">
                    Mise en situation — lisez posément
                  </p>
                  <h3>{q.situation.titre}</h3>
                  {q.situation.contexte.split(/\n{2,}/).map((p, j) => (
                    <p key={j} style={{ fontSize: "1rem", lineHeight: 1.7 }}>
                      {p}
                    </p>
                  ))}
                  <p className="legende" style={{ marginBottom: 0 }}>
                    Les questions suivantes portent sur cette situation.
                  </p>
                </section>
              )}

              <fieldset className="question">
                <legend>
                  <span className="legende">
                    Question {i + 1} / {posees.length}
                  </span>
                </legend>

                <div className="etape-tete">
                  <span className="etiquette etiquette--site">
                    {formatLisible(q)}
                  </span>
                  {q.eliminatoire && (
                    <span className="etiquette etiquette--obligatoire">
                      Éliminatoire
                    </span>
                  )}
                </div>

                <p className="question-enonce">{q.enonce}</p>
                <p className="question-bareme">{baremeLisible(q)}</p>

                {enVraiFaux ? (
                  <>
                    <p className="question-avertissement">
                      Chaque proposition se juge séparément — une proposition
                      laissée sans réponse compte comme une discordance.
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
              <span
                style={{ width: `${(repondues / posees.length) * 100}%` }}
              />
            </div>
            <p className="legende" style={{ margin: ".25rem 0 0" }}>
              Avancement de cette session — ce n&apos;est pas un avancement
              d&apos;habilitation.
            </p>
          </div>
          <button
            type="submit"
            className="bouton"
            disabled={envoi || repondues === 0}
          >
            {envoi ? "Correction…" : "Valider l'évaluation"}
          </button>
          </div>
        </div>
      </form>
    </div>
  );
}
