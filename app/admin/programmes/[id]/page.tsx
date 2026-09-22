import Link from "next/link";
import { notFound } from "next/navigation";
import { getTousModulesAvecDeposes } from "@/content/store";
import { lireProgramme } from "@/content/programmes-db";
import {
  LIBELLES_STATUT_PROGRAMME,
  MENTION_DEGRADE,
  lireIdProgramme,
  manquesPourValider,
  modulesDuProgramme,
} from "@/content/programmes";
import { A_PRECISER } from "@/content/types";
import { FormulaireProgramme } from "../formulaire";
import { actionModifierProgramme, actionRetirerProgramme, actionValiderProgramme } from "../actions";

export const dynamic = "force-dynamic";

const MESSAGES: Record<string, string> = {
  cree: "Programme enregistré en brouillon : invisible des postes tant qu'il n'est pas validé.",
  modifie: "Programme enregistré.",
  "modifie-a-revalider": "Programme modifié : il repasse en brouillon et quitte les postes jusqu'à une nouvelle validation.",
  valide: "Programme validé : il est proposé aux postes, marqué « parcours dégradé ».",
  retire: "Programme retiré : il quitte les postes ; il reste lisible ici.",
};

const ERREURS: Record<string, string> = {
  nom: "Le nom du programme est obligatoire.",
  incomplet: "Le programme n'est pas complet : il ne peut pas être validé.",
  statut: "Cet acte ne s'applique pas au programme dans son état actuel.",
};

function date(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Paris" }) : "";
}

export default async function Programme({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; erreur?: string }>;
}) {
  const [{ id }, q] = await Promise.all([params, searchParams]);
  const idp = lireIdProgramme(id);
  const p = idp ? await lireProgramme(idp) : null;
  if (!p) notFound();
  const catalogue = await getTousModulesAvecDeposes({ publiesSeulement: true });
  const { presents, absents } = modulesDuProgramme(p, catalogue);
  const manques = manquesPourValider(p);

  return (
    <>
      <p className="fil">
        <Link href="/admin/programmes">Programmes à la carte</Link> › {p.nom}
      </p>
      <section className="panneau-titre">
        <p className="sur-titre">Programme à la carte — {MENTION_DEGRADE}</p>
        <h1>{p.nom}</h1>
        <p>
          <span className={`etiquette${p.statut === "valide" ? "" : " etiquette--neutre"}`}>
            {LIBELLES_STATUT_PROGRAMME[p.statut]}
          </span>{" "}
          {p.destinataire ? `Pour : ${p.destinataire}.` : ""}
        </p>
        <p className="legende" style={{ margin: 0 }}>
          Composé par {p.creePar} le {date(p.creeLe)}
          {p.modifiePar ? ` · modifié par ${p.modifiePar} le ${date(p.modifieLe)}` : ""}
          {p.validePar ? ` · validé par ${p.validePar} le ${date(p.valideLe)}` : ""}.
        </p>
      </section>

      {q.ok && MESSAGES[q.ok] && <p className="encart encart--ok">{MESSAGES[q.ok]}</p>}
      {q.erreur && ERREURS[q.erreur] && (
        <p className="encart encart--attention" role="alert">
          {ERREURS[q.erreur]}
        </p>
      )}

      <section className="carte">
        <h2 style={{ marginTop: 0 }}>Motif de l&apos;écart à la fiche</h2>
        <p style={{ maxWidth: "66ch" }}>{p.motif || <span className="legende">Non renseigné — exigé pour valider.</span>}</p>
        <h2>Modules, dans l&apos;ordre du programme</h2>
        {presents.length > 0 ? (
          <ol className="programme-ordre">
            {presents.map((m) => (
              <li key={m.id}>
                {typeof m.critereId === "string" && m.critereId !== A_PRECISER ? <strong>{m.critereId}</strong> : null} {m.titre}
              </li>
            ))}
          </ol>
        ) : (
          <p className="legende">Aucun module.</p>
        )}
        {absents.length > 0 && (
          <p className="encart encart--attention">
            Introuvables ou non publiés, donc absents des postes : {absents.join(", ")}. Modifiez le programme
            pour les retirer, ou republiez-les.
          </p>
        )}
        <div className="actions">
          {p.statut === "brouillon" && (
            <form action={actionValiderProgramme}>
              <input type="hidden" name="id" value={p.id} />
              <button type="submit" className="bouton" disabled={manques.length > 0}>
                Valider le programme
              </button>
            </form>
          )}
          {p.statut !== "retire" && (
            <form action={actionRetirerProgramme}>
              <input type="hidden" name="id" value={p.id} />
              <button type="submit" className="bouton bouton--secondaire">
                Retirer le programme
              </button>
            </form>
          )}
        </div>
        {p.statut === "brouillon" && manques.length > 0 && (
          <p className="legende">Pour valider, il manque : {manques.join(", ")}.</p>
        )}
        {p.statut === "brouillon" && manques.length === 0 && (
          <p className="legende">
            La validation vous nomme sur le programme (rôle et libellé du code), et le propose aux postes.
          </p>
        )}
      </section>

      <div className="section-titre">
        <h2>Modifier</h2>
        {p.statut === "valide" && <span className="compte">un programme validé modifié repasse en brouillon</span>}
      </div>
      <FormulaireProgramme initiale={p} action={actionModifierProgramme} libelleBouton="Enregistrer les modifications" />
    </>
  );
}
