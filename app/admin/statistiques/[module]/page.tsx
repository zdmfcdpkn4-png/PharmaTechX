import Link from "next/link";
import { notFound } from "next/navigation";
import { Cartouche } from "@/components/Graphiques";
import { LienModule } from "@/components/LienModule";
import { listerQuestions } from "@/content/banque-db";
import { getModule, getModuleComplet } from "@/content/store";
import { banqueDuModule } from "@/content/types";
import { getSession } from "@/lib/auth";
import { conservationActive } from "@/lib/config";
import { PERIODES } from "@/lib/pilotage";
import {
  CONSEILS_REPERE,
  SEUILS_STAT,
  analyserElements,
  analyserQuestions,
  analyserSources,
  avantApres,
  bilanModule,
  evolutionTrimestrielle,
  jourParis,
  libelleTrimestre,
  parNiveauCible,
  pointsManques,
  questionARevoir,
  type AnalyseElement,
} from "@/lib/statistiques";
import { actionsDuModule, lireEssais } from "@/lib/statistiques-db";
import { actionAjouterAmelioration, actionSupprimerAmelioration } from "../actions";
import { BarreTaux, Methode, Reperes, TexteTaux } from "../commun";

export const dynamic = "force-dynamic";

/**
 * Fiche statistique d'un module (question 78, choix a, 25/09/2026) : où ça
 * accroche, question par question et réponse par réponse, et ce qu'ont donné
 * les actions d'amélioration. Aucune donnée individuelle.
 */

const NATURES: Record<AnalyseElement["nature"], string> = {
  "bonne-reponse": "Bonne réponse oubliée",
  distracteur: "Mauvaise réponse choisie",
  "proposition-vraie": "Proposition vraie jugée fausse",
  "proposition-fausse": "Proposition fausse jugée vraie",
  legende: "Légende manquée",
  etape: "Étape mal placée",
  trou: "Trou mal complété",
};

const ERREURS: Record<string, string> = {
  date: "Date invalide : une action se date au plus tard aujourd'hui.",
  description: "Décrivez l'action en quelques mots.",
};

function court(texte: string, max = 140): string {
  return texte.length > max ? `${texte.slice(0, max - 1)}…` : texte;
}

