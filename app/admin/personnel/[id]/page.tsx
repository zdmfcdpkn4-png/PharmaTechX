import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { conservationActive } from "@/lib/config";
import { LIBELLES_COURTS_VERDICT, type Verdict } from "@/lib/decision";
import { lireAgent } from "@/lib/agents";
import { dernieresTraces, historique, statistiquesAgent, type ResumeEntrainement } from "@/lib/progression";
import { getTousModulesAvecDeposes } from "@/content/store";
import { listerOrdresAgents, type OrdreAgent } from "@/content/ordres-db";
import { requeteProfil } from "@/content/ordres";
import { lireParcoursAgent } from "@/content/parcours-agent-db";
import { avancementParModule, libelleAvancement, type TraceAvancement } from "@/content/avancement-agent";
import { badgeEffectif } from "@/content/badges";
import type { Module } from "@/content/types";
import { candidatsDuParcours } from "@/lib/programme-poste";
import { actionFixerParcours, actionPurgerProgression, actionReinitialiserCode, actionRetirerParcours } from "../actions";
import { LienModule } from "@/components/LienModule";
import { etiquetteModule, moduleOuvrable } from "../../questions/commun";
import { ComposeurParcours, type AvancementAffiche, type CandidatParcours } from "./parcours";

export const dynamic = "force-dynamic";

const NATURES: Record<string, string> = { evaluation: "Évaluation", entrainement: "Entraînement", lecture: "Lecture" };

function date(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Paris" });
}

function jour(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" });
}

/** « a », « a et b », « a, b et c ». */
function enumerer(parts: string[]): string {
  return parts.length <= 1 ? (parts[0] ?? "") : `${parts.slice(0, -1).join(", ")} et ${parts[parts.length - 1]}`;
}

