import Link from "next/link";
import { notFound } from "next/navigation";
import { getModuleComplet, positionDansParcours, positionDansProfil, positionDansProgramme } from "@/content/store";
import { lireIdProgramme } from "@/content/programmes";
import { lireProfilDemande, requeteProfil } from "@/content/ordres";
import { syntheseDuModule } from "@/lib/synthese";
import { lireEnCours, rattachement, reserveesDejaVues } from "@/lib/progression";
import { A_PRECISER, banquePublique } from "@/content/types";
import { baseConfiguree } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { lireBareme } from "@/lib/bareme-db";
import { questionsSignalees } from "@/content/banque-db";
import { listeNiveaux } from "@/content/referentiel-db";
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
  const idProgramme = lireIdProgramme(sp.programme);
  const profil = idProgramme ? null : lireProfilDemande(sp);
  const [bareme, syntheses, dansProgramme, ratt, niveaux] = await Promise.all([
    lireBareme(),
    syntheseDuModule(mod),
    idProgramme ? positionDansProgramme(idProgramme, mod.id) : Promise.resolve(null),
    rattachement(),
    listeNiveaux(),
  ]);
  // L'apprenant rattaché suit son ordre propre sur ce profil, s'il en a un (question 56).
  const dansProfil = profil
    ? await positionDansProfil(profil.parcours, profil.filiere, profil.niveau, mod.id, ratt?.agentId ?? null)
    : null;
  // Programme à la carte (question 50) ou profil qui a son ordre (question 55) :
  // le module suivant est celui de leur ordre.
  const position = dansProgramme ?? dansProfil ?? (await positionDansParcours("integration", mod.id));
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
          Seuil de réussite {mod.seuilReussite}&nbsp;%. Les questions éliminatoires invalident le
          critère en cas d&apos;erreur, quel que soit le score global. Ce résultat ne vaut pas
          habilitation : il constitue la preuve de l&apos;étape 2 sur 6.
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
        signalees={signalees}
        dejaVues={dejaVues}
      />
    </article>
  );
}
