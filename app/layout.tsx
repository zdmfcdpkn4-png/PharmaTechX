import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { SessionFormation } from "@/components/SessionFormation";
import { Chrome } from "@/components/Chrome";
import { etatSession } from "@/lib/auth";
import { baseConfiguree } from "@/lib/db";
import { emissionsDeLAgent, evaluationsDeLAgent, rattachement } from "@/lib/progression";
import { conservationActive, miseEnService, procedureReference } from "@/lib/config";
import { STATUT_DISPOSITIF, dateMiseEnServiceLisible } from "@/lib/statut";
import { actionDeconnexion } from "@/app/actions";
import "./globals.css";

export const metadata: Metadata = {
  title: "Formation et habilitation — Pharmacotechnie",
  description:
    "Parcours de formation initiale et de maintien d'habilitation de l'équipe de production de pharmacotechnie, CHD Vendée.",
  // Icône d'onglet et de favori : l'emblème du logo « Pharmacotechnie — unité
  // de production des chimiothérapies » fourni le 18/09/2026, détouré carré
  // (180 × 180). Le texte du logo n'y figure pas : illisible à la taille d'un
  // onglet. Le logo porté par les rapports (`lib/logos.ts`) reste distinct.
  // Servi sans session : le filtre d'entrée laisse passer les fichiers `.png`
  // (`middleware.ts`), l'icône s'affiche donc aussi sur `/connexion`.
  icons: { icon: "/pharmaco-icone.png" },
  robots: { index: false, follow: false },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const etat = baseConfiguree() ? await etatSession() : { session: null, fermee: false };
  const session = etat.session;
  if (etat.fermee) {
    // Session liée à son code (question 16, choix b) : le filtre d'entrée n'a
    // vérifié que la signature, le code a été retiré depuis. Retour à la
    // connexion sur les pages gardées, que le filtre marque de la page demandée ;
    // les pages publiques (connexion, données personnelles) restent servies.
    const chemin = (await headers()).get("x-fp-chemin");
    if (chemin) {
      redirect(`/connexion?erreur=session-fermee${chemin === "/" ? "" : `&suite=${encodeURIComponent(chemin)}`}`);
    }
  }
  const gestionnaire = session && session.role !== "poste";
  const conservation = conservationActive();
  // Progression rattachée (question 11, choix c) : la mémoire de session du
  // navigateur part des évaluations conservées sous l'identifiant.
  const ratt = conservation ? await rattachement() : null;
  const [evaluations, emissions] = ratt
    ? await Promise.all([
        evaluationsDeLAgent(ratt.agentId).catch(() => []),
        emissionsDeLAgent(ratt.agentId).catch(() => []),
      ])
    : [[], []];
  const procedure = procedureReference();
  const enService = miseEnService();

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

        <SessionFormation
          initialResultats={evaluations}
          initialEmissions={emissions.map((e) => ({
            id: e.id,
            numero: e.numero,
            empreinte: e.empreinte,
            emisLe: new Date(e.emis_le).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Paris" }),
            identifiant: e.identifiant,
            moduleId: e.module_id,
            horodatageIso: e.horodatage_iso,
          }))}
        >
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
              {ratt && (
                <Link href="/#progression" className="bouton bouton--compact bouton--secondaire" title="Progression rattachée">
                  {ratt.identifiant}
                </Link>
              )}
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
                  l&apos;onglet le temps de la session, sauf si l&apos;apprenant rattache sa
                  progression à son identifiant d&apos;agent avec son code personnel : elle est
                  alors conservée sous cet identifiant, sans nom. Le rapport qu&apos;il choisit
                  d&apos;émettre est enregistré sous le même identifiant, pour le circuit de visas
                  du tuteur et du pharmacien responsable ; le nom n&apos;est porté qu&apos;à
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
                {enService ? (
                  <>
                    Statut du dispositif&nbsp;: {STATUT_DISPOSITIF.long}, décision du{" "}
                    {STATUT_DISPOSITIF.decideLe}, en service depuis le {dateMiseEnServiceLisible(enService)}.
                    Un rapport ne vaut pas habilitation.
                  </>
                ) : (
                  <>
                    <strong>Phase d&apos;essai&nbsp;:</strong> aucun rapport ne vaut preuve tant que la
                    mise en service n&apos;est pas prononcée. Statut cible&nbsp;: {STATUT_DISPOSITIF.long}.
                  </>
                )}{" "}
                Procédure de référence&nbsp;:{" "}
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
