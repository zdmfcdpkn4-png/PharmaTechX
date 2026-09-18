import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { baseConfiguree } from "@/lib/db";
import { conservationActive } from "@/lib/config";
import { compterSignalementsOuverts } from "@/content/banque-db";

export const dynamic = "force-dynamic";

/**
 * Coque des écrans d'administration : base requise, session tutorat ou
 * administration requise, navigation commune. Les actions serveur
 * revérifient le rôle de leur côté.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!baseConfiguree()) {
    return (
      <article>
        <section className="panneau-titre">
          <h1>Administration</h1>
          <p>Base de données non branchée.</p>
        </section>
        <p className="encart encart--attention">
          Renseignez <code>DATABASE_URL</code> (Render, Supabase, Neon ou une instance locale) et
          <code> AUTH_SECRET</code>, puis redéployez. Le schéma est créé automatiquement au premier
          accès. Sur Vercel, connecter un store Postgres suffit : la variable
          <code> POSTGRES_URL</code> est lue en repli. Voir <code>docs/DEPLOIEMENT.md</code>.
        </p>
        <Link href="/" className="bouton bouton--secondaire">
          Retour au programme
        </Link>
      </article>
    );
  }

  const session = await getSession();
  if (!session || session.role === "poste") redirect("/connexion");

  let ouverts = 0;
  try {
    ouverts = await compterSignalementsOuverts();
  } catch {
    ouverts = 0;
  }

  return (
    <article>
      <p className="fil">
        <Link href="/">Programme</Link> › Administration
      </p>
      <nav className="nav-admin" aria-label="Administration">
        <Link href="/admin">Accès</Link>
        <Link href="/admin/questions">Questions</Link>
        <Link href="/admin/questions/import">Dépôt</Link>
        <Link href="/admin/questions/situations">Mises en situation</Link>
        <Link href="/admin/documents">Documents</Link>
        {conservationActive() && <Link href="/admin/rapports">Rapports</Link>}
        {conservationActive() && <Link href="/admin/personnel">Personnel</Link>}
        <Link href="/admin/signalements">
          Signalements{ouverts > 0 ? ` (${ouverts})` : ""}
        </Link>
        <Link href="/admin/ordonnancement">Ordre</Link>
        {session.role === "admin" && <Link href="/admin/signature">Signature</Link>}
        {session.role === "admin" && <Link href="/admin/journal">Journal</Link>}
      </nav>
      {children}
    </article>
  );
}
