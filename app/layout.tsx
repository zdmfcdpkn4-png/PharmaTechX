import type { Metadata } from "next";
import Link from "next/link";
import { SessionFormation } from "@/components/SessionFormation";
import { Chrome } from "@/components/Chrome";
import { getSession } from "@/lib/auth";
import { baseConfiguree } from "@/lib/db";
import { conservationActive, procedureReference } from "@/lib/config";
import { STATUT_DISPOSITIF } from "@/lib/statut";
import { actionDeconnexion } from "@/app/actions";
import "./globals.css";

export const metadata: Metadata = {
  title: "Formation et habilitation — Pharmacotechnie",
  description:
    "Parcours de formation initiale et de maintien d'habilitation de l'équipe de production de pharmacotechnie, CHD Vendée.",
  robots: { index: false, follow: false },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = baseConfiguree() ? await getSession() : null;
  const gestionnaire = session && session.role !== "poste";
  const conservation = conservationActive();
  const procedure = procedureReference();

  return (
    <html lang="fr">
      <head>
        {/* Inter en repli web. Aptos, présente sur les postes du CHD via
            Office, reste en tête de la pile (voir `body` dans globals.css).
            Chargée par lien plutôt que par next/font : pas de récupération au
            build, et le rendu reste correct si Google Fonts est injoignable
            depuis le réseau de l'établissement. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin=""
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
        />
      </head>
      <body>
        {/* Décor : quatre formes floutées en dérive très lente, derrière tout. */}
        <div className="fond-organique" aria-hidden="true">
          <span className="forme-1" />
          <span className="forme-2" />
          <span className="forme-3" />
          <span className="forme-4" />
        </div>

        <SessionFormation>
          <Chrome>
            <div className="logos">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/hdv.png"
                alt="Hôpitaux de Vendée"
                className="hdv"
                width={396}
                height={120}
              />
              <span className="separateur-logo" aria-hidden="true" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/pharmaco-web.png"
                alt="Service Pharmacotechnie"
                className="pharmaco"
                width={96}
                height={96}
              />
            </div>

            <div>
              <Link href="/" className="bandeau-titre">
                Formation &amp; habilitation
              </Link>
              <div className="bandeau-sous">
                Unité de production — CHD Vendée
              </div>
            </div>

            <nav className="nav-sections" aria-label="Sections">
              <Link href="/#modules">Mes modules</Link>
              <Link href="/#dispositif">Le dispositif</Link>
              <Link href="/#evaluation">L&apos;évaluation</Link>
              <Link href="/#questions">Questions</Link>
              {gestionnaire && <Link href="/admin">Administration</Link>}
              {session ? (
                <form action={actionDeconnexion}>
                  <button type="submit" className="bouton bouton--compact">
                    {session.libelle} — quitter
                  </button>
                </form>
              ) : (
                <Link href="/connexion" className="bouton bouton--compact">
                  Connexion
                </Link>
              )}
            </nav>
          </Chrome>

          <main id="contenu" className="page">
            {children}
          </main>

          <footer className="pied">
            <div className="pied-interne">
              {conservation ? (
                <p>
                  <strong>Aucun nom n&apos;est enregistré.</strong> Les réponses transmises au
                  serveur ne comportent ni nom, ni matricule. Les résultats vivent en mémoire de
                  l&apos;onglet le temps de la session. Seul le rapport que l&apos;apprenant choisit
                  d&apos;émettre est enregistré, sous son identifiant d&apos;agent, pour le circuit de
                  visas du tuteur et du pharmacien responsable ; le nom n&apos;est porté qu&apos;à
                  l&apos;édition. <Link href="/donnees-personnelles">Vos données et vos droits</Link>.
                  Un repère de lecture reste sur le poste, et il ne désigne personne.
                </p>
              ) : (
                <p>
                  <strong>Rien de nominatif n&apos;est enregistré.</strong> Les
                  réponses transmises au serveur ne comportent ni nom, ni
                  matricule, ni identifiant. Les résultats vivent en mémoire de
                  l&apos;onglet le temps de la session, puis dans le rapport que
                  l&apos;apprenant télécharge sur son poste. Seul un repère de
                  lecture est conservé localement, sur le poste, et il ne désigne
                  personne.
                </p>
              )}
              <p>
                Statut du dispositif&nbsp;: {STATUT_DISPOSITIF.long}, décision du{" "}
                {STATUT_DISPOSITIF.decideLe}. Un rapport ne vaut pas habilitation. Procédure de
                référence&nbsp;:{" "}
                {procedure ? <code>{procedure}</code> : <code className="a-preciser">[à compléter]</code>}
              </p>
            </div>
          </footer>

          <div className="bandeau-bleu">
            <div className="pied-interne">
              <strong>CHD Vendée —</strong> La Roche-sur-Yon 85925 • Luçon 85400
              • Montaigu 85600 — Pharmacie à usage intérieur, unité de
              pharmacotechnie
            </div>
          </div>
        </SessionFormation>
      </body>
    </html>
  );
}
