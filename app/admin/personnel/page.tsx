import Link from "next/link";
import { conservationActive } from "@/lib/config";
import { LIBELLES_COURTS_VERDICT } from "@/lib/decision";
import { listerAgents } from "@/lib/agents";
import { normaliserIdentifiant } from "@/lib/identifiant";
import { LIBELLES_STATUT_RAPPORT, repertoirePersonnel } from "@/lib/rapports";
import { decisionEnregistree } from "@/lib/registre";
import { actionBasculerAgent, actionCreerAgent, actionReinitialiserCode } from "./actions";

export const dynamic = "force-dynamic";

const MESSAGES: Record<string, (identifiant: string) => string> = {
  cree: (i) => `Identifiant ${i} créé. Notez la correspondance avec l'agent dans la liste tenue hors du site, puis remettez-lui l'identifiant : c'est ce qu'il saisira pour émettre ses rapports.`,
  clos: (i) => `Identifiant ${i} clos : plus aucun rapport ne peut lui être rattaché ; son historique reste jusqu'à purge manuelle.`,
  rouvert: (i) => `Identifiant ${i} rouvert.`,
  code: (i) => `Code personnel de ${i} réinitialisé : l'agent en choisira un nouveau à son prochain rattachement.`,
};

function date(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR");
}

/**
 * Personnel & historique — l'équivalent de « Parc & historique » de la
 * console métrologique : une ligne par agent et par critère, construite
 * depuis les rapports enregistrés, exportable en CSV. Les agents n'y sont
 * désignés que par leur identifiant (décision du 18/09/2026, question 6,
 * choix a) ; la correspondance avec les personnes se tient hors du site.
 */
