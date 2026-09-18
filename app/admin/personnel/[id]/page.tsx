import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { conservationActive } from "@/lib/config";
import { LIBELLES_COURTS_VERDICT, type Verdict } from "@/lib/decision";
import { lireAgent } from "@/lib/agents";
import { historique, statistiquesAgent, type ResumeEntrainement } from "@/lib/progression";
import { getTousModulesAvecDeposes } from "@/content/store";
import { actionPurgerProgression, actionReinitialiserCode } from "../actions";

export const dynamic = "force-dynamic";

const NATURES: Record<string, string> = { evaluation: "Évaluation", entrainement: "Entraînement", lecture: "Lecture" };

function date(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Paris" });
}

/** Progression d'un agent vue par le tutorat : traces conservées, code personnel, purge (administration). */
export default async function ProgressionAgent({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; erreur?: string; n?: string }>;
}) {
  const [{ id }, p, session] = await Promise.all([params, searchParams, getSession()]);
  if (!conservationActive()) notFound();
  const agent = await lireAgent(Number(id));
  if (!agent) notFound();
  const [stats, traces, modules] = await Promise.all([statistiquesAgent(agent.id), historique(agent.id), getTousModulesAvecDeposes()]);
  const titre = (mid: string) => modules.find((m) => m.id === mid)?.titre ?? mid;

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
      {p.erreur === "confirmation" && <p className="encart encart--attention">Recopiez l&apos;identifiant pour confirmer la purge.</p>}

      <div className="tuiles">
        <div className="tuile"><span className="valeur">{stats.evaluations}</span><span className="libelle">évaluations</span></div>
        <div className="tuile"><span className="valeur">{stats.entrainements}</span><span className="libelle">entraînements</span></div>
        <div className="tuile"><span className="valeur">{stats.lectures}</span><span className="libelle">modules lus</span></div>
        <div className="tuile"><span className="valeur">{agent.code_defini ? "défini" : "absent"}</span><span className="libelle">code personnel</span></div>
      </div>

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
                <td>{titre(t.module_id)}</td>
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

      <section className="carte" style={{ marginTop: "1rem" }}>
        <div className="actions" style={{ marginTop: 0 }}>
          {agent.code_defini && (
            <form action={actionReinitialiserCode}>
              <input type="hidden" name="id" value={agent.id} />
              <button type="submit" className="bouton bouton--compact bouton--secondaire">Réinitialiser le code personnel</button>
            </form>
          )}
        </div>
        {session?.role === "admin" && traces.length > 0 && (
          <form action={actionPurgerProgression} style={{ marginTop: ".75rem" }}>
            <input type="hidden" name="id" value={agent.id} />
            <div className="rangee">
              <label className="champ">
                <span>Purger la progression : recopiez l&apos;identifiant pour confirmer</span>
                <input type="text" name="confirmation" placeholder={agent.identifiant} autoComplete="off" />
              </label>
            </div>
            <div className="actions">
              <button type="submit" className="bouton bouton--compact bouton--discret">Purger les {traces.length} trace{traces.length > 1 ? "s" : ""}</button>
              <span className="legende">Journalisé. Les rapports émis ne sont pas touchés.</span>
            </div>
          </form>
        )}
      </section>
    </>
  );
}