/** Progression d'un agent vue par le tutorat : traces conservées, parcours (question 103) et avancement par module, code personnel, purge (administration). */
export default async function ProgressionAgent({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; erreur?: string; n?: string; f?: string; h?: string }>;
}) {
  const [{ id }, p, session] = await Promise.all([params, searchParams, getSession()]);
  if (!conservationActive()) notFound();
  const agent = await lireAgent(Number(id));
  if (!agent) notFound();
  const [stats, traces, dernieres, modules, ordres, parcours, candidats] = await Promise.all([
    statistiquesAgent(agent.id),
    historique(agent.id),
    dernieresTraces(agent.id).catch((): TraceAvancement[] => []),
    getTousModulesAvecDeposes(),
    listerOrdresAgents(agent.id).catch((): OrdreAgent[] => []),
    lireParcoursAgent(agent.id).catch(() => null),
    candidatsDuParcours(agent.id),
  ]);
  const titre = (mid: string) => modules.find((m) => m.id === mid)?.titre ?? mid;
  // Parcours de l'agent (question 103, choix a) : candidats = les modules que ses codes de poste reliés lui
  // ouvrent — son périmètre — ; au besoin, les autres modules publiés s'ajoutent hors périmètre (06/10/2026).
  // Un module du parcours qui n'est plus publié sortira à l'enregistrement.
  const versCandidat = (m: Module): CandidatParcours => ({
    id: m.id,
    titre: m.titre,
    code: etiquetteModule(m),
    badge: badgeEffectif(m.badge, m.titre, m.objectif),
    sansQuestion: !candidats.ouverts.has(m.id),
  });
  const candidatsParcours = candidats.modules.map(versCandidat);
  const horsPerimetre = candidats.horsPerimetre.map(versCandidat);
  const idsPerimetre = new Set(candidatsParcours.map((c) => c.id));
  const idsConnus = new Set([...idsPerimetre, ...horsPerimetre.map((c) => c.id)]);
  const absentsParcours = parcours ? parcours.modules.filter((mid) => !idsConnus.has(mid)).length : 0;
  const horsEnregistres = parcours ? parcours.modules.filter((mid) => idsConnus.has(mid) && !idsPerimetre.has(mid)).length : 0;
  // Modules du périmètre du code que le parcours ne nomme pas : décochés, donc plus proposés à l'agent.
  const ecartesDuPerimetre = parcours ? candidatsParcours.filter((c) => !parcours.modules.includes(c.id)).length : 0;
  // Avancement par module (06/10/2026) : la dernière trace de chaque nature, résumée et déjà libellée.
  const avancement = avancementParModule(dernieres);
  const avancementAffiche: Record<string, AvancementAffiche> = Object.fromEntries(
    [...avancement].map(([mid, a]) => [mid, { etat: a.etat, libelle: libelleAvancement(a, jour) }]),
  );
  const acquisDuParcours = parcours ? parcours.modules.filter((mid) => avancement.get(mid)?.etat === "acquis").length : 0;
  const nbPurge = Number(p.n ?? 0);
  const nbFermes = Number(p.f ?? 0);
  const nbHors = Number(p.h ?? 0);
  const complementsOk = [
    nbFermes > 0 ? `${nbFermes} fermé${nbFermes > 1 ? "s" : ""}` : "",
    nbHors > 0 ? `${nbHors} hors périmètre` : "",
  ].filter(Boolean);

  return (
    <>
      <p className="fil">
        <Link href="/admin/personnel">Personnel</Link> › {agent.identifiant}
      </p>
      <section className="panneau-titre">
        <h1>Progression de {agent.identifiant}</h1>
        <p>
          Traces conservées sous cet identifiant depuis qu&apos;il rattache sa progression (question 11, choix c) :
          évaluations avec leur résultat scellé, entraînements terminés, modules lus. Les rapports émis restent dans
          Rapports, quoi qu&apos;il arrive à ces traces.
        </p>
      </section>

      {p.ok === "purge" && <p className="encart encart--ok">Progression purgée : {p.n ?? "0"} ligne(s) effacée(s).</p>}
      {p.ok === "parcours" && (
        <p className="encart encart--ok" role="status">
          Parcours enregistré : {nbPurge} module{nbPurge > 1 ? "s" : ""}
          {complementsOk.length > 0 ? `, dont ${complementsOk.join(" et ")}` : ""}. L&apos;agent le voit dès sa prochaine page.
        </p>
      )}
      {p.ok === "parcours-retire" && (
        <p className="encart encart--ok" role="status">Parcours retiré : l&apos;agent retrouve tout le programme de son code.</p>
      )}
      {p.erreur === "confirmation" && <p className="encart encart--attention">Recopiez l&apos;identifiant pour confirmer la purge.</p>}
      {p.erreur === "parcours-vide" && (
        <p className="encart encart--attention" role="alert">Cochez au moins un module « au parcours » avant d&apos;enregistrer.</p>
      )}
      {p.erreur === "parcours-sans-code" && (
        <p className="encart encart--attention" role="alert">
          Aucun code de poste actif n&apos;est relié à cet identifiant : le parcours se compose à partir des modules que ce code lui ouvre.
        </p>
      )}

      <div className="tuiles">
        <div className="tuile"><span className="valeur">{stats.evaluations}</span><span className="libelle">évaluations</span></div>
        <div className="tuile"><span className="valeur">{stats.entrainements}</span><span className="libelle">entraînements</span></div>
        <div className="tuile"><span className="valeur">{stats.lectures}</span><span className="libelle">modules lus</span></div>
        <div className="tuile"><span className="valeur">{agent.code_defini ? "défini" : "absent"}</span><span className="libelle">code personnel</span></div>
      </div>

      {/* Parcours de l'agent (question 103, choix a) : composé ici, parmi les modules que ses codes de poste
          reliés lui ouvrent (question 101) et, au besoin, les autres modules publiés (06/10/2026) ; rangé,
          chaque module ouvert ou fermé, son avancement sur chaque ligne ; purgé avec sa progression. */}
      <section className="carte" style={{ marginTop: "1rem" }} aria-labelledby="t-parcours-agent">
        <h2 id="t-parcours-agent">Parcours de l&apos;agent</h2>
        {parcours ? (
          <p className="legende">
            Parcours fixé le {date(parcours.modifieLe)} par {parcours.modifiePar} : {parcours.modules.length} module
            {parcours.modules.length > 1 ? "s" : ""}
            {parcours.fermes.length > 0 || horsEnregistres > 0
              ? `, dont ${enumerer(
                  [
                    parcours.fermes.length > 0 ? `${parcours.fermes.length} fermé${parcours.fermes.length > 1 ? "s" : ""}` : "",
                    horsEnregistres > 0 ? `${horsEnregistres} hors périmètre` : "",
                  ].filter(Boolean),
                )}`
              : ""}
            . Avancement : {acquisDuParcours > 0 ? `${acquisDuParcours} acquis` : "aucun acquis"} sur {parcours.modules.length}.
            {ecartesDuPerimetre > 0
              ? ` ${ecartesDuPerimetre} module${ecartesDuPerimetre > 1 ? "s" : ""} de son code ${ecartesDuPerimetre > 1 ? "restent" : "reste"} hors du parcours : ${ecartesDuPerimetre > 1 ? "ils ne lui sont pas proposés" : "il ne lui est pas proposé"}.`
              : ""}
            {absentsParcours > 0
              ? ` ${absentsParcours} module${absentsParcours > 1 ? "s" : ""} du parcours ${absentsParcours > 1 ? "ne sont" : "n'est"} plus publié${absentsParcours > 1 ? "s" : ""} : ${absentsParcours > 1 ? "ils en sortiront" : "il en sortira"} au prochain enregistrement.`
              : ""}
          </p>
        ) : (
          <p className="legende">
            Pas de parcours fixé : l&apos;agent voit tout le programme de son code de poste, dans l&apos;ordre ci-dessous.
          </p>
        )}
        {candidats.codes.length === 0 ? (
          <p className="encart">
            Aucun code de poste actif n&apos;est relié à cet identifiant. Reliez-en un (Équipe › Codes d&apos;accès, « Relier à
            un agent ») : le parcours se compose à partir des modules que ce code lui ouvre.
          </p>
        ) : (
          <>
            <p className="legende">
              Code{candidats.codes.length > 1 ? "s" : ""} de poste relié{candidats.codes.length > 1 ? "s" : ""} :{" "}
              {enumerer(
                candidats.codes.map((c) => `${c.libelle}${c.filiere ? ` — ${c.filiere}` : ""}${c.niveau ? ` · ${c.niveau}` : ""}`),
              )}
              . La liste propose les modules que ce code lui ouvre, chacun avec son avancement — la dernière trace
              conservée : verdict de la dernière évaluation, avant arbitrage, sinon entraînement, sinon lecture.
              {parcours
                ? " Les modules cochés « au parcours » sont ceux que l'agent voit, dans cet ordre."
                : " Sans parcours fixé, tous sont cochés « au parcours » : c'est ce que l'agent voit aujourd'hui."}{" "}
              Rangez-les et enregistrez : l&apos;ordre est conseillé à l&apos;agent, qui peut faire autrement. Un module
              qu&apos;il ne doit pas encore ouvrir se coche « fermé » : il le verra grisé jusqu&apos;à ce que vous le
              rouvriez. Un module qui ne lui est pas nécessaire se décoche : il ne lui est plus proposé, et sa place dans la
              liste ne compte plus. Au besoin, un module hors du périmètre de son code s&apos;ajoute à la liste, et entre au
              parcours comme les autres. Une fois le parcours fixé, un module publié plus tard dans le programme de son
              code ne lui est pas proposé tant que vous ne le cochez pas ici.
            </p>
            {/* La clé suit le parcours enregistré : après « Enregistrer » ou « Retirer », le composeur repart de
                ce que la base contient, et non de l'état que la page gardait en mémoire. */}
            <ComposeurParcours
              key={parcours ? `${parcours.modifieLe}:${parcours.modules.length}` : "aucun"}
              agentId={agent.id}
              identifiant={agent.identifiant}
              candidats={candidatsParcours}
              horsPerimetre={horsPerimetre}
              avancement={avancementAffiche}
              initial={parcours ? { modules: parcours.modules, fermes: parcours.fermes } : null}
              action={actionFixerParcours}
              actionRetrait={actionRetirerParcours}
            />
          </>
        )}
      </section>

      <table className="tableau" style={{ marginTop: "1rem" }}>
        <thead>
          <tr><th>Date</th><th>Nature</th><th>Module</th><th>Résultat</th></tr>
        </thead>
        <tbody>
          {[...traces].reverse().map((t) => {
            const e = t.nature === "entrainement" ? (t.resultat as ResumeEntrainement | null) : null;
            return (
              <tr key={t.id}>
                <td>{date(t.cree_le)}</td>
                <td>{NATURES[t.nature] ?? t.nature}</td>
                <td>
                  <LienModule id={moduleOuvrable(modules, t.module_id)}>{titre(t.module_id)}</LienModule>
                </td>
                <td>
                  {t.nature === "evaluation" && t.score !== null
                    ? `${t.score} % · ${t.verdict ? LIBELLES_COURTS_VERDICT[t.verdict as Verdict] ?? t.verdict : ""}`
                    : e
                      ? `${e.justes} / ${e.total} justes`
                      : "lu"}
                </td>
              </tr>
            );
          })}
          {traces.length === 0 && (
            <tr><td colSpan={4} className="legende">Aucune trace.</td></tr>
          )}
        </tbody>
      </table>

      {/* Ordres de modules propres à cet apprenant (question 56) : fixés à l'écran
          Ordre, purgés avec sa progression. */}
      {ordres.length > 0 && (
        <section className="carte" style={{ marginTop: "1rem" }} aria-labelledby="t-ordres-agent">
          <h2 id="t-ordres-agent">Ordre propre des modules</h2>
          <ul className="liste-nue">
            {ordres.map((o) => (
              <li key={`${o.parcours}-${o.filiere}-${o.niveau}`}>
                <Link href={`/admin/ordonnancement${requeteProfil(o)}&agent=${encodeURIComponent(agent.identifiant)}`}>
                  {o.filiere} · {o.niveau} — {o.parcours === "maintien" ? "Maintien d'habilitation" : "Intégration"}
                </Link>{" "}
                <span className="legende">
                  {o.modules.length} module{o.modules.length > 1 ? "s" : ""}, fixé le {date(o.modifieLe)} par {o.modifiePar}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="carte" style={{ marginTop: "1rem" }}>
        <div className="actions" style={{ marginTop: 0 }}>
          {agent.code_defini && (
            <form action={actionReinitialiserCode}>
              <input type="hidden" name="id" value={agent.id} />
              <button type="submit" className="bouton bouton--compact bouton--secondaire">Réinitialiser le code personnel</button>
            </form>
          )}
        </div>
        {session?.role === "admin" && (traces.length > 0 || ordres.length > 0 || parcours) && (
          <form action={actionPurgerProgression} style={{ marginTop: ".75rem" }}>
            <input type="hidden" name="id" value={agent.id} />
            <div className="rangee">
              <label className="champ">
                <span>Purger la progression : recopiez l&apos;identifiant pour confirmer</span>
                <input type="text" name="confirmation" placeholder={agent.identifiant} autoComplete="off" />
              </label>
            </div>
            <div className="actions">
              <button type="submit" className="bouton bouton--compact bouton--discret">
                Purger{" "}
                {enumerer(
                  [
                    traces.length > 0 ? `les ${traces.length} trace${traces.length > 1 ? "s" : ""}` : "",
                    parcours ? "le parcours" : "",
                    ordres.length > 0 ? `l'ordre propre` : "",
                  ].filter(Boolean),
                )}
              </button>
              <span className="legende">Journalisé. Les rapports émis ne sont pas touchés.</span>
            </div>
          </form>
        )}
      </section>
    </>
  );
}
