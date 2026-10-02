import Link from "next/link";
import { codesParProgramme, listerProgrammes } from "@/content/programmes-db";
import { LIBELLES_STATUT_PROGRAMME, MENTION_DEGRADE } from "@/content/programmes";
import { BarreFiltres } from "@/components/BarreFiltres";
import { STATUTS_FILTRE_PROGRAMME, lireFiltreProgrammes, programmeRetenu } from "@/content/filtres-listes";

export const dynamic = "force-dynamic";

function date(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" }) : "";
}

/**
 * Programmes à la carte (question 50, 22/09/2026) : le parcours dégradé des
 * profils qui ne suivent pas la fiche. Tutorat et administration.
 */
export default async function Programmes({
  searchParams,
}: {
  /** Question 91 (lot 3) : recherche, statut. */
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [programmes, codes, p] = await Promise.all([listerProgrammes(), codesParProgramme(), searchParams]);
  const filtre = lireFiltreProgrammes(p);
  const retenus = programmes.filter((x) => programmeRetenu(x, filtre));
  return (
    <>
      <section className="panneau-titre">
        <p className="legende" style={{ margin: 0 }}>Squelette de la formation</p>
        <h1>Programmes à la carte</h1>
        <p>
          Un programme composé à la main pour un profil hors fiche (intérimaire, remplaçant), marqué « {MENTION_DEGRADE} »
          partout. Il n&apos;est proposé qu&apos;une fois validé par le tutorat ou l&apos;administration ; le modifier le
          renvoie en brouillon.
        </p>
        <div className="actions" style={{ marginTop: 0 }}>
          <Link href="/admin/programmes/nouveau" className="bouton">
            Composer un programme
          </Link>
        </div>
      </section>

      {programmes.length === 0 ? (
        <p className="encart">Aucun programme à la carte : les postes suivent la fiche.</p>
      ) : (
        <>
        {/* La barre de la banque (question 91, choix a, lot 3). */}
        <BarreFiltres
          adresse="/admin/programmes"
          recherche={{ valeur: filtre.q, placeholder: "Nom, destinataire ou motif" }}
          champs={[
            {
              nom: "statut",
              libelle: "Statut",
              options: STATUTS_FILTRE_PROGRAMME.map((x) => ({ valeur: x, libelle: LIBELLES_STATUT_PROGRAMME[x].split(" — ")[0] })),
              valeur: filtre.statut,
              minuscule: true,
            },
          ]}
          retenus={retenus.length}
          total={programmes.length}
          unite={["programme", "programmes"]}
        />
        <ul className="liste-nue">
          {retenus.length === 0 && <li className="legende">Aucun programme ne correspond à ces filtres.</li>}
          {retenus.map((x) => (
            <li key={x.id} className="carte programme-ligne">
              <span className="etiquette etiquette--attention">{MENTION_DEGRADE}</span>{" "}
              <strong>
                <Link href={`/admin/programmes/${x.id}`}>{x.nom}</Link>
              </strong>{" "}
              <span className={`etiquette${x.statut === "valide" ? "" : " etiquette--neutre"}`}>
                {LIBELLES_STATUT_PROGRAMME[x.statut]}
              </span>
              <br />
              <span className="legende">
                {x.destinataire ? `${x.destinataire} · ` : ""}
                {x.modules.length} module{x.modules.length > 1 ? "s" : ""}
                {x.statut === "valide" && x.validePar ? ` · validé par ${x.validePar} le ${date(x.valideLe)}` : ""}
                {codes[x.id] ? ` · ${codes[x.id]} code${codes[x.id] > 1 ? "s" : ""} de poste ouvre${codes[x.id] > 1 ? "nt" : ""} dessus` : ""}
              </span>
            </li>
          ))}
        </ul>
        </>
      )}
    </>
  );
}
