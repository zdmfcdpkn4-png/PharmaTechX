import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { SessionFormation } from "@/components/SessionFormation";
import { Chrome } from "@/components/Chrome";
import { MenuProvider, BoutonMenu, VoletMenu } from "@/components/Menu";
import { Navigation, type GroupeRail } from "@/components/Navigation";
import { AccesRapide, type ReprisePossible } from "@/components/AccesRapide";
import { FilHabilitation } from "@/components/FilHabilitation";
import { ModeZone } from "@/components/ModeZone";
import { PageAnimee } from "@/components/PageAnimee";
import { VoletConnexion } from "@/components/VoletConnexion";
import { IndicateurNavigation } from "@/components/IndicateurNavigation";
import { VeilleInactivite } from "@/components/VeilleInactivite";
import { TutorielProvider } from "@/components/Tutoriel";
import { etapesTutoriel } from "@/content/tutoriel";
import { fileNonVide, itemsAFaire, AUCUN_COMPTE } from "@/content/acces-rapide";
import { etapes as etapesHabilitation } from "@/content/habilitation";
import { questionsRenseignees } from "@/content/en-cours";
import { getModule } from "@/content/store";
import { lireModuleDepose } from "@/content/modules-db";
import { comptesAttente } from "@/lib/attente";
import { etatSession } from "@/lib/auth";
import { baseConfiguree } from "@/lib/db";
import { dernierEnCours, emissionsDeLAgent, evaluationsDeLAgent, rattachement } from "@/lib/progression";
import { conservationActive, miseEnService, procedureReference } from "@/lib/config";
import { STATUT_DISPOSITIF, dateMiseEnServiceLisible } from "@/lib/statut";
import { actionDeconnexion } from "@/app/actions";
import { actionTerminerEssai } from "@/app/actions-essai";
import { LIBELLE_ESSAI } from "@/lib/essai";
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
      id: "formation",
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
      id: "reperes",
      titre: "Repères",
      liens: [
        { href: "/reperes#dispositif", libelle: "Le dispositif" },
        { href: "/reperes#evaluation", libelle: "L'évaluation et son barème" },
        { href: "/reperes#programme", libelle: "Programme complet" },
        { href: "/reperes#niveaux", libelle: "Conditions des niveaux" },
        { href: "/reperes#questions", libelle: "Questions fréquentes" },
      ],
    },
    // Onglet RGPD (22/09/2026, « circonscrire tout le RGPD dans un onglet
    // spécifique ») : toute l'information sur les données tient dans cette
    // page, et plus aucun écran n'en porte de ligne. Le volet et l'accès
    // rapide sont présents sur chaque page : l'information reste à un geste
    // (lignes directrices WP260 sur la transparence, § 11).
    {
      id: "rgpd",
      titre: "RGPD",
      onglet: true,
      liens: [{ href: "/donnees-personnelles", libelle: "Vos données et vos droits" }],
    },
  ];

  // ─────────────────────────────────────────── file d'attente (paquet A)
  // Les compteurs viennent des fonctions qui alimentent déjà les écrans
  // correspondants : c'est la seule façon qu'ils ne divergent pas.
  const comptes =
    gestionnaire && baseConfiguree() && session
      ? await comptesAttente(session.role, conservation).catch(() => AUCUN_COMPTE)
      : AUCUN_COMPTE;
  const signalementsOuverts = comptes.signalements;
  const itemsFile = session ? itemsAFaire(session.role, comptes, conservation) : [];
  // Les rapports portent deux actes distincts — arbitrer, viser — et un seul
  // écran : le volet en donne la somme, l'accès rapide les sépare.
  const actesRapports = comptes.rapportsAViser + comptes.verdictsAArbitrer;

  // ─────────────────────────────────────────── « Reprendre » (paquet A)
  // Sans rattachement, une évaluation interrompue vit dans la page et meurt à
  // la navigation : il n'y a rien à reprendre, et rien à annoncer.
  const reprises: ReprisePossible[] = [];
  if (ratt) {
    const enCours = await dernierEnCours(ratt.agentId).catch(() => null);
    if (enCours) {
      const titre =
        getModule(enCours.moduleId)?.titre ??
        (await lireModuleDepose(enCours.moduleId).catch(() => null))?.titre ??
        enCours.moduleId;
      const total = enCours.etat.questionIds.length;
      const faites = questionsRenseignees(enCours.etat);
      reprises.push({
        nature: "evaluation",
        libelle: titre,
        detail: `${faites} sur ${total} questions`,
        href: `/module/${enCours.moduleId}/evaluation`,
      });
    }
  }
  // Sous-parties par usage (19/09/2026, choix b) : ce qu'on consulte, ce
  // qu'on fabrique — questions, puis modules —, ce qu'on règle. L'ordre suit la fréquence d'ouverture,
  // pas l'ordre d'écriture des écrans.
  const administration: GroupeRail | null = gestionnaire
    ? {
        id: "administration",
        titre: "Administration",
        sous: [
          {
            titre: "Suivi",
            // Pictogramme de l'intitulé, dans le volet et dans « Aller à » (question 77, choix a).
            picto: "suivi",
            liens: [
              { href: "/admin/pilotage", libelle: "Pilotage" },
              // Statistiques de réussite (question 78, choix a) : sans conservation, aucun essai à analyser.
              ...(conservation ? [{ href: "/admin/statistiques", libelle: "Statistiques" }] : []),
              ...(conservation
                ? [{ href: "/admin/rapports", libelle: "Rapports", compte: actesRapports }]
                : []),
              {
                href: "/admin/signalements",
                libelle: "Signalements",
                compte: signalementsOuverts,
              },
              ...(conservation ? [{ href: "/admin/personnel", libelle: "Personnel" }] : []),
            ],
          },
          // « Contenu » portait huit liens, le plus long bloc du volet ouvert :
          // coupé en deux sous-menus de quatre (audit du 22/09/2026).
          {
            titre: "Questions",
            picto: "questions",
            liens: [
              {
                href: "/admin/questions",
                libelle: "Banque de questions",
                compte: comptes.contenusAVerifier,
              },
              { href: "/admin/questions/import", libelle: "Déposer des questions" },
              { href: "/admin/questions/nouvelle", libelle: "Écrire une question" },
              { href: "/admin/questions/situations", libelle: "Mises en situation" },
              // Mode test (24/09/2026) : passer une évaluation en apprenant, à un niveau choisi, sans rien enregistrer.
              { href: "/admin#t-essai", libelle: "Tester en apprenant" },
            ],
          },
          {
            titre: "Modules",
            picto: "modules",
            liens: [
              { href: "/admin/modules", libelle: "Modules" },
              { href: "/admin/documents", libelle: "Documents" },
              { href: "/admin/ordonnancement", libelle: "Ordre" },
              // Une page par filière : fiche, niveaux, programme (question 80, choix a).
              { href: "/admin/filieres", libelle: "Filières" },
              { href: "/admin/programmes", libelle: "Programmes à la carte" },
            ],
          },
          {
            titre: "Réglages",
            picto: "reglages",
            liens: [
              { href: "/admin", libelle: "Accès" },
              ...(session?.role === "admin"
                ? [
                    { href: "/admin/referentiel", libelle: "Référentiel" },
                    { href: "/admin/bareme", libelle: "Barème" },
                    { href: "/admin/signature", libelle: "Signature" },
                    { href: "/admin/journal", libelle: "Journal" },
                  ]
                : []),
            ],
          },
        ],
      }
    : null;

  return (
    <html lang="fr">
      {/* Aucune ressource tierce : Inter, en repli d'Aptos, est servie par le
          site lui-même (`@font-face` en tête de globals.css, décision du
          23/09/2026). */}
      <body>
        {/* Décor : quatre formes floutées en dérive très lente, derrière tout. */}
        <div className="fond-organique" aria-hidden="true">
          <span className="forme-1" />
          <span className="forme-2" />
          <span className="forme-3" />
          <span className="forme-4" />
        </div>
        {/* `useSearchParams` exige sa frontière d'attente. */}
        <Suspense fallback={null}>
          <IndicateurNavigation />
        </Suspense>
        {/* Quatre heures sans activité ferment la session (23/09/2026). */}
        {session && <VeilleInactivite />}

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
            <Chrome
              annonce={
                session?.essai ? (
                  // Mode test (23/09/2026, choix a) : sur chaque page tant que
                  // le test dure, avec sa sortie.
                  <div className="bandeau-essai">
                    <div className="bandeau-essai-interne">
                      <p>
                        <strong>Mode test</strong>
                        <span className="bandeau-essai-detail"> — vue apprenant sous « {LIBELLE_ESSAI} »</span>
                        &nbsp;: rien n&apos;est enregistré.
                      </p>
                      <form action={actionTerminerEssai}>
                        <button type="submit" className="bouton bouton--compact">
                          Terminer le test
                        </button>
                      </form>
                    </div>
                  </div>
                ) : null
              }
            >
              <BoutonMenu pastille={fileNonVide(itemsFile)} />

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
                  alt="Pharmacotechnie — unité de production des chimiothérapies"
                  className="pharmaco"
                  width={192}
                  height={192}
                />
              </div>

              <div className="bandeau">
                <Link href="/" className="bandeau-titre">
                  Formation &amp; habilitation
                </Link>
                <div className="bandeau-sous">
                  Unité de production — CHD Vendée
                </div>
              </div>

              {/* Second logo d'unité, à l'opposé du premier (19/09/2026) : le
                  mandala et le logo HdV tiennent la gauche, le monogramme P
                  ferme le bandeau à droite. `alt` vide — le premier logo porte
                  déjà le nom de l'unité, le répéter ferait entendre deux fois
                  la même chose à un lecteur d'écran. */}
              <div className="logo-fin">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/pharmaco-p.png"
                  alt=""
                  className="pharmaco-p"
                  width={192}
                  height={192}
                />
              </div>

              <div className="entete-actions">
                <ModeZone />
                {session ? (
                  <form action={actionDeconnexion}>
                    {/* Sous 62 rem, le bouton ne dit plus que « Quitter » : le
                        profil reste dans son nom accessible. */}
                    <button
                      type="submit"
                      className="bouton bouton--compact bouton-quitter"
                      aria-label={`${session.libelle} — quitter`}
                    >
                      {/* Une seule boîte dans le bouton, dont les enfants
                          sont espacés par `gap` : sans elle, l'espace
                          s'ajoutait au blanc du texte. */}
                      <span>
                        <span className="bouton-quitter-profil">{session.libelle} — </span>
                        <span className="bouton-quitter-verbe">quitter</span>
                      </span>
                    </button>
                  </form>
                ) : (
                  <Link href="/connexion" className="bouton bouton--compact">
                    Connexion
                  </Link>
                )}
              </div>
            </Chrome>

            <AccesRapide
              groupes={avantConnexion ? [] : groupes}
              administration={avantConnexion ? null : administration}
              items={itemsFile}
              reprises={reprises}
              avant={avantConnexion ? <VoletConnexion /> : undefined}
            />

            <div className="cadre">
              <VoletMenu>
                {avantConnexion ? (
                  <VoletConnexion />
                ) : (
                  <Navigation groupes={groupes} administration={administration} />
                )}
              </VoletMenu>

              <PageAnimee>
                {avantConnexion ? null : (
                  <FilHabilitation
                    etapes={etapesHabilitation.map((e) => ({
                      numero: e.numero,
                      titre: e.titre,
                      lieu: e.lieu,
                    }))}
                  />
                )}
                {children}
              </PageAnimee>
            </div>
          </MenuProvider>
          </TutorielProvider>

          <footer className="pied">
            <div className="pied-interne">
              {/* La ligne sur les données a quitté le pied le 22/09/2026 : tout
                  le RGPD tient dans son onglet, en fin de volet. */}
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
