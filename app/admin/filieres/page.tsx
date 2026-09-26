import Link from "next/link";
import { getSession } from "@/lib/auth";
import { getReferentiel, toutesLesFilieres } from "@/content/referentiel-db";
import { metiers, metierOuDefaut } from "@/content/habilitation";
import { getTousModulesAvecDeposes } from "@/content/store";
import { listeBlocs } from "@/content/blocs-db";
import { plageDesBlocs } from "@/content/blocs";
import { codesDeLaFiliere, repartir, SOCLE } from "@/content/programme-filiere";
import { Badge } from "@/components/Badge";
import { FormulaireFiliere, FormulaireNouvelleFiliere, SupprimerDepotFiliere } from "../referentiel/formulaires";
import { ERREURS, MESSAGES } from "../referentiel/messages";

export const dynamic = "force-dynamic";

/**
 * Filières (question 80, choix a, 25/09/2026) : une page par filière, pour
 * la créer, la modifier et composer son programme. Depuis la question 81
 * (choix a, 26/09/2026), cette liste reprend aussi la moitié « filières » de
 * l'ancien Référentiel : chaque carte se modifie sur place. Rangées par
 * métier ; les filières désactivées restent listées, pour être rouvertes.
 */
export default async function Filieres({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; erreur?: string }>;
}) {
  const p = await searchParams;
  const session = (await getSession())!;
  const estAdmin = session.role === "admin";
  const [liste, { niveaux }, modulesTous, blocs] = await Promise.all([
    toutesLesFilieres(),
    getReferentiel(),
    getTousModulesAvecDeposes(),
    listeBlocs(),
  ]);
  const plageBlocs = plageDesBlocs(blocs);
  const modules = modulesTous.filter((m) => m.statut !== "retire");
  const programme = (id: string) => {
    const r = repartir(modules, id);
    return id === SOCLE ? r.troncCommun.length : r.dans.length;
  };
  const erreur = p.erreur === "filiere-inconnue" ? "Filière inconnue." : p.erreur ? ERREURS[p.erreur] : undefined;

  return (
    <>
      <section className="panneau-titre">
        <p className="legende" style={{ margin: 0 }}>Squelette de la formation</p>
        <h1>Filières</h1>
        <p>
          Les profils de poste, rangés par métier. La fiche d&apos;habilitation livrée avec le site reste la
          référence : une filière déposée la <strong>corrige</strong> quand son identifiant existe déjà, et
          l&apos;<strong>étend</strong> sinon. Chaque filière a sa page — fiche, niveaux, programme de modules
          et ce qui la cite. Les rapports déjà émis portent leur propre copie des libellés : les modifier ici
          ne les réécrit pas.
        </p>
      </section>

      {p.ok && MESSAGES[p.ok] && <p className="encart encart--ok">{MESSAGES[p.ok]}</p>}
      {erreur && <p className="encart encart--attention" role="alert">{erreur}</p>}
      {!estAdmin && (
        <p className="encart encart--attention">Consultation seule : une filière se modifie avec un code d&apos;administration.</p>
      )}

      <section className="section">
        <ul className="liste-nue">
          {metiers.flatMap((m) => {
            const siennes = liste.filter((x) => metierOuDefaut(x.filiere.metier).id === m.id);
            return [
              <li key={`metier-${m.id}`}>
                <h2 style={{ fontSize: "1.05rem", margin: ".75rem 0 0" }}>{m.libelle}</h2>
                {siennes.length === 0 && (
                  <p className="legende" style={{ margin: ".25rem 0 0" }}>
                    Aucune filière pour ce métier{estAdmin ? " : l'ajouter ci-dessous, avec ce métier" : ""}.
                  </p>
                )}
              </li>,
              ...siennes.map(({ filiere: f, depot, fiche, active }) => {
                const n = programme(f.id);
                // Lus au référentiel servi : une filière désactivée garde ses niveaux.
                const codes = codesDeLaFiliere(niveaux, f.id);
                return (
                  <li key={f.id} className="carte">
                    <div className="etape-tete">
                      <Badge nom={f.badge} />
                      <strong>
                        <Link href={`/admin/filieres/${encodeURIComponent(f.id)}`}>{f.libelle}</Link>
                      </strong>
                      <code className="legende">{f.id}</code>
                      <span className={`etiquette ${fiche && !depot ? "etiquette--site" : active ? "etiquette--ok" : "etiquette--neutre"}`}>
                        {!active ? (fiche ? "Fiche, désactivée" : "Déposée, inactive") : depot ? (fiche ? "Fiche, corrigée" : "Déposée") : "Fiche"}
                      </span>
                    </div>
                    {f.description && <p className="legende">{f.description}</p>}
                    <p className="legende" style={{ margin: ".25rem 0 0" }}>
                      {n} module{n > 1 ? "s" : ""} {f.id === SOCLE ? "au tronc commun" : "au programme"}
                      {codes.length > 0 ? ` · niveaux : ${codes.join(", ")}` : " · aucun niveau"}
                    </p>
                    {estAdmin && (
                      <details>
                        <summary className="legende">Modifier</summary>
                        <FormulaireFiliere filiere={f} rang={depot?.rang ?? 0} actif={active} fiche={fiche} plageBlocs={plageBlocs} />
                        {depot && <SupprimerDepotFiliere id={f.id} />}
                      </details>
                    )}
                  </li>
                );
              }),
            ];
          })}
        </ul>
        {estAdmin && <FormulaireNouvelleFiliere plageBlocs={plageBlocs} retour="filieres" />}
      </section>
    </>
  );
}
