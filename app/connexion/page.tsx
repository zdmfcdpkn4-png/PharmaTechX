import Link from "next/link";
import { baseConfiguree } from "@/lib/db";
import { secretConfigure } from "@/lib/auth";
import { actionAmorcage, actionConnexion } from "@/app/actions";

export const dynamic = "force-dynamic";

const MESSAGES: Record<string, string> = {
  "code-invalide": "Code inconnu, révoqué ou désactivé.",
  "non-configure":
    "Le contrôle d'accès n'est pas encore actif : la base de données n'est pas branchée.",
};

export default async function Connexion({
  searchParams,
}: {
  searchParams: Promise<{ erreur?: string }>;
}) {
  const { erreur } = await searchParams;
  const pret = baseConfiguree();

  return (
    <article style={{ maxWidth: "34rem", margin: "0 auto" }}>
      <section className="panneau-titre">
        <h1>Connexion</h1>
        <p>
          L&apos;accès se fait par code de rôle. Un code ne désigne pas une
          personne : il ouvre un profil — administration, tutorat, ou poste de
          travail.
        </p>
      </section>

      {!pret && (
        <p className="encart encart--attention">
          <strong>Contrôle d&apos;accès inactif.</strong> La base de données
          n&apos;est pas branchée : le site est ouvert à quiconque a
          l&apos;adresse. Créez un store Postgres et un store Blob dans
          l&apos;onglet <em>Storage</em> du projet Vercel, puis rechargez cette
          page.
        </p>
      )}

      {pret && !secretConfigure() && (
        <p className="encart encart--attention">
          <strong>Variable <code>AUTH_SECRET</code> absente.</strong> Les
          sessions ne survivront pas à un redéploiement et leur signature est
          prévisible. Ajoutez-la dans les variables d&apos;environnement du
          projet (une chaîne aléatoire d&apos;au moins 32 caractères).
        </p>
      )}

      {erreur && MESSAGES[erreur] && (
        <p className="encart encart--attention">{MESSAGES[erreur]}</p>
      )}

      <section className="carte">
        <form action={actionConnexion}>
          <label className="champ">
            <span>Code d&apos;accès</span>
            <input
              type="password"
              name="code"
              placeholder="XXXXX-XXXXX"
              autoComplete="off"
              autoFocus
              required
              disabled={!pret}
            />
          </label>
          <div className="actions">
            <button type="submit" className="bouton" disabled={!pret}>
              Entrer
            </button>
            <Link href="/" className="bouton bouton--secondaire">
              Consulter sans code
            </Link>
          </div>
        </form>
      </section>

      {pret && (
        <section className="carte" style={{ marginTop: "1rem" }}>
          <h2>Première mise en service</h2>
          <p className="legende">
            S&apos;il n&apos;existe encore aucun administrateur, ce bouton en
            crée un et affiche son code une seule fois. Il devient inopérant dès
            qu&apos;un administrateur existe.
          </p>
          <form action={actionAmorcage}>
            <button type="submit" className="bouton bouton--secondaire">
              Créer l&apos;administrateur initial
            </button>
          </form>
        </section>
      )}
    </article>
  );
}
