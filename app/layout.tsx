import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { SessionFormation } from "@/components/SessionFormation";
import { Chrome } from "@/components/Chrome";
import { MenuProvider, BoutonMenu, VoletMenu } from "@/components/Menu";
import { Navigation, type GroupeRail } from "@/components/Navigation";
import { VoletConnexion } from "@/components/VoletConnexion";
import { TutorielProvider } from "@/components/Tutoriel";
import { etapesTutoriel } from "@/content/tutoriel";
import { etatSession } from "@/lib/auth";
import { baseConfiguree } from "@/lib/db";
import { emissionsDeLAgent, evaluationsDeLAgent, rattachement } from "@/lib/progression";
import { conservationActive, miseEnService, procedureReference } from "@/lib/config";
import { compterSignalementsOuverts } from "@/content/banque-db";
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

  // Visite guidée du premier passage (19/09/2026). `session.role` est de type
  // `Role` ; l'indexation échoue à la compilation si les trois profils de
  // `content/tutoriel.ts` cessent de recouvrir ceux de `lib/db.ts`.
  const profilVisite = session?.role ?? null;
  const etapesVisite = profilVisite ? etapesTutoriel(profilVisite, conservation) : [];

  // Volet d'avant-connexion : le filtre d'entrée garde tout le site, donc
  // chaque raccourci ramènerait ici. Sans base, le site reste ouvert et les
  // raccourcis fonctionnent : le volet habituel est alors le bon.
  const avantConnexion = baseConfiguree() && !session;

  // Volet de navigation (question 37, choix c) : les liens sont composés ici,
  // seul endroit qui connaisse la session, la conservation et la base.
  const progressionVisible = conservation && baseConfiguree();
  const groupes: GroupeRail[] = [
    {
      titre: "Formation",
      liens: [
        { href: "/#modules", libelle: "Mes modules" },
        { href: "/#composer", libelle: "Composer le programme" },
        ...(progressionVisible
          ? [{ href: "/#progression", libelle: "Ma progression", indice: ratt?.identifiant }]
          : []),
        { href: "/#rapport", libelle: conservation ? "Mes évaluations" : "Rapport de session" },
      ],
    },
    {
      titre: "Repères",
      liens: [
        { href: "/reperes#dispositif", libelle: "Le dispositif" },
        { href: "/reperes#evaluation", libelle: "L'évaluation et son barème" },
        { href: "/reperes#programme", libelle: "Programme complet" },
        { href: "/reperes#niveaux", libelle: "Conditions des niveaux" },
        { href: "/reperes#questions", libelle: "Questions fréquentes" },
        { href: "/donnees-personnelles", libelle: "Vos données et vos droits" },
      ],
    },
  ];

  let signalementsOuverts = 0;
  if (gestionnaire && baseConfiguree()) {
    signalementsOuverts = await compterSignalementsOuverts().catch(() => 0);
  }
  const administration: GroupeRail | null = gestionnaire
    ? {
        titre: "Administration",
        liens: [
          { href: "/admin/pilotage", libelle: "Pilotage" },
          { href: "/admin", libelle: "Accès" },
          { href: "/admin/modules", libelle: "Modules" },
          { href: "/admin/questions", libelle: "Banque de questions" },
          { href: "/admin/questions/import", libelle: "Déposer des questions" },
          { href: "/admin/questions/nouvelle", libelle: "Écrire une question" },
          { href: "/admin/questions/situations", libelle: "Mises en situation" },
          { href: "/admin/documents", libelle: "Documents" },
          ...(conservation
            ? [
                { href: "/admin/rapports", libelle: "Rapports" },
                { href: "/admin/personnel", libelle: "Personnel" },
              ]
            : []),
          {
            href: "/admin/signalements",
            libelle: "Signalements",
            indice: signalementsOuverts > 0 ? String(signalementsOuverts) : undefined,
          },
          { href: "/admin/ordonnancement", libelle: "Ordre" },
          ...(session?.role === "admin"
            ? [
                { href: "/admin/referentiel", libelle: "Référentiel" },
          { href: "/admin/bareme", libelle: "Barème" },
                { href: "/admin/signature", libelle: "Signature" },
                { href: "/admin/journal", libelle: "Journal" },
              ]
            : []),
        ],
      }
    : null;

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
          <TutorielProvider profil={profilVisite} etapes={etapesVisite}>
          <MenuProvider>
            <Chrome>
              <BoutonMenu />

              <div className="logos">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/hdv.png"
                  alt="Hôpitaux de Vendée"
                  className="hdv"
                  width={396}
                  height={120}
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

              {/* Logo d'unité à l'opposé de celui de l'établissement (19/09/2026) :
                  les deux encadrent le titre au lieu de se serrer à gauche. */}
              <div className="logo-fin">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/pharmaco-web.png"
                  alt="Pharmacotechnie — unité de production des chimiothérapies"
                  className="pharmaco"
                  width={192}
                  height={192}
                />
              </div>

              <div className="entete-actions">
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
              </div>
            </Chrome>

            <div className="cadre">
              <VoletMenu>
                {avantConnexion ? (
                  <VoletConnexion />
                ) : (
                  <Navigation groupes={groupes} administration={administration} />
                )}
              </VoletMenu>

              <main id="contenu" className="page">
                {children}
              </main>
            </div>
          </MenuProvider>
          </TutorielProvider>

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
              {/* La mention « phase d'essai » a quitté les écrans le 19/09/2026 :
                  elle ne disait rien d'utile à un apprenant et occupait le pied de
                  chaque page. Tant que la mise en service n'est pas prononcée, le
                  pied n'annonce donc aucun statut — il n'en affirme pas non plus
                  un faux. L'état réel reste lisible côté administration et sur le
                  rapport lui-même. */}
              <p>
                {enService ? (
                  <>
                    Statut du dispositif&nbsp;: {STATUT_DISPOSITIF.long}, décision du{" "}
                    {STATUT_DISPOSITIF.decideLe}, en service depuis le {dateMiseEnServiceLisible(enService)}.{" "}
                  </>
                ) : null}
                Un rapport ne vaut pas habilitation&nbsp;: les étapes suivantes se déroulent hors du
                site. Procédure de référence&nbsp;:{" "}
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
