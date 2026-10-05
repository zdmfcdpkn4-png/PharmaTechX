import Link from "next/link";
import { conservationActive } from "@/lib/config";
import { LIBELLES_COURTS_VERDICT } from "@/lib/decision";
import { listerAgents } from "@/lib/agents";
import { normaliserIdentifiant } from "@/lib/identifiant";
import { LIBELLES_STATUT_RAPPORT, repertoirePersonnel } from "@/lib/rapports";
import { decisionEnregistree } from "@/lib/registre";
import { actionBasculerAgent, actionCreerAgent, actionReinitialiserCode } from "./actions";
import { BoutonEnvoi } from "@/components/BoutonEnvoi";
import { LienModule } from "@/components/LienModule";
import { getTousModulesAvecDeposes } from "@/content/store";
import { moduleOuvrable } from "../questions/commun";
import { BarreFiltres } from "@/components/BarreFiltres";
import { VERDICTS_RAPPORT, ligneRepertoireRetenue, lireFiltrePersonnel } from "@/content/filtres-listes";
import { adresseDuFiltre } from "@/content/filtres";

export const dynamic = "force-dynamic";

const MESSAGES: Record<string, (identifiant: string) => string> = {
  cree: (i) => `Identifiant ${i} créé. Notez la correspondance avec l'agent dans la liste tenue hors du site, puis remettez-lui l'identifiant : c'est ce qu'il saisira pour émettre ses rapports. Relié à un code de poste (Codes d'accès), il n'aura plus que son code personnel à saisir.`,
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
  /** `agent` : partie d'un identifiant ; question 91 (lot 3) : critère, verdict. */
  searchParams: Promise<{ agent?: string; ok?: string; identifiant?: string; [cle: string]: string | string[] | undefined }>;
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
  const [toutes, agents, modules] = await Promise.all([repertoirePersonnel(), listerAgents(), getTousModulesAvecDeposes()]);
  // Filtres du répertoire (question 91, choix a, lot 3) : la barre de la banque. La recherche garde son
  // paramètre (`agent`) et sa lecture : « ag 1 » vaut AG-001.
  const criteresVus = [...new Set(toutes.map((l) => l.critere))].sort((a, b) => a.localeCompare(b, "fr", { numeric: true }));
  const filtrePersonnel = lireFiltrePersonnel(p, criteresVus);
  const filtre = normaliserIdentifiant(filtrePersonnel.agent) ?? filtrePersonnel.agent.toUpperCase();
  const lignes = toutes
    .map((l) => ({ l, ...decisionEnregistree(l) }))
    .filter((x) => ligneRepertoireRetenue({ agent_identifiant: x.l.agent_identifiant, critere: x.l.critere, verdict: x.verdictFinal }, filtrePersonnel, filtre));
  const avecRapports = new Set(toutes.map((l) => l.agent_identifiant)).size;
  // Clore, rouvrir, réinitialiser un code reviennent au répertoire tel qu'il est filtré (question 92, choix a).
  const liste = adresseDuFiltre("/admin/personnel", filtrePersonnel);
  const message = p.ok && MESSAGES[p.ok] ? MESSAGES[p.ok](p.identifiant ?? "") : null;

  return (
    <>
      <section className="panneau-titre">
        <h1>Personnel &amp; historique</h1>
        <p>
          Pour chaque agent, désigné par son seul identifiant, le dernier rapport de chaque critère et son verdict.
          L&apos;habilitation se prononce hors du site, sur la fiche d&apos;habilitation.
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
          Le site génère l&apos;identifiant (AG-001, AG-002…) ; la correspondance avec les personnes est tenue par le
          pharmacien responsable, hors du site. Un identifiant se clôt au départ de
          l&apos;agent ; il ne se supprime pas tant que des rapports s&apos;y rattachent. L&apos;agent
          rattache sa progression avec un code personnel qu&apos;il choisit (question 11) ; oublié,
          il se réinitialise ici.
        </p>
        <form action={actionCreerAgent}>
          <div className="actions" style={{ marginTop: 0 }}>
            <BoutonEnvoi>Créer un identifiant</BoutonEnvoi>
          </div>
        </form>
        {agents.length > 0 && (
          <table className="tableau" style={{ marginTop: "1rem" }}>
            <thead>
              <tr><th>Identifiant</th><th>Créé le</th><th>État</th><th>Code de poste</th><th>Rapports</th><th>Progression</th><th>Code personnel</th><th></th></tr>
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
                  {/* Codes de poste reliés à l'identifiant (question 99, choix a) ; vide : il se rattache sous un code partagé. */}
                  <td>
                    {a.codes_relies.length > 0 ? (
                      a.codes_relies.join(", ")
                    ) : (
                      <span className="legende">partagé</span>
                    )}
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
                        <input type="hidden" name="liste" value={liste} />
                        <button type="submit" className="bouton bouton--compact bouton--discret">Réinitialiser</button>
                      </form>
                    )}
                  </td>
                  <td>
                    <form action={actionBasculerAgent}>
                      <input type="hidden" name="id" value={a.id} />
                      <input type="hidden" name="liste" value={liste} />
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
      <div className="section-titre">
        <h2>Répertoire</h2>
        <span className="compte">{avecRapports} agent{avecRapports > 1 ? "s" : ""} avec rapport · {toutes.length} ligne{toutes.length > 1 ? "s" : ""}</span>
      </div>
      {toutes.length > 0 && (
        <BarreFiltres
          adresse="/admin/personnel"
          recherche={{ nom: "agent", valeur: filtrePersonnel.agent, placeholder: "Identifiant d'agent : AG-001" }}
          champs={[
            {
              nom: "critere",
              libelle: "Critère",
              options: criteresVus.map((c) => ({ valeur: c, libelle: c })),
              valeur: filtrePersonnel.critere,
            },
            {
              nom: "verdict",
              libelle: "Verdict",
              options: VERDICTS_RAPPORT.map((v) => ({
                valeur: v,
                libelle: LIBELLES_COURTS_VERDICT[v].charAt(0).toUpperCase() + LIBELLES_COURTS_VERDICT[v].slice(1),
              })),
              valeur: filtrePersonnel.verdict,
              minuscule: true,
            },
          ]}
          retenus={lignes.length}
          total={toutes.length}
          unite={["ligne", "lignes"]}
        />
      )}
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
          {lignes.map(({ l, decision, verdictFinal }) => {
            return (
              <tr key={`${l.agent_identifiant}#${l.critere}`}>
                <td><code>{l.agent_identifiant}</code>{l.agent_actif ? null : <span className="legende"> — clos</span>}</td>
                <td>
                  {l.critere}{" "}
                  <span className="legende">
                    <LienModule id={moduleOuvrable(modules, l.resultat?.moduleId)}>{l.module_titre.slice(0, 50)}</LienModule>
                  </span>
                </td>
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
            <tr><td colSpan={6} className="legende">{toutes.length === 0 ? "Aucun rapport enregistré." : "Aucune ligne ne correspond à ces filtres."}</td></tr>
          )}
        </tbody>
      </table>
    </>
  );
}
