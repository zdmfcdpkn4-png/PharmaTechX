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
  // Un tuteur « en formation » (question 104) est un poste le temps de sa formation : l'administration l'attend
  // à son retour au tutorat, pas à la connexion.
  if (!session) redirect("/connexion");
  if (session.role === "poste") redirect(session.formation ? "/accueil" : "/connexion");

  return (
    <article>
      <p className="fil">
        <Link href="/accueil">Accueil</Link> › Administration
      </p>
      {children}
    </article>
  );
}
