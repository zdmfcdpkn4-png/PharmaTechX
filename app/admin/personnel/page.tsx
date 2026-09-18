import Link from "next/link";
import { conservationNominative } from "@/lib/config";
import { LIBELLES_COURTS_VERDICT } from "@/lib/decision";
import { LIBELLES_STATUT_RAPPORT, repertoirePersonnel } from "@/lib/rapports";
import { decisionEnregistree } from "@/lib/registre";

export const dynamic = "force-dynamic";

/**
 * Personnel & historique — l'équivalent de « Parc & historique » de la
 * console métrologique : une ligne par agent et par critère, construite
 * depuis les rapports enregistrés, exportable en CSV.
 */
export default async function Personnel({
  searchParams,
}: {
  searchParams: Promise<{ agent?: string }>;
}) {
  const p = await searchParams;
  if (!conservationNominative()) {
    return (
      <>
        <section className="panneau-titre">
          <h1>Personnel &amp; historique</h1>
          <p>La conservation des rapports n&apos;est pas activée : aucun répertoire nominatif n&apos;existe.</p>
        </section>
      </>
    );
  }
  const toutes = await repertoirePersonnel();
  const filtre = (p.agent ?? "").trim().toLowerCase();
  const lignes = filtre ? toutes.filter((l) => l.apprenant_nom.toLowerCase().includes(filtre)) : toutes;
  const agents = new Set(toutes.map((l) => l.apprenant_nom)).size;

  return (
    <>
      <section className="panneau-titre">
        <h1>Personnel &amp; historique</h1>
        <p>
          Répertoire de traçabilité construit depuis les rapports enregistrés : pour chaque agent et
          chaque critère, le dernier rapport non annulé, son verdict et le nombre de rapports clos.
          L&apos;habilitation elle-même se prononce hors de l&apos;application, sur la fiche d&apos;habilitation.
        </p>
        <div className="actions" style={{ marginTop: 0 }}>
          <a href="/admin/personnel/repertoire.csv" className="bouton bouton--secondaire">Exporter le répertoire (CSV)</a>
        </div>
      </section>

      <form method="get" className="carte" style={{ marginBottom: "1rem" }}>
        <div className="rangee">
          <label className="champ">
            <span>Agent</span>
            <input type="search" name="agent" defaultValue={p.agent ?? ""} placeholder="Nom ou partie du nom" />
          </label>
        </div>
        <div className="actions">
          <button type="submit" className="bouton bouton--compact">Filtrer</button>
          {filtre && <Link href="/admin/personnel" className="bouton bouton--compact bouton--secondaire">Tous</Link>}
        </div>
      </form>

      <div className="section-titre">
        <h2>Répertoire</h2>
        <span className="compte">{agents} agent{agents > 1 ? "s" : ""} · {toutes.length} ligne{toutes.length > 1 ? "s" : ""}</span>
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
              <tr key={`${l.apprenant_nom}#${l.critere}`}>
                <td>{l.apprenant_nom}{l.apprenant_qualite ? <span className="legende"> — {l.apprenant_qualite}</span> : null}</td>
                <td>{l.critere} <span className="legende">{l.module_titre.slice(0, 50)}</span></td>
                <td>
                  <Link href={`/admin/rapports/${l.id}`}>{l.numero}</Link>
                  <br />
                  <span className="legende">{new Date(l.emis_le).toLocaleDateString("fr-FR")}</span>
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
