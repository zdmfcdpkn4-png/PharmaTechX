import Link from "next/link";
import { getSession } from "@/lib/auth";
import { conservationActive, miseEnService } from "@/lib/config";
import { CopierMention } from "@/components/CopierMention";
import { mentionDePreuve } from "@/lib/mention";
import { LIBELLES_COURTS_VERDICT } from "@/lib/decision";
import {
  LIBELLES_STATUT_RAPPORT,
  compterPurgeables,
  comptesRapports,
  listerRapports,
  type StatutRapport,
} from "@/lib/rapports";
import { decisionEnregistree } from "@/lib/registre";
import { actionPurgerAvant } from "./actions";
import { getTousModulesAvecDeposes } from "@/content/store";
import { moduleOuvrable } from "../questions/commun";
import { LienModule } from "@/components/LienModule";

export const dynamic = "force-dynamic";

const STATUTS: StatutRapport[] = ["emis", "vise_tuteur", "clos", "annule"];

const MESSAGES: Record<string, string> = {
  date: "Indiquez une date valide (AAAA-MM-JJ).",
  confirmation: "Recopiez le mot PURGER pour confirmer.",
};

export default async function Rapports({
  searchParams,
}: {
  searchParams: Promise<{ statut?: string; ok?: string; n?: string; erreur?: string; avant?: string }>;
}) {
  const p = await searchParams;
  if (!conservationActive()) {
    return (
      <>
        <section className="panneau-titre">
          <h1>Rapports d&apos;évaluation</h1>
          <p>La conservation des rapports n&apos;est pas activée.</p>
        </section>
        <p className="encart">
          Dans ce mode, le rapport est construit sur le poste de l&apos;apprenant, imprimé et signé
          sur papier ; rien n&apos;est enregistré. Pour activer l&apos;enregistrement sous identifiant
          d&apos;agent et le circuit de visas, définir <code>CONSERVATION_RAPPORTS=pseudonyme</code> —
          après inscription du traitement au registre (voir <code>docs/RGPD.md</code>).
        </p>
      </>
    );
  }
  const statut = STATUTS.includes(p.statut as StatutRapport) ? (p.statut as StatutRapport) : undefined;
  const [rapports, comptes, session, modules] = await Promise.all([
    listerRapports({ statut }),
    comptesRapports(),
    getSession(),
    getTousModulesAvecDeposes(),
  ]);
  const enService = miseEnService();
  const avant = p.avant && /^\d{4}-\d{2}-\d{2}$/.test(p.avant) ? p.avant : "";
  const purgeables = avant ? await compterPurgeables(new Date(`${avant}T00:00:00+02:00`)) : null;
  const message = p.ok === "purge"
    ? `${p.n ?? "0"} rapport${Number(p.n) > 1 ? "s" : ""} supprimé${Number(p.n) > 1 ? "s" : ""} définitivement ; les numéros sont au journal.`
    : p.erreur
      ? MESSAGES[p.erreur]
      : null;

  return (
    <>
      <section className="panneau-titre">
        <h1>Rapports d&apos;évaluation</h1>
        <p>
          Rapports émis par les apprenants sous leur identifiant d&apos;agent, numérotés et scellés.
          Circuit : arbitrage du tuteur si le verdict est indéterminé, visa du
          tuteur, puis visa du pharmacien responsable, qui clôt le rapport avec sa signature. Un
          rapport ne se modifie pas : il s&apos;annule avec un motif, et l&apos;apprenant en émet un nouveau.
        </p>
        <div className="actions" style={{ marginTop: 0 }}>
          <a href="/admin/rapports/registre.csv" className="bouton bouton--secondaire">Registre cumulatif (CSV)</a>
          <Link href="/admin/personnel" className="bouton bouton--secondaire">Personnel &amp; historique</Link>
        </div>
      </section>

      {message && (
        <p className={`encart ${p.ok ? "encart--ok" : "encart--attention"}`} role="status">{message}</p>
      )}

      <nav className="nav-sections" aria-label="Filtre par statut" style={{ marginLeft: 0 }}>
        <Link href="/admin/rapports" className={`bouton bouton--compact ${statut ? "bouton--discret" : ""}`}>
          Tous
        </Link>
        {STATUTS.map((s) => (
          <Link key={s} href={`/admin/rapports?statut=${s}`} className={`bouton bouton--compact ${statut === s ? "" : "bouton--discret"}`}>
            {LIBELLES_STATUT_RAPPORT[s].split(" — ")[0]} ({comptes[s]})
          </Link>
        ))}
      </nav>

      <table className="tableau">
        <thead>
          <tr>
            <th>N°</th>
            <th>Émis le</th>
            <th>Agent</th>
            <th>Critère</th>
            <th>Résultat</th>
            <th>Statut</th>
            <th>Mention</th>
          </tr>
        </thead>
        <tbody>
          {rapports.map((r) => {
            const { decision, verdictFinal } = decisionEnregistree(r);
            return (
              <tr key={r.id}>
                <td><Link href={`/admin/rapports/${r.id}`}>{r.numero}</Link></td>
                <td>{new Date(r.emis_le).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}</td>
                <td><code>{r.agent_identifiant}</code></td>
                <td>
                  {r.critere_id ?? "—"}{" "}
                  <span className="legende">
                    <LienModule id={moduleOuvrable(modules, r.module_id)}>{r.module_titre.slice(0, 50)}</LienModule>
                  </span>
                </td>
                <td>
                  {decision.score} % · {LIBELLES_COURTS_VERDICT[verdictFinal]}
                  {r.arbitrage ? <span className="legende"> (arbitré)</span> : null}
                  {decision.verdictBrut === "indetermine" && !r.arbitrage && r.statut === "emis" ? <span className="legende"> — arbitrage attendu</span> : null}
                </td>
                <td><span className={`etiquette ${r.statut === "clos" ? "etiquette--ok" : r.statut === "annule" ? "etiquette--neutre" : "etiquette--attention"}`}>{LIBELLES_STATUT_RAPPORT[r.statut].split(" — ")[0]}</span></td>
                <td>
                  {(() => {
                    const m = mentionDePreuve(
                      {
                        numero: r.numero,
                        moduleTitre: r.module_titre,
                        emisLe: r.emis_le,
                        statut: r.statut,
                        score: decision.score,
                        verdict: LIBELLES_COURTS_VERDICT[verdictFinal],
                      },
                      { miseEnService: enService },
                    );
                    return "texte" in m ? <CopierMention texte={m.texte} compact /> : <span className="legende">—</span>;
                  })()}
                </td>
              </tr>
            );
          })}
          {rapports.length === 0 && (
            <tr><td colSpan={7} className="legende">Aucun rapport.</td></tr>
          )}
        </tbody>
      </table>

      {session?.role === "admin" && (
        <section className="carte" style={{ marginTop: "1.5rem" }}>
          <h3>Purge manuelle</h3>
          <p className="legende">
            Aucune purge automatique (décision du 18/09/2026) : les rapports sont conservés jusqu&apos;à ce
            que l&apos;administrateur les supprime. Seuls les rapports clos ou annulés sont concernés ;
            un rapport en circuit n&apos;est jamais purgé. Comptez d&apos;abord, puis confirmez.
          </p>
          <form method="get" action="/admin/rapports">
            <div className="rangee">
              <label className="champ">
                <span>Rapports émis avant le</span>
                <input type="date" name="avant" defaultValue={avant} required />
              </label>
            </div>
            <div className="actions">
              <button type="submit" className="bouton bouton--compact bouton--secondaire">Compter</button>
            </div>
          </form>
          {avant && purgeables !== null && (
            <form action={actionPurgerAvant} style={{ marginTop: "1rem" }}>
              <input type="hidden" name="avant" value={avant} />
              <p className="encart encart--attention" role="status">
                <strong>{purgeables}</strong> rapport{purgeables > 1 ? "s" : ""} clos ou annulé{purgeables > 1 ? "s" : ""} émis avant le{" "}
                {new Date(`${avant}T12:00:00`).toLocaleDateString("fr-FR")} {purgeables > 1 ? "seraient supprimés" : "serait supprimé"}.
                Téléchargez les paquets d&apos;archivage nécessaires avant.
              </p>
              <label className="champ">
                <span>Recopiez PURGER pour confirmer</span>
                <input type="text" name="confirmation" required maxLength={10} autoComplete="off" />
              </label>
              <div className="actions">
                <button type="submit" className="bouton bouton--secondaire" disabled={purgeables === 0}>
                  Supprimer définitivement
                </button>
              </div>
            </form>
          )}
        </section>
      )}
    </>
  );
}
