import Link from "next/link";
import { conservationNominative } from "@/lib/config";
import { LIBELLES_STATUT_RAPPORT, comptesRapports, listerRapports, type StatutRapport } from "@/lib/rapports";

export const dynamic = "force-dynamic";

const STATUTS: StatutRapport[] = ["emis", "vise_tuteur", "clos", "annule"];

export default async function Rapports({
  searchParams,
}: {
  searchParams: Promise<{ statut?: string }>;
}) {
  const p = await searchParams;
  if (!conservationNominative()) {
    return (
      <>
        <section className="panneau-titre">
          <h1>Rapports d&apos;évaluation</h1>
          <p>La conservation des rapports n&apos;est pas activée.</p>
        </section>
        <p className="encart">
          Dans ce mode, le rapport est construit sur le poste de l&apos;apprenant, imprimé et signé
          sur papier ; rien de nominatif n&apos;est enregistré. Pour activer l&apos;enregistrement
          et le circuit de visas, définir <code>CONSERVATION_RAPPORTS=nominative</code> — après
          inscription du traitement au registre et décision sur la durée de conservation.
        </p>
      </>
    );
  }
  const statut = STATUTS.includes(p.statut as StatutRapport) ? (p.statut as StatutRapport) : undefined;
  const [rapports, comptes] = await Promise.all([listerRapports({ statut }), comptesRapports()]);

  return (
    <>
      <section className="panneau-titre">
        <h1>Rapports d&apos;évaluation</h1>
        <p>
          Rapports émis par les apprenants, numérotés et scellés. Circuit : visa du tuteur, puis
          visa du pharmacien responsable. Un rapport ne se modifie pas : il s&apos;annule avec un
          motif, et l&apos;apprenant en émet un nouveau.
        </p>
      </section>

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
            <th>Apprenant</th>
            <th>Critère</th>
            <th>Résultat</th>
            <th>Statut</th>
          </tr>
        </thead>
        <tbody>
          {rapports.map((r) => (
            <tr key={r.id}>
              <td><Link href={`/admin/rapports/${r.id}`}>{r.numero}</Link></td>
              <td>{new Date(r.emis_le).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}</td>
              <td>{r.apprenant_nom}{r.apprenant_qualite ? <span className="legende"> — {r.apprenant_qualite}</span> : null}</td>
              <td>{r.critere_id ?? "—"} <span className="legende">{r.module_titre.slice(0, 50)}</span></td>
              <td>{r.resultat.score} % · {r.resultat.reussi ? "acquis" : "non acquis"}</td>
              <td><span className={`etiquette ${r.statut === "clos" ? "etiquette--ok" : r.statut === "annule" ? "etiquette--neutre" : "etiquette--attention"}`}>{LIBELLES_STATUT_RAPPORT[r.statut].split(" — ")[0]}</span></td>
            </tr>
          ))}
          {rapports.length === 0 && (
            <tr><td colSpan={6} className="legende">Aucun rapport.</td></tr>
          )}
        </tbody>
      </table>
    </>
  );
}
