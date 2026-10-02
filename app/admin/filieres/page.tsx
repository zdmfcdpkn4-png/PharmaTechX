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
import { BarreFiltres } from "@/components/BarreFiltres";
import { entreeReferentielRetenue, lireFiltreReferentiel } from "@/content/filtres-listes";
import { adresseDuFiltre } from "@/content/filtres";

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
  /** Question 91 (lot 3) : recherche, métier. */
  searchParams: Promise<{ ok?: string; erreur?: string; [cle: string]: string | string[] | undefined }>;
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
  // Filtres (question 91, choix a, lot 3) : métier et recherche (libellé, identifiant, description).
  const filtre = lireFiltreReferentiel(p, metiers.map((m) => m.id));
  const filtreActif = Boolean(filtre.q || filtre.metier);
  const retenue = (x: (typeof liste)[number]) =>
    entreeReferentielRetenue(
      { texte: `${x.filiere.libelle} ${x.filiere.id} ${x.filiere.description ?? ""}`, metier: metierOuDefaut(x.filiere.metier).id },
      filtre,
    );
  const retenues = liste.filter(retenue);
  // Modifier ou supprimer le dépôt revient à cette liste, filtre compris (question 92, choix a).
  const adresseListe = adresseDuFiltre("/admin/filieres", filtre);

  return (
    <>
      <section className="panneau-titre">
        <p className="legende" style={{ margin: 0 }}>Squelette de la formation</p>
        <h1>Filières</h1>
        <p>
          Les profils de poste, rangés par métier ; chacun a sa page : fiche, niveaux, programme. Modifier un libellé ne
          réécrit pas les rapports déjà émis.
        </p>
      </section>

      {p.ok && MESSAGES[p.ok] && <p className="encart encart--ok">{MESSAGES[p.ok]}</p>}
      {erreur && <p className="encart encart--attention" role="alert">{erreur}</p>}
      {!estAdmin && (
        <p className="encart encart--attention">Consultation seule : une filière se modifie avec un code d&apos;administration.</p>
      )}

      <BarreFiltres
        adresse="/admin/filieres"
        recherche={{ valeur: filtre.q, placeholder: "Libellé ou identifiant" }}
        champs={[
          { nom: "metier", libelle: "Métier", options: metiers.map((m) => ({ valeur: m.id, libelle: m.libelle })), valeur: filtre.metier },
        ]}
        retenus={retenues.length}
        total={liste.length}
        unite={["filière", "filières"]}
      />

      <section className="section">
        <ul className="liste-nue">
          {filtreActif && retenues.length === 0 && <li className="legende">Aucune filière ne correspond à ces filtres.</li>}
          {metiers.flatMap((m) => {
            const siennes = retenues.filter((x) => metierOuDefaut(x.filiere.metier).id === m.id);
            // Sous un filtre, un métier sans filière retenue ne se montre pas.
            if (filtreActif && siennes.length === 0) return [];
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
                        <FormulaireFiliere filiere={f} rang={depot?.rang ?? 0} actif={active} fiche={fiche} plageBlocs={plageBlocs} liste={adresseListe} />
                        {depot && <SupprimerDepotFiliere id={f.id} liste={adresseListe} />}
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
