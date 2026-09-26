import Link from "next/link";
import { codesParProgramme, listerProgrammes } from "@/content/programmes-db";
import { LIBELLES_STATUT_PROGRAMME, MENTION_DEGRADE } from "@/content/programmes";

export const dynamic = "force-dynamic";

function date(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" }) : "";
}

/**
 * Programmes à la carte (question 50, 22/09/2026) : le parcours dégradé des
 * profils qui ne suivent pas la fiche. Tutorat et administration.
 */
export default async function Programmes() {
  const [programmes, codes] = await Promise.all([listerProgrammes(), codesParProgramme()]);
  return (
    <>
      <section className="panneau-titre">
        <p className="legende" style={{ margin: 0 }}>Squelette de la formation</p>
        <h1>Programmes à la carte</h1>
        <p>
          Pour un profil qui ne suit pas la fiche d&apos;habilitation — intérimaire, remplaçant —, un programme
          composé à la main : les modules choisis un à un, dans l&apos;ordre voulu. Il est marqué « {MENTION_DEGRADE} »
          partout où il paraît, et n&apos;est proposé aux postes qu&apos;une fois validé par un code de tutorat ou
          d&apos;administration. Le modifier le renvoie en brouillon.
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
        <ul className="liste-nue">
          {programmes.map((x) => (
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
      )}
    </>
  );
}