export default async function Personnel({
  searchParams,
}: {
  searchParams: Promise<{ agent?: string; ok?: string; identifiant?: string }>;
}) {
  const p = await searchParams;
  if (!conservationActive()) {
    return (
      <>
        <section className="panneau-titre">
          <h1>Personnel &amp; historique</h1>
          <p>La conservation des rapports n&apos;est pas activée : aucun répertoire n&apos;existe.</p>
        </section>
      </>
    );
  }
  const [toutes, agents] = await Promise.all([repertoirePersonnel(), listerAgents()]);
  const saisie = (p.agent ?? "").trim();
  const filtre = normaliserIdentifiant(saisie) ?? saisie.toUpperCase();
  const lignes = filtre ? toutes.filter((l) => l.agent_identifiant.includes(filtre)) : toutes;
  const avecRapports = new Set(toutes.map((l) => l.agent_identifiant)).size;
  const message = p.ok && MESSAGES[p.ok] ? MESSAGES[p.ok](p.identifiant ?? "") : null;

  return (
    <>
      <section className="panneau-titre">
        <h1>Personnel &amp; historique</h1>
        <p>
          Répertoire de traçabilité construit depuis les rapports enregistrés : pour chaque agent et
          chaque critère, le dernier rapport non annulé, son verdict et le nombre de rapports clos.
          Les agents n&apos;apparaissent que par leur identifiant ; la correspondance avec les personnes
          est tenue par le pharmacien responsable, hors du site. L&apos;habilitation elle-même se
          prononce hors de l&apos;application, sur la fiche d&apos;habilitation.
        </p>
        <div className="actions" style={{ marginTop: 0 }}>
          <a href="/admin/personnel/repertoire.csv" className="bouton bouton--secondaire">Exporter le répertoire (CSV)</a>
        </div>
      </section>

      {message && <p className="encart encart--ok" role="status">{message}</p>}

      {/* ───────────────────────────────────────────── identifiants */}
      <div className="section-titre">
        <h2>Identifiants d&apos;agents</h2>
        <span className="compte">{agents.length} identifiant{agents.length > 1 ? "s" : ""} · {agents.filter((a) => a.actif).length} actif{agents.filter((a) => a.actif).length > 1 ? "s" : ""}</span>
      </div>
      <section className="carte">
        <p className="legende">
          Le site génère l&apos;identifiant (AG-001, AG-002…). Un identifiant se clôt au départ de
          l&apos;agent ; il ne se supprime pas tant que des rapports s&apos;y rattachent. L&apos;agent
          rattache sa progression avec un code personnel qu&apos;il choisit (question 11) ; oublié,
          il se réinitialise ici.
        </p>
        <form action={actionCreerAgent}>
          <div className="actions" style={{ marginTop: 0 }}>
            <button type="submit" className="bouton">Créer un identifiant</button>
          </div>
        </form>
        {agents.length > 0 && (
          <table className="tableau" style={{ marginTop: "1rem" }}>
            <thead>
              <tr><th>Identifiant</th><th>Créé le</th><th>État</th><th>Rapports</th><th>Progression</th><th>Code personnel</th><th></th></tr>
            </thead>
            <tbody>
              {agents.map((a) => (
                <tr key={a.id}>
                  <td><code>{a.identifiant}</code></td>
                  <td>{date(a.cree_le)}</td>
                  <td>
                    <span className={`etiquette ${a.actif ? "etiquette--ok" : "etiquette--neutre"}`}>{a.actif ? "actif" : "clos"}</span>
                    {!a.actif && a.clos_le ? <span className="legende"> le {date(a.clos_le)}</span> : null}
                  </td>
                  <td>
                    {a.nb_rapports > 0 ? <Link href={`/admin/personnel?agent=${a.identifiant}`}>{a.nb_rapports}</Link> : "0"}
                  </td>
                  <td>
                    <Link href={`/admin/personnel/${a.id}`}>{a.nb_traces} trace{a.nb_traces > 1 ? "s" : ""}</Link>
                    {a.derniere_activite ? <span className="legende"> · {date(a.derniere_activite)}</span> : null}
                  </td>
                  <td>
                    <span className={`etiquette ${a.code_defini ? "etiquette--ok" : "etiquette--neutre"}`}>{a.code_defini ? "défini" : "absent"}</span>{" "}
                    {a.code_defini && (
                      <form action={actionReinitialiserCode} style={{ display: "inline" }}>
                        <input type="hidden" name="id" value={a.id} />
                        <button type="submit" className="bouton bouton--compact bouton--discret">Réinitialiser</button>
                      </form>
                    )}
                  </td>
                  <td>
                    <form action={actionBasculerAgent}>
                      <input type="hidden" name="id" value={a.id} />
                      <input type="hidden" name="actif" value={a.actif ? "0" : "1"} />
                      <button type="submit" className="bouton bouton--compact bouton--secondaire">{a.actif ? "Clore" : "Rouvrir"}</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* ─────────────────────────────────────────────── répertoire */}
      <form method="get" className="carte" style={{ marginBottom: "1rem" }}>
        <div className="rangee">
          <label className="champ">
            <span>Agent</span>
            <input type="search" name="agent" defaultValue={p.agent ?? ""} placeholder="AG-001" />
          </label>
        </div>
        <div className="actions">
          <button type="submit" className="bouton bouton--compact">Filtrer</button>
          {filtre && <Link href="/admin/personnel" className="bouton bouton--compact bouton--secondaire">Tous</Link>}
        </div>
      </form>

      <div className="section-titre">
        <h2>Répertoire</h2>
        <span className="compte">{avecRapports} agent{avecRapports > 1 ? "s" : ""} avec rapport · {toutes.length} ligne{toutes.length > 1 ? "s" : ""}</span>
      </div>
      <table className="tableau">
        <thead>
          <tr>
            <th>Agent</th>
            <th>Critère</th>
            <th>Dernier rapport</th>
            <th>Résultat</th>
            <th>Statut</th>
            <th>Rapports</th>
          </tr>
        </thead>
        <tbody>
          {lignes.map((l) => {
            const { decision, verdictFinal } = decisionEnregistree(l);
            return (
              <tr key={`${l.agent_identifiant}#${l.critere}`}>
                <td><code>{l.agent_identifiant}</code>{l.agent_actif ? null : <span className="legende"> — clos</span>}</td>
                <td>{l.critere} <span className="legende">{l.module_titre.slice(0, 50)}</span></td>
                <td>
                  <Link href={`/admin/rapports/${l.id}`}>{l.numero}</Link>
                  <br />
                  <span className="legende">{date(l.emis_le)}</span>
                </td>
                <td>{decision.score} % · {LIBELLES_COURTS_VERDICT[verdictFinal]}</td>
                <td><span className={`etiquette ${l.statut === "clos" ? "etiquette--ok" : "etiquette--attention"}`}>{LIBELLES_STATUT_RAPPORT[l.statut].split(" — ")[0]}</span></td>
                <td>{l.nb_clos} clos / {l.nb_rapports}</td>
              </tr>
            );
          })}
          {lignes.length === 0 && (
            <tr><td colSpan={6} className="legende">Aucun rapport enregistré{filtre ? " pour ce filtre" : ""}.</td></tr>
          )}
        </tbody>
      </table>
    </>
  );
}
