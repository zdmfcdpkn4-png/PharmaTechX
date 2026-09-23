import Link from "next/link";
import { Fragment } from "react";
import { LienModule } from "@/components/LienModule";
import { getSession } from "@/lib/auth";
import { conservationActive } from "@/lib/config";
import { getReferentiel } from "@/content/referentiel-db";
import { getTousModulesAvecDeposes } from "@/content/store";
import { blocsCompetence, criteres, maintien } from "@/content/habilitation";
import { comptesParModule, compterSignalementsOuverts } from "@/content/banque-db";
import { LIBELLES_ATTENTE, attenteDe, classerCriteres, libelleAnciennete, moisContinus, part, questionsDifficiles, quizAnciens, tranchesScores } from "@/lib/pilotage";
import {
  anciennetesQuiz,
  bilanParCritere,
  comptesPilotage,
  effectifAgents,
  questionsManquees,
  rapportsEnAttente,
  scoresPilotage,
  serieMensuelle,
  type FiltrePilotage,
} from "@/lib/pilotage-db";
import {
  AnneauVerdicts,
  BarreVerdicts,
  Cartouche,
  CourbeMensuelle,
  HistogrammeScores,
  LegendeVerdicts,
  TONS_VERDICT,
} from "@/components/Graphiques";

export const dynamic = "force-dynamic";

/**
 * Tableau de bord de pilotage — tuteurs et administrateurs.
 *
 * Il répond à trois questions, dans cet ordre : où en est-on, qu'est-ce qui
 * attend quelqu'un, et où ça coince. Le classement par critère est donc
 * croissant : le plus bas taux d'acquis en tête, puisque c'est là qu'il y a
 * quelque chose à faire.
 *
 * Tous les blocs se filtrent ensemble (filière, niveau, bloc de compétence,
 * module, période) : un indicateur et son graphique portent toujours sur le
 * même périmètre, affiché en clair au-dessus.
 *
 * Aucun nom n'y paraît : les rapports sont rattachés à un identifiant d'agent
 * (question 6, choix a), et la correspondance se tient hors du site.
 */

const PERIODES: { cle: string; libelle: string; jours: number | null }[] = [
  { cle: "30", libelle: "30 derniers jours", jours: 30 },
  { cle: "90", libelle: "3 derniers mois", jours: 90 },
  { cle: "365", libelle: "12 derniers mois", jours: 365 },
  { cle: "tout", libelle: "Depuis le début", jours: null },
];