export default async function FicheStatistique({
  params,
  searchParams,
}: {
  params: Promise<{ module: string }>;
  searchParams: Promise<{ periode?: string; ok?: string; erreur?: string }>;
}) {
  const id = decodeURIComponent((await params).module);
  const p = await searchParams;
  const session = await getSession();
  const periode = PERIODES.find((x) => x.cle === p.periode) ?? PERIODES[3];
  const depuis = periode.jours === null ? null : new Date(Date.now() - periode.jours * 86_400_000).toISOString();
  const conservation = conservationActive();

  const [mod, essais, enBase, actions] = await Promise.all([
    getModuleComplet(id, { inclureBrouillons: true }),
    conservation ? lireEssais([id], { details: true }) : Promise.resolve([]),
    listerQuestions({ moduleId: id }).catch(() => []),
    conservation ? actionsDuModule(id) : Promise.resolve([]),
  ]);
  // Un module retiré de la base se lit encore s'il a été évalué.
  if (!mod && essais.length === 0) notFound();
  const titre = mod?.titre ?? essais[essais.length - 1]?.moduleTitre ?? id;

  // Propositions actuelles des QCM et QIM, pour les essais scellés avant qu'un
  // résultat ne porte la liste des propositions présentées.
  const code = getModule(id);
  const options = new Map<string, string[]>([
    ...(code ? banqueDuModule(code) : [])
      .filter((q) => q.type === "QCM" || q.type === "QIM")
      .map((q): [string, string[]] => [q.id, q.options.map((o) => o.texte)]),
    ...enBase
      .filter((q) => q.format === "QCM" || q.format === "QIM")
      .map((q): [string, string[]] => [q.id, q.options.map((o) => o.texte)]),
  ]);
  const statutEnBase = new Map(enBase.map((q) => [q.id, q.statut]));

  const bilan = bilanModule(id, titre, essais, depuis);
  const suffisant = bilan.agents >= SEUILS_STAT.effectif;
  const evolution = evolutionTrimestrielle(essais, depuis);
  const parNiveau = parNiveauCible(essais, depuis);
  const questions = analyserQuestions(essais, depuis);
  const elements = analyserElements(essais, depuis, options);
  const manques = pointsManques(elements);
  const inutiles = elements.filter((e) => e.nonFonctionnel);
  const sources = analyserSources(essais, depuis);
  const comparaisons = avantApres(essais, actions);
  const aRevoir = questions.filter((q) => questionARevoir(q.reperes)).length;
  const nonDepartages = elements.reduce((s, e) => s + e.nonDepartage, 0);
  // Le jour de Paris : entre minuit et 2 h, le temps universel est encore à la veille.
  const aujourdhui = jourParis(new Date().toISOString());

  const lienQuestion = (qid: string) =>
    statutEnBase.has(qid) ? `/admin/questions/${encodeURIComponent(qid)}` : null;

  return (
    <>
      <p className="fil">
        <Link href="/admin/statistiques">Statistiques</Link> › {titre}
      </p>
      <section className="panneau-titre">
        <h1>{titre}</h1>
        <p>
          Réussite des agents sur ce module, question par question et réponse par réponse — pour savoir quoi
          retravailler, et mesurer ensuite l&apos;effet de ce qu&apos;on a changé.
        </p>
        <p className="legende">
          {mod && (
            <>
              <LienModule id={id}>Voir le module</LienModule>
              {" · "}
            </>
          )}
          <Link href={`/admin/questions?vue=liste&module=${encodeURIComponent(id)}`}>Ses questions dans la banque</Link>
          {mod?.origine === "base" && (
            <>
              {" · "}
              <Link href={`/admin/modules/${encodeURIComponent(id)}`}>Modifier le module</Link>
            </>
          )}
          {" · "}
          <Link href={`/admin/pilotage?module=${encodeURIComponent(id)}`}>Verdicts au Pilotage</Link>
        </p>
      </section>

      <form method="get" className="carte filtres-pilotage">
        <div className="rangee">
          <label className="champ">
            <span>Période</span>
            <select name="periode" defaultValue={periode.cle}>
              {PERIODES.map((x) => (
                <option key={x.cle} value={x.cle}>{x.libelle}</option>
              ))}
            </select>
          </label>
          <div className="actions actions--fin">
            <button type="submit" className="bouton bouton--compact">Appliquer</button>
          </div>
        </div>
      </form>

      {!conservation ? (
        <p className="encart encart--attention">
          <strong>Les résultats ne sont pas enregistrés</strong> (<code>CONSERVATION_RAPPORTS=aucune</code>) : il
          n&apos;y a rien à analyser.
        </p>
      ) : (
        <>
          <div className="grille-cartouches">
            <Cartouche valeur={bilan.agents} libelle="Agents évalués" precision={`${bilan.essais} essai(s)`} />
            <Cartouche
              valeur={bilan.premierEssai.taux ?? "—"}
              unite={bilan.premierEssai.taux === null ? undefined : " %"}
              libelle="Réussite au premier essai"
              ton={bilan.aRevoir ? "var(--echec)" : undefined}
              precision={
                bilan.premierEssai.taux === null
                  ? `${bilan.premierEssai.n} premier(s) essai(s), ${SEUILS_STAT.effectif} requis`
                  : `IC 95 % ${bilan.premierEssai.bas}–${bilan.premierEssai.haut}`
              }
            />
            <Cartouche
              valeur={bilan.final.taux ?? "—"}
              unite={bilan.final.taux === null ? undefined : " %"}
              libelle="Réussite finale"
              precision="agents ayant atteint le seuil"
            />
            <Cartouche
              valeur={bilan.essaisPourReussir === null ? "—" : String(bilan.essaisPourReussir).replace(".", ",")}
              libelle="Essais pour réussir"
              precision="en moyenne, jusqu'à la première réussite"
            />
            <Cartouche
              valeur={bilan.scoreMedianPremier ?? "—"}
              unite={bilan.scoreMedianPremier === null ? undefined : " %"}
              libelle="Score médian au premier essai"
              precision={mod ? `seuil du module : ${mod.seuilReussite} %` : undefined}
            />
          </div>

          {!suffisant && (
            <p className="encart">
              {bilan.agents} agent{bilan.agents > 1 ? "s" : ""} évalué{bilan.agents > 1 ? "s" : ""} sur cette période :
              les taux apparaissent à partir de {SEUILS_STAT.effectif}. Les effectifs restent lisibles ci-dessous.
            </p>
          )}

          <div className="duo-graphiques">
            <section className="carte">
              <h2>Par trimestre</h2>
              <p className="legende">Réussite au premier essai des agents évalués pour la première fois ce trimestre-là.</p>
              {evolution.length === 0 ? (
                <p className="legende">Aucun premier essai sur la période.</p>
              ) : (
                <ul className="liste-nue stat-periodes">
                  {evolution.map((x) => (
                    <li key={x.cle}>
                      <span className="stat-periode">{libelleTrimestre(x.cle)}</span>
                      <BarreTaux t={x.premierEssai} repere={SEUILS_STAT.aRevoir} />
                      <span className="legende">
                        <TexteTaux t={x.premierEssai} unite="premier essai" />
                        {x.premierEssai.taux !== null && ` · ${x.premierEssai.n} premiers essais`}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section className="carte">
              <h2>Par niveau visé</h2>
              <p className="legende">Niveau cible choisi à l&apos;évaluation.</p>
              {parNiveau.length === 0 ? (
                <p className="legende">Aucun premier essai sur la période.</p>
              ) : (
                <ul className="liste-nue stat-periodes">
                  {parNiveau.map((g) => (
                    <li key={g.niveau ?? "-"}>
                      <span className="stat-periode">{g.niveau ?? "Non précisé"}</span>
                      <BarreTaux t={g.premierEssai} repere={SEUILS_STAT.aRevoir} />
                      <span className="legende">
                        <TexteTaux t={g.premierEssai} unite="premier essai" />
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <section className="carte" id="questions">
            <div className="section-titre">
              <h2>Questions — la moins réussie d&apos;abord</h2>
              <span className="compte">
                {questions.length} question(s){aRevoir > 0 ? ` · ${aRevoir} à revoir` : ""}
              </span>
            </div>
            {questions.length === 0 ? (
              <p className="legende">Aucune question posée sur la période.</p>
            ) : (
              <table className="tableau tableau-stats">
                <thead>
                  <tr>
                    <th scope="col">Question</th>
                    <th scope="col">Posée</th>
                    <th scope="col">Réussie</th>
                    <th scope="col">Discrimination</th>
                    <th scope="col">Sans réponse</th>
                  </tr>
                </thead>
                <tbody>
                  {questions.map((q) => {
                    const lien = lienQuestion(q.questionId);
                    return (
                      <tr key={q.questionId} id={`q-${q.questionId}`}>
                        <td>
                          <span className="etiquette etiquette--code">{q.type}</span>{" "}
                          {lien ? <Link href={lien}>{court(q.enonce || q.questionId)}</Link> : court(q.enonce || q.questionId)}
                          {!lien && <span className="legende"> · question du site</span>}
                          {statutEnBase.get(q.questionId) === "retire" && <span className="legende"> · retirée</span>}
                          <div className="stat-reperes">
                            <Reperes reperes={q.reperes} />
                          </div>
                          {q.reperes.filter((r) => r !== "tres-facile").map((r) => (
                            <p key={r} className="legende stat-conseil">{CONSEILS_REPERE[r]}</p>
                          ))}
                        </td>
                        <td data-libelle="Posée">{q.n}</td>
                        <td data-libelle="Réussie"><TexteTaux t={q.reussite} unite="essai" /></td>
                        <td data-libelle="Discrimination">{q.discrimination === null ? "—" : String(q.discrimination).replace(".", ",")}</td>
                        <td data-libelle="Sans réponse">{q.sansReponse.taux === null ? "—" : `${q.sansReponse.taux} %`}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </section>

          <section className="carte" id="manques">
            <div className="section-titre">
              <h2>Ce qui accroche, précisément</h2>
              <span className="compte">{manques.length} point(s)</span>
            </div>
            <p className="legende">
              Proposition mal jugée, mauvaise réponse choisie, légende, étape ou trou manqué — le plus fréquent
              d&apos;abord. Une mauvaise réponse choisie souvent signale une idée fausse répandue : c&apos;est au
              module de la corriger.
            </p>
            {manques.length === 0 ? (
              <p className="legende">Rien ne ressort sur la période, ou l&apos;effectif ne le permet pas encore.</p>
            ) : (
              <ul className="liste-nue liste-criteres">
                {manques.map((e) => (
                  <li key={`${e.questionId}-${e.nature}-${e.element}`}>
                    <div className="etape-tete">
                      <span className="etiquette etiquette--echec">{e.tauxErreur.taux} %</span>
                      <span>
                        <strong>{NATURES[e.nature]}</strong> : {court(e.element, 160)}
                      </span>
                    </div>
                    <p className="legende stat-ligne">
                      {e.erreurs} sur {e.n} essai{e.n > 1 ? "s" : ""}
                      {e.sansReponse > 0 && ` · ${e.sansReponse} sans réponse`}
                      {e.nonDepartage > 0 && ` · ${e.nonDepartage} non départagé(s)`} — question :{" "}
                      <Link href={`#q-${e.questionId}`}>{court(e.enonce, 90)}</Link>
                    </p>
                  </li>
                ))}
              </ul>
            )}
            {inutiles.length > 0 && (
              <>
                <h3 className="stat-sous-titre">Mauvaises réponses que personne ne choisit</h3>
                <p className="legende">
                  Choisies par moins de {SEUILS_STAT.distracteur} % des essais : elles ne piègent plus personne, et
                  la question en devient plus facile qu&apos;elle n&apos;en a l&apos;air. À remplacer par une erreur
                  plausible, ou à retirer.
                </p>
                <ul className="liste-nue">
                  {inutiles.map((e) => (
                    <li key={`${e.questionId}-${e.element}`} className="legende">
                      « {court(e.element, 120)} » — <Link href={`#q-${e.questionId}`}>{court(e.enonce, 80)}</Link>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {nonDepartages > 0 && (
              <p className="legende">
                Non départagé : dans un essai antérieur au 25/09/2026, une proposition non cochée d&apos;un QIM a pu
                être jugée fausse ou laissée en « je ne sais pas » — le résultat ne le disait pas encore.
              </p>
            )}
          </section>

          <section className="carte" id="sources">
            <div className="section-titre">
              <h2>Par source du support</h2>
              <span className="compte">{sources.length} source(s)</span>
            </div>
            <p className="legende">
              Réussite des questions qui renvoient à une même source : la moins réussie d&apos;abord — c&apos;est la
              partie du support à retravailler.
            </p>
            {sources.length === 0 ? (
              <p className="legende">Aucune question posée ne cite de source.</p>
            ) : (
              <ul className="liste-nue stat-periodes">
                {sources.map((s) => (
                  <li key={s.source}>
                    <span className="stat-periode">{court(s.source, 90)}</span>
                    <BarreTaux t={s.reussite} repere={SEUILS_STAT.aRevoir} />
                    <span className="legende">
                      <TexteTaux t={s.reussite} unite="réponse" /> · {s.questions} question{s.questions > 1 ? "s" : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="carte" id="actions">
            <div className="section-titre">
              <h2>Actions d&apos;amélioration</h2>
              <span className="compte">{actions.length} action(s)</span>
            </div>
            <p className="legende">
              Consignez ce que vous avez changé — une section réécrite, une question reformulée. La réussite au
              premier essai se compare ensuite avant et après chaque action, chaque période bornée par les actions
              voisines. Il faut du temps, et des agents évalués pour la première fois, pour que l&apos;après se lise.
            </p>
            {p.ok === "action" && <p className="encart encart--ok">Action consignée.</p>}
            {p.ok === "suppression" && <p className="encart encart--ok">Action supprimée.</p>}
            {p.erreur && ERREURS[p.erreur] && <p className="encart encart--attention">{ERREURS[p.erreur]}</p>}
            {comparaisons.length > 0 && (
              <ul className="liste-nue liste-criteres">
                {[...comparaisons].reverse().map((c) => (
                  <li key={c.action.id}>
                    <div className="etape-tete">
                      <span className="etiquette etiquette--neutre">{c.action.le.split("-").reverse().join("/")}</span>
                      <span>{c.action.description}</span>
                      <span className="legende" style={{ marginLeft: "auto" }}>{c.action.auteur}</span>
                    </div>
                    <p className="legende stat-ligne">
                      Avant : <TexteTaux t={c.avant} unite="premier essai" /> · Après : <TexteTaux t={c.apres} unite="premier essai" />
                    </p>
                    {session?.role === "admin" && (
                      <form action={actionSupprimerAmelioration} className="stat-supprimer">
                        <input type="hidden" name="id" value={c.action.id} />
                        <input type="hidden" name="moduleId" value={id} />
                        <button type="submit" className="bouton bouton--compact bouton--discret">
                          Supprimer cette action
                        </button>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {mod && (
              <form action={actionAjouterAmelioration} className="rangee stat-action">
                <input type="hidden" name="moduleId" value={id} />
                <label className="champ">
                  <span>Date</span>
                  <input type="date" name="le" defaultValue={aujourdhui} max={aujourdhui} required />
                </label>
                <label className="champ stat-action-texte">
                  <span>Ce qui a changé</span>
                  <input type="text" name="description" maxLength={300} required placeholder="Section 3 réécrite, question sur le sas reformulée…" />
                </label>
                <div className="actions actions--fin">
                  <button type="submit" className="bouton bouton--compact">Consigner</button>
                </div>
              </form>
            )}
          </section>

          <p className="actions">
            <a className="bouton bouton--compact bouton--secondaire" href={`/admin/statistiques/export.csv?type=questions&module=${encodeURIComponent(id)}${periode.cle === "tout" ? "" : `&periode=${periode.cle}`}`}>
              Tableur des questions
            </a>
            <a className="bouton bouton--compact bouton--secondaire" href={`/admin/statistiques/export.csv?type=elements&module=${encodeURIComponent(id)}${periode.cle === "tout" ? "" : `&periode=${periode.cle}`}`}>
              Tableur des réponses
            </a>
          </p>
        </>
      )}

      <Methode />
    </>
  );
}
