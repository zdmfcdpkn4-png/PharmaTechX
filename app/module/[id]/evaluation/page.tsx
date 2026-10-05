import Link from "next/link";
import { notFound } from "next/navigation";
import { getModuleComplet, positionDansListe, positionDansParcours, positionDansProfil, positionDansProgramme } from "@/content/store";
import { lireIdProgramme } from "@/content/programmes";
import { requeteProfil } from "@/content/ordres";
import { profilDeLaPage, profilImpose } from "@/lib/profil-impose";
import { programmeDuPoste } from "@/lib/programme-poste";
import { HorsProgramme } from "@/components/HorsProgramme";
import { syntheseDuModule } from "@/lib/synthese";
import { lireEnCours, rattachement, reserveesDejaVues } from "@/lib/progression";
import { A_PRECISER, banquePublique } from "@/content/types";
import { baseConfiguree } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { lireBareme } from "@/lib/bareme-db";
import { lireNomsNiveaux } from "@/lib/niveaux-questions-db";
import { libellesDe } from "@/content/niveaux-questions";
import { questionsSignalees } from "@/content/banque-db";
import { getReferentiel } from "@/content/referentiel-db";
import { Evaluation } from "@/components/Evaluation";
import { NoterConsultation } from "@/components/NoterConsultation";

export const dynamic = "force-dynamic";

export default async function PageEvaluation({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ programme?: string; parcours?: string; filiere?: string; niveau?: string }>;
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  // Un module déposé non publié ne s'évalue qu'en tutorat ou en administration.
  const session = await getSession();
  const mod = await getModuleComplet(id, { inclureBrouillons: session?.role === "tuteur" || session?.role === "admin" });
  if (!mod) notFound();
  // Profil imposé (05/10/2026, `lib/profil-impose.ts`) : pour un code de poste, programme à la carte, filière et
  // niveau cible sont ceux du code ; l'adresse ne garde que le parcours. Hors de son programme, il n'évalue pas
  // le module (question 101, choix b).
  const impose = profilImpose(session, baseConfiguree());
  const duPoste = impose && session ? await programmeDuPoste(session, impose) : null;
  if (duPoste && !duPoste.ouverts.has(mod.id)) return <HorsProgramme titre={mod.titre} />;
  const idProgramme = duPoste ? duPoste.idProgramme : lireIdProgramme(sp.programme);
  const profil = idProgramme ? null : profilDeLaPage(impose, sp);
  const [bareme, syntheses, dansProgramme, ratt, { filieres, niveaux }, nomsNiveaux] = await Promise.all([
    lireBareme(),
    syntheseDuModule(mod),
    idProgramme ? positionDansProgramme(idProgramme, mod.id) : Promise.resolve(null),
    rattachement(),
    getReferentiel(),
    lireNomsNiveaux(),
  ]);
  // L'apprenant rattaché suit son ordre propre sur ce profil, s'il en a un (question 56).
  const dansProfil = profil
    ? await positionDansProfil(profil.parcours, profil.filiere, profil.niveau, mod.id, ratt?.agentId ?? null)
    : null;
  // Programme à la carte (question 50) ou profil qui a son ordre (question 55) :
  // le module suivant est celui de leur ordre.
  // Pour un code de poste, le module suivant se prend dans son programme (question 101, choix b).
  const position =
    dansProgramme ??
    dansProfil ??
    (duPoste
      ? positionDansListe(duPoste.parParcours[sp.parcours === "maintien" ? "maintien" : "integration"], mod.id)
      : await positionDansParcours("integration", mod.id));
  // Le profil suit de page en page, même sans ordre propre : son niveau est le niveau cible du tirage (question 62).
  const requete = dansProgramme ? `?programme=${idProgramme}` : profil ? requeteProfil(profil) : "";
  const enCours = ratt ? await lireEnCours(ratt.agentId, mod.id).catch(() => null) : null;
  // Un document de synthèse déposé est réservé aux sessions ouvertes par un code (question 13, choix b).
  const synthesesVisibles = session ? syntheses : syntheses.filter((d) => !d.url.startsWith("/api/fichiers/"));

  // Les bonnes réponses et les justifications sont retirées ici : elles ne
  // quittent le serveur qu'après soumission, via la route de correction.
  const banque = banquePublique(mod);
  if (banque.length === 0) notFound();
  // Tirage selon le niveau cible (questions 62 et 63) : celui du profil de la page, sinon celui du code de
  // session ; les questions au signalement ouvert sont écartées de tout tirage jusqu'à la clôture.
  const codes = niveaux.map((n) => String(n.code));
  const niveauDemande = profil?.niveau ?? session?.niveau ?? null;
  const niveauInitial = niveauDemande ? (codes.find((c) => c.toUpperCase() === niveauDemande.toUpperCase()) ?? null) : null;
  // Filière du profil (question 74) : celle de la page, sinon celle du code de session. Les questions
  // étiquetées pour d'autres profils ne sont pas tirées ; sans filière, cette dimension ne limite rien.
  const filiereDemandee = profil?.filiere ?? session?.filiere ?? null;
  const filiere = filieres.find((f) => f.id !== "socle" && f.id === filiereDemandee) ?? null;
  const signalees = baseConfiguree()
    ? (await questionsSignalees(banque.map((q) => q.id)).catch(() => ({ ouvertes: [] as string[] }))).ouvertes
    : [];
  // Réservées déjà vues corrigées par l'agent rattaché : tirées en dernier (question 71, choix b).
  const dejaVues = ratt ? await reserveesDejaVues(ratt.agentId, banque).catch(() => [] as string[]) : [];

  return (
    <article>
      <NoterConsultation module={mod.id} titre={mod.titre} />
      <p className="fil">
        <Link href={requete ? `/${requete}` : "/"}>Programme</Link> ›{" "}
        <Link href={`/module/${mod.id}${requete}`}>{typeof mod.critereId === "string" && mod.critereId !== A_PRECISER ? mod.critereId : mod.titre}</Link> › Évaluation
      </p>

      <section className="panneau-titre">
        <h1>Évaluation — {mod.titre}</h1>
        <p>
          Seuil {mod.seuilReussite}&nbsp;% ; une erreur à une question éliminatoire invalide le critère, quel que soit le
          score. Ce résultat ne vaut pas habilitation : c&apos;est la preuve de l&apos;étape 2 sur 6.
        </p>
      </section>

      <Evaluation
        moduleId={mod.id}
        moduleTitre={mod.titre}
        banque={banque}
        seuil={mod.seuilReussite}
        bareme={bareme}
        signalementPossible={baseConfiguree()}
        syntheses={synthesesVisibles}
        suivant={position?.suivant ? { id: position.suivant.id, titre: position.suivant.titre } : null}
        requete={requete}
        rattache={Boolean(ratt)}
        identifiant={ratt?.identifiant ?? null}
        enCoursInitial={enCours}
        niveaux={niveaux.map((n) => ({ code: String(n.code), libelle: n.libelle }))}
        niveauInitial={niveauInitial}
        filiere={filiere ? { id: filiere.id, libelle: filiere.libelle } : null}
        signalees={signalees}
        dejaVues={dejaVues}
        libellesNiveaux={libellesDe(nomsNiveaux)}
        niveauImpose={Boolean(impose)}
      />
    </article>
  );
}
