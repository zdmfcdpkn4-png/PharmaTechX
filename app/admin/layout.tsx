import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { baseConfiguree } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Coque des écrans d'administration : base requise, session tutorat ou
 * administration requise. La navigation des écrans d'administration est
 * portée par le volet latéral du gabarit racine depuis la question 37
 * (choix c) — elle n'est plus répétée en tête de chaque écran. Les actions
 * serveur revérifient le rôle de leur côté.
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

  return (
    <article>
      <p className="fil">
        <Link href="/">Programme</Link> › Administration
      </p>
      {children}
    </article>
  );
}
