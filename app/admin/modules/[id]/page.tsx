import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { lireBareme } from "@/lib/bareme-db";
import { STATUTS_MODULE, lireModuleDepose } from "@/content/modules-db";
import { FormulaireModule } from "../formulaire";
import { actionEnregistrerModule, actionStatutModule, actionSupprimerModule } from "../actions";

export const dynamic = "force-dynamic";

const MESSAGES: Record<string, string> = {
  cree: "Module créé au statut brouillon : déposez ses questions et ses documents, puis publiez-le.",
  modifie: "Module enregistré.",
  publie: "Module publié.",
  brouillon: "Module repassé en brouillon.",
  retire: "Module retiré du programme.",
};

const ERREURS: Record<string, string> = {
  titre: "Le titre est obligatoire.",
  critere: "Critère inconnu.",
  publie: "Un module publié ne se modifie qu'en administration : demandez de le repasser en brouillon.",
};

export default async function ModuleDepose({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; erreur?: string }>;
}) {
  const [{ id }, p, session] = await Promise.all([params, searchParams, getSession()]);
  const [m, bareme] = await Promise.all([lireModuleDepose(id), lireBareme()]);
  if (!m) notFound();
  const retour = `/admin/modules/${m.id}`;

  return (
    <>
      <p className="fil">
        <Link href="/admin/modules">Modules</Link> › {m.titre}
      </p>
      <section className="panneau-titre">
        <ul className="meta-module" style={{ margin: 0 }}>
          <li className={`etiquette ${m.statut === "publie" ? "etiquette--ok" : m.statut === "retire" ? "etiquette--neutre" : "etiquette--attention"}`}>
            {STATUTS_MODULE[m.statut]}
          </li>
          <li className="legende">
            v{m.version} · créé par {m.cree_par} le {new Date(m.cree_le).toLocaleDateString("fr-FR")}
            {m.publie_le ? ` · publié le ${new Date(m.publie_le).toLocaleDateString("fr-FR")}` : ""} · <code>{m.id}</code>
          </li>
        </ul>
        <h1>{m.titre}</h1>
        <p className="legende">
          {m.nb_valides} question{m.nb_valides > 1 ? "s" : ""} validée{m.nb_valides > 1 ? "s" : ""} sur {m.nb_questions} ·{" "}
          {m.nb_documents} document{m.nb_documents > 1 ? "s" : ""}
        </p>
        <div className="actions" style={{ marginTop: 0 }}>
          <Link href={`/module/${m.id}`} className="bouton bouton--compact bouton--secondaire">Voir le module</Link>
          <Link href={`/admin/questions/import?module=${encodeURIComponent(m.id)}`} className="bouton bouton--compact bouton--secondaire">
            Déposer des questions
          </Link>
          <Link href={`/admin/questions?module=${encodeURIComponent(m.id)}`} className="bouton bouton--compact bouton--secondaire">Questions</Link>
          <Link href={`/admin/documents?module=${encodeURIComponent(m.id)}`} className="bouton bouton--compact bouton--secondaire">Documents</Link>
          {session?.role === "admin" && m.statut !== "publie" && (
            <form action={actionStatutModule}>
              <input type="hidden" name="id" value={m.id} />
              <input type="hidden" name="statut" value="publie" />
              <input type="hidden" name="retour" value={retour} />
              <button type="submit" className="bouton bouton--compact">Publier</button>
            </form>
          )}
          {session?.role === "admin" && m.statut === "publie" && (
            <form action={actionStatutModule}>
              <input type="hidden" name="id" value={m.id} />
              <input type="hidden" name="statut" value="brouillon" />
              <input type="hidden" name="retour" value={retour} />
              <button type="submit" className="bouton bouton--compact bouton--secondaire">Repasser en brouillon</button>
            </form>
          )}
          {session?.role === "admin" && m.statut !== "retire" && (
            <form action={actionStatutModule}>
              <input type="hidden" name="id" value={m.id} />
              <input type="hidden" name="statut" value="retire" />
              <input type="hidden" name="retour" value={retour} />
              <button type="submit" className="bouton bouton--compact bouton--secondaire">Retirer</button>
            </form>
          )}
          {session?.role === "admin" && (
            <form action={actionSupprimerModule}>
              <input type="hidden" name="id" value={m.id} />
              <button type="submit" className="bouton bouton--compact bouton--discret">Supprimer</button>
            </form>
          )}
        </div>
      </section>

      {p.ok && MESSAGES[p.ok] && <p className="encart encart--ok">{MESSAGES[p.ok]}</p>}
      {p.erreur && <p className="encart encart--attention">{ERREURS[p.erreur] ?? "Erreur."}</p>}

      {session?.role !== "admin" && (
        <p className="encart">
          Publication, retrait et retour en brouillon : réservée à l&apos;administration (règle des quatre yeux, décision du
          18/09/2026). {m.statut === "publie" ? "Ce module est publié : sa modification aussi." : ""}
        </p>
      )}
      {session?.role === "admin" || m.statut !== "publie" ? (
        <FormulaireModule initiale={m} action={actionEnregistrerModule} seuilDefaut={bareme.seuilDefaut} />
      ) : null}
    </>
  );
}
