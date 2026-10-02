import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { actionsJournal, chercherJournal } from "@/lib/journal";
import { PAGE_JOURNAL, adresseJournal, filtreActif, lireFiltreJournal } from "@/lib/journal-filtre";

export const dynamic = "force-dynamic";

/** Heure de Paris, quel que soit le fuseau du serveur : le filtre par jour la suit aussi. */
function heureDeParis(texte: string): string {
  const d = new Date(texte);
  return Number.isNaN(d.getTime())
    ? texte
    : d.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Paris" });
}

export default async function Journal({
  searchParams,
}: {
  /** Question 90 (choix a) : action, période (du, au), cible, et page (`avant`). */
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = (await getSession())!;
  if (session.role !== "admin") redirect("/admin");
  const filtre = lireFiltreJournal(await searchParams);
  const [{ entrees, total, suite }, actions] = await Promise.all([chercherJournal(filtre), actionsJournal()]);
  const actif = filtreActif(filtre);
  // Une action ou une cible du tableau filtre sur elle, les autres filtres gardés, depuis la première page.
  const surAction = (action: string) => adresseJournal(filtre, { action, avant: undefined });
  const surCible = (cible: string) => adresseJournal(filtre, { cible, avant: undefined });
  const derniere = entrees[entrees.length - 1];
  return (
    <>
      <section className="panneau-titre">
        <h1>Journal des actions</h1>
        <p>
          Les actions d&apos;administration, des plus récentes aux plus anciennes, {PAGE_JOURNAL} par page : rôle et
          libellé de profil, jamais une personne. Les visas y figurent avec le nom saisi par le signataire. Les filtres
          parcourent tout le journal ; une action ou une cible du tableau filtre sur elle.
        </p>
      </section>

      {/* Question 90 (choix a, 02/10/2026) : un geste en lot écrit une ligne par question ; les filtres et les pages
          remontent au-delà des 300 dernières lignes. */}
      <form method="get" className="carte filtres-journal" role="search">
        <div className="rangee">
          <label className="champ">
            <span>Action</span>
            <select name="action" defaultValue={filtre.action ?? ""}>
              <option value="">Toutes les actions</option>
              {actions.map((a) => (
                <option key={a.action} value={a.action}>
                  {a.action} ({a.n})
                </option>
              ))}
            </select>
          </label>
          <label className="champ champ--date">
            <span>Du</span>
            <input type="date" name="du" defaultValue={filtre.du ?? ""} />
          </label>
          <label className="champ champ--date">
            <span>Au</span>
            <input type="date" name="au" defaultValue={filtre.au ?? ""} />
          </label>
          <label className="champ">
            <span>Cible</span>
            <input
              type="search"
              name="cible"
              defaultValue={filtre.cible ?? ""}
              maxLength={100}
              placeholder="identifiant de question, de module…"
            />
          </label>
        </div>
        <div className="actions">
          <button type="submit" className="bouton bouton--compact bouton--secondaire">
            Filtrer
          </button>
          <span className="legende" role="status">
            {total} ligne{total > 1 ? "s" : ""}
            {actif ? (total > 1 ? " retenues" : " retenue") : " au journal"}
            {entrees.length > 0 && total > entrees.length ? ` · ${entrees.length} sur cette page` : ""}
          </span>
          {actif && (
            <Link href="/admin/journal" className="legende">
              Tout effacer
            </Link>
          )}
        </div>
      </form>

      <table className="tableau tableau-journal">
        <thead><tr><th>Quand</th><th>Profil</th><th>Action</th><th>Cible</th><th>Détails</th></tr></thead>
        <tbody>
          {entrees.map((e) => (
            <tr key={e.id}>
              <td>{heureDeParis(e.quand)}</td>
              <td>{e.role} · {e.libelle}</td>
              <td>
                <Link href={surAction(e.action)} title="Filtrer sur cette action">
                  <code>{e.action}</code>
                </Link>
              </td>
              <td>
                {e.cible ? (
                  <Link href={surCible(e.cible)} title="Filtrer sur cette cible">
                    {e.cible}
                  </Link>
                ) : null}
              </td>
              <td className="legende">{Object.keys(e.details).length ? JSON.stringify(e.details) : ""}</td>
            </tr>
          ))}
          {entrees.length === 0 && (
            <tr><td colSpan={5} className="legende">{actif ? "Aucune ligne pour ces filtres." : "Journal vide."}</td></tr>
          )}
        </tbody>
      </table>

      {(filtre.avant || suite) && (
        <nav className="pages-journal" aria-label="Pages du journal">
          {filtre.avant ? <Link href={adresseJournal(filtre, { avant: undefined })}>← Les plus récentes</Link> : <span />}
          {suite && derniere ? (
            <Link href={adresseJournal(filtre, { avant: derniere.id })}>Lignes plus anciennes →</Link>
          ) : null}
        </nav>
      )}
    </>
  );
}