export default async function Pilotage({
  searchParams,
}: {
  searchParams: Promise<{ filiere?: string; niveau?: string; bloc?: string; module?: string; periode?: string }>;
}) {
  const p = await searchParams;
  const session = await getSession();
  const [{ filieres, niveaux }, modules, comptesBanque, signalements] = await Promise.all([
    getReferentiel(),
    getTousModulesAvecDeposes({ publiesSeulement: false }),
    comptesParModule().catch(() => ({}) as Record<string, { valides: number; aVerifier: number; reservees: number }>),
    compterSignalementsOuverts().catch(() => 0),
  ]);

  const filiere = filieres.some((f) => f.id === p.filiere) ? p.filiere! : "";
  const niveau = niveaux.some((n) => n.code === p.niveau) ? p.niveau! : "";
  const bloc = blocsCompetence.some((b) => String(b.numero) === p.bloc) ? Number(p.bloc) : null;
  const moduleId = modules.some((m) => m.id === p.module) ? p.module! : "";
  const periode = PERIODES.find((x) => x.cle === p.periode) ?? PERIODES[3];

  // Filière et niveau portent sur le module, pas sur le rapport : un module de
  // tronc commun concerne toutes les filières, un module sans niveau tous les
  // niveaux. La résolution se fait ici, sur la liste fusionnée code + base.
  const retenus = modules.filter(
    (m) =>
      (!filiere || m.affectation === "tronc-commun" || m.postes.includes(filiere)) &&
      (!niveau || m.niveaux.length === 0 || (m.niveaux as string[]).includes(niveau)),
  );
  const filtre: FiltrePilotage = {
    modules: moduleId ? [moduleId] : filiere || niveau ? retenus.map((m) => m.id) : null,
    criteres: bloc === null ? null : criteres.filter((c) => c.bloc === bloc).map((c) => c.id),
    depuis: periode.jours === null ? null : new Date(Date.now() - periode.jours * 86_400_000).toISOString(),
  };

  const conservation = conservationActive();
  const [comptes, parCritere, serie, scores, manquees, attentes, effectif, anciennetes] = conservation
    ? await Promise.all([
        comptesPilotage(filtre),
        bilanParCritere(filtre),
        serieMensuelle(filtre),
        scoresPilotage(filtre),
        questionsManquees(filtre),
        rapportsEnAttente(filtre),
        effectifAgents(),
        anciennetesQuiz(filtre),
      ])
    : [null, [], [], [], [], [], { actifs: 0, total: 0 }, []];
  // Question 49, choix b : l'ancienneté du dernier quiz validé, jamais une échéance.
  const depasses = quizAnciens(anciennetes, maintien.periodiciteMois);

  const publies = modules.filter((m) => m.origine !== "base" || m.statut === "publie");
  const totalBanque = Object.values(comptesBanque).reduce(
    (s, c) => ({ valides: s.valides + c.valides, aVerifier: s.aVerifier + c.aVerifier }),
    { valides: 0, aVerifier: 0 },
  );
  const { couverts } = classerCriteres(parCritere);
  const difficiles = questionsDifficiles(manquees);
  // Seuil le plus courant parmi les modules retenus : repère de lecture de
  // l'histogramme, pas une règle — chaque rapport a scellé le sien.
  const seuils = (moduleId ? modules.filter((m) => m.id === moduleId) : retenus).map((m) => m.seuilReussite);
  const seuilRepere = seuils.length > 0 ? seuils.sort((a, b) => seuils.filter((s) => s === a).length - seuils.filter((s) => s === b).length)[seuils.length - 1] : null;
  const titreModule = moduleId ? modules.find((m) => m.id === moduleId)?.titre : null;
  // Un module encore connu s'ouvre depuis la ligne qui le cite (tâche 69).
  const ouvrable = (id: string) => (modules.some((m) => m.id === id) ? id : null);
  const perimetre = [
    filiere ? filieres.find((f) => f.id === filiere)?.libelle : null,
    niveau ? `niveau ${niveaux.find((n) => n.code === niveau)?.libelle ?? niveau}` : null,
    bloc !== null ? `bloc ${bloc}` : null,
    titreModule && moduleId ? <LienModule id={moduleId}>{titreModule}</LienModule> : null,
    periode.libelle.toLowerCase(),
  ].filter(Boolean);
  const aucunFiltre = !filiere && !niveau && bloc === null && !moduleId && periode.cle === "tout";

  return (
    <>
      <section className="panneau-titre">
        <h1>Pilotage des résultats</h1>
        <p>
          Où en est l&apos;unité, ce qui attend une signature, et où les résultats accrochent. Aucun
          nom : les rapports sont rattachés à un identifiant d&apos;agent.
        </p>
      </section>

      <form method="get" className="carte filtres-pilotage">
        <div className="rangee">
          <label className="champ">
            <span>Filière</span>
            <select name="filiere" defaultValue={filiere}>
              <option value="">Toutes</option>
              {filieres.map((f) => (
                <option key={f.id} value={f.id}>{f.libelle}</option>
              ))}
            </select>
          </label>
          <label className="champ">
            <span>Niveau</span>
            <select name="niveau" defaultValue={niveau}>
              <option value="">Tous</option>
              {niveaux.map((n) => (
                <option key={n.code} value={n.code}>{n.libelle}</option>
              ))}
            </select>
          </label>
          <label className="champ">
            <span>Bloc de compétence</span>
            <select name="bloc" defaultValue={bloc === null ? "" : String(bloc)}>
              <option value="">Tous</option>
              {blocsCompetence.map((b) => (
                <option key={b.numero} value={b.numero}>{b.numero}. {b.titre}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="rangee">
          <label className="champ">
            <span>Module</span>
            <select name="module" defaultValue={moduleId}>
              <option value="">Tous</option>
              {modules.map((m) => (
                <option key={m.id} value={m.id}>{m.titre}</option>
              ))}
            </select>
          </label>
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
            {!aucunFiltre && (
              <Link href="/admin/pilotage" className="bouton bouton--compact bouton--discret">Tout afficher</Link>
            )}
          </div>
        </div>
        <p className="legende" style={{ margin: 0 }}>
          Périmètre :{" "}
          {perimetre.map((x, i) => (
            <Fragment key={i}>
              {i > 0 ? " · " : ""}
              {x}
            </Fragment>
          ))}
          {filtre.modules ? ` — ${filtre.modules.length} module${filtre.modules.length > 1 ? "s" : ""}` : ""}
        </p>
      </form>

      <div className="grille-cartouches">
        <Cartouche valeur={publies.length} libelle="Modules au programme" precision={`${modules.length} au total`} />
        <Cartouche
          valeur={totalBanque.valides}
          libelle="Questions validées"
          precision={totalBanque.aVerifier > 0 ? `${totalBanque.aVerifier} à vérifier` : "rien en attente"}
        />
        <Cartouche
          valeur={signalements}
          libelle="Signalements ouverts"
          ton={signalements > 0 ? "var(--alerte)" : undefined}
          precision={signalements > 0 ? "ils verrouillent les visas" : "aucun verrou"}
        />
        {conservation && comptes && (
          <>
            <Cartouche valeur={comptes.n} libelle="Rapports au périmètre" precision={`${comptes.clos} clos`} />
            <Cartouche
              valeur={comptes.n > 0 ? part(comptes.acquis, comptes.n) : "—"}
              unite={comptes.n > 0 ? " %" : undefined}
              libelle="Critères acquis"
              ton={TONS_VERDICT.acquis}
              precision={`${comptes.acquis} sur ${comptes.n}`}
            />
            <Cartouche
              valeur={comptes.score_moyen ?? "—"}
              unite={comptes.score_moyen === null ? undefined : " %"}
              libelle="Score moyen"
              precision={`${comptes.agents} agent${comptes.agents > 1 ? "s" : ""} évalué${comptes.agents > 1 ? "s" : ""}`}
            />
            <Cartouche
              valeur={effectif.actifs}
              libelle="Agents au répertoire"
              precision={
                effectif.total > effectif.actifs
                  ? `${effectif.total - effectif.actifs} identifiant(s) clos`
                  : "aucun identifiant clos"
              }
            />
            <Cartouche
              valeur={attentes.length}
              libelle="En attente d'un acte"
              ton={attentes.length > 0 ? "var(--alerte)" : undefined}
              precision={attentes.length > 0 ? "arbitrage ou visa" : "rien ne bloque"}
            />
          </>
        )}
      </div>

      {!conservation ? (
        <p className="encart encart--attention">
          <strong>Les résultats ne sont pas enregistrés.</strong> Avec{" "}
          <code>CONSERVATION_RAPPORTS=aucune</code>, le rapport est construit sur le poste de
          l&apos;apprenant et rien n&apos;entre en base : ni rapport, ni visa, ni identifiant
          d&apos;agent. Ce tableau de bord ne montre donc que l&apos;état de la banque. Passer la
          variable à <code>pseudonyme</code> ouvre tout le reste — voir <code>docs/RGPD.md</code>.
        </p>
      ) : (
        <>
          <div className="duo-graphiques">
            <section className="carte">
              <h2>Verdicts</h2>
              <AnneauVerdicts r={comptes!} />
              <LegendeVerdicts r={comptes!} />
              <p className="legende" style={{ margin: 0 }}>
                Verdict retenu : celui de l&apos;arbitrage du tuteur quand le verdict brut était
                indéterminé, sinon le verdict brut.
              </p>
            </section>
            <section className="carte">
              <h2>Évolution mensuelle</h2>
              <CourbeMensuelle points={moisContinus(serie)} />
            </section>
          </div>

          <section className="carte">
            <h2>Répartition des scores</h2>
            <HistogrammeScores tranches={tranchesScores(scores)} seuil={seuilRepere} />
          </section>

          <section className="carte">
            <div className="section-titre">
              <h2>Par critère — le plus bas d&apos;abord</h2>
              <span className="compte">{couverts.length} critère(s) évalué(s)</span>
            </div>
            {couverts.length === 0 ? (
              <p className="legende">Aucun rapport sur ce périmètre.</p>
            ) : (
              <ul className="liste-nue liste-criteres">
                {couverts.map((c) => (
                  <li key={c.cle}>
                    <div className="etape-tete">
                      {c.critere_id && <span className="etiquette etiquette--code">{c.critere_id}</span>}
                      <Link href={`/admin/pilotage?module=${encodeURIComponent(c.cle)}`}>{c.libelle}</Link>
                      <span className="legende" style={{ marginLeft: "auto" }}>
                        {c.taux} % acquis · {c.n} rapport{c.n > 1 ? "s" : ""}
                        {c.score_moyen !== null ? ` · score moyen ${c.score_moyen} %` : ""}
                      </span>
                    </div>
                    <BarreVerdicts r={c} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="carte">
            <div className="section-titre">
              <h2>Questions les plus manquées</h2>
              <span className="compte">{difficiles.length} question(s)</span>
            </div>
            <p className="legende">
              Posées au moins 5 fois, réussies 60 % du temps ou moins. Conventions de lecture, pas
              des normes : en dessous de cinq passages, un taux ne veut rien dire. Une question
              massivement manquée interroge autant la formation que la question elle-même.
            </p>
            {difficiles.length === 0 ? (
              <p className="legende">Aucune question ne ressort sur ce périmètre.</p>
            ) : (
              <ul className="liste-nue liste-questions-dures">
                {difficiles.map((q) => (
                  <li key={q.question_id}>
                    <div className="etape-tete">
                      <span className="etiquette etiquette--echec">{q.taux} %</span>
                      <span>{q.enonce || q.question_id}</span>
                      <span className="legende" style={{ marginLeft: "auto" }}>
                        {q.reussies} / {q.posees}
                        {q.statut === null ? " · hors banque" : q.statut === "retire" ? " · retirée" : ""}
                      </span>
                    </div>
                    <div className="barre-verdicts" style={{ height: 6 }} aria-hidden="true">
                      <span style={{ width: `${q.taux}%`, background: TONS_VERDICT.acquis }} />
                      <span style={{ width: `${100 - q.taux}%`, background: TONS_VERDICT.non_acquis }} />
                    </div>
                    {q.module_id && (
                      <p className="legende" style={{ margin: ".25rem 0 0" }}>
                        <Link href={`/admin/questions?module=${encodeURIComponent(q.module_id)}`}>
                          Voir dans la banque
                        </Link>
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="carte">
            <div className="section-titre">
              <h2>En attente d&apos;un acte</h2>
              <span className="compte">{attentes.length} rapport(s)</span>
            </div>
            {attentes.length === 0 ? (
              <p className="legende">Rien n&apos;attend de signature sur ce périmètre.</p>
            ) : (
              <ul className="liste-nue">
                {attentes.map((r) => {
                  const a = attenteDe(r.statut, r.verdict_brut, r.arbitre);
                  return (
                    <li key={r.id} className="ligne-attente">
                      <span className={`etiquette ${r.verrouille ? "etiquette--echec" : "etiquette--attention"}`}>
                        {r.verrouille ? "Verrouillé" : a ? LIBELLES_ATTENTE[a] : "—"}
                      </span>
                      <Link href={`/admin/rapports/${r.id}`}>{r.numero}</Link>
                      <span className="legende">
                        <LienModule id={ouvrable(r.module_id)}>{r.module_titre}</LienModule>
                      </span>
                      <span className="legende" style={{ marginLeft: "auto" }}>
                        {r.agent_identifiant} · émis le {r.emis_le.slice(0, 10)}
                        {r.verrouille ? " · signalement ouvert sur le tirage" : ""}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="carte" id="anciennete">
            <div className="section-titre">
              <h2>Ancienneté des quiz validés</h2>
              <span className="compte">
                {depasses.length} de plus de {maintien.periodiciteMois} mois
              </span>
            </div>
            <p className="legende">
              Dernier rapport <strong>clos</strong> de chaque agent sur chaque module, et le temps
              écoulé depuis. {maintien.activiteMinimale} Réévaluation de l&apos;habilitation tous les{" "}
              {maintien.periodiciteMois / 12} ans.
            </p>
            <p className="legende">
              <strong>Aucune échéance n&apos;est prononcée ici</strong> : les deux ans courent depuis
              l&apos;habilitation prononcée par le pharmacien — étape 5, hors du site. Ce tableau dit
              depuis combien de temps le quiz a été validé, rien de plus.
            </p>
            {anciennetes.length === 0 ? (
              <p className="legende">Aucun quiz validé sur ce périmètre.</p>
            ) : (
              <ul className="liste-nue">
                {[...anciennetes]
                  .sort((a, b) => b.mois - a.mois)
                  .map((l) => (
                    <li key={`${l.agent_identifiant}-${l.module_id}`} className="ligne-attente">
                      <span
                        className={`etiquette ${l.mois >= maintien.periodiciteMois ? "etiquette--attention" : "etiquette--ok"}`}
                      >
                        {libelleAnciennete(l.mois)}
                      </span>
                      <code>{l.agent_identifiant}</code>
                      <span className="legende">
                        <LienModule id={ouvrable(l.module_id)}>{l.module_titre}</LienModule>
                      </span>
                      <span className="legende" style={{ marginLeft: "auto" }}>
                        {l.critere_id ?? "—"} · validé le {l.dernier_le.slice(0, 10)}
                      </span>
                    </li>
                  ))}
              </ul>
            )}
          </section>

          <p className="legende">
            Le détail par agent et par critère est sur <Link href="/admin/personnel">Personnel</Link> ;
            les rapports eux-mêmes sur <Link href="/admin/rapports">Rapports</Link>.
            {session?.role !== "admin" && " La purge et le journal sont réservés à l'administration."}
          </p>
        </>
      )}
    </>
  );
}
