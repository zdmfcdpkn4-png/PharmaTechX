import Link from "next/link";
import { notFound } from "next/navigation";
import { getModuleComplet, positionDansParcours, positionDansProgramme } from "@/content/store";
import { lireIdProgramme } from "@/content/programmes";
import { syntheseDuModule } from "@/lib/synthese";
import { lireEnCours, rattachement } from "@/lib/progression";
import { A_PRECISER, banquePublique } from "@/content/types";
import { baseConfiguree } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { lireBareme } from "@/lib/bareme-db";
import { Evaluation } from "@/components/Evaluation";
import { NoterConsultation } from "@/components/NoterConsultation";

export const dynamic = "force-dynamic";

export default async function PageEvaluation({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ programme?: string }>;
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  // Un module déposé non publié ne s'évalue qu'en tutorat ou en administration.
  const session = await getSession();
  const mod = await getModuleComplet(id, { inclureBrouillons: session?.role === "tuteur" || session?.role === "admin" });
  if (!mod) notFound();
  const idProgramme = lireIdProgramme(sp.programme);
  const [bareme, syntheses, dansProgramme, ratt] = await Promise.all([
    lireBareme(),
    syntheseDuModule(mod),
    idProgramme ? positionDansProgramme(idProgramme, mod.id) : Promise.resolve(null),
    rattachement(),
  ]);
  // Programme à la carte (question 50) : le module suivant est celui du programme.
  const position = dansProgramme ?? (await positionDansParcours("integration", mod.id));
  const requete = dansProgramme ? `?programme=${idProgramme}` : "";
  const enCours = ratt ? await lireEnCours(ratt.agentId, mod.id).catch(() => null) : null;
  // Un document de synthèse déposé est réservé aux sessions ouvertes par un code (question 13, choix b).
  const synthesesVisibles = session ? syntheses : syntheses.filter((d) => !d.url.startsWith("/api/fichiers/"));

  // Les bonnes réponses et les justifications sont retirées ici : elles ne
  // quittent le serveur qu'après soumission, via la route de correction.
  const banque = banquePublique(mod);
  if (banque.length === 0) notFound();

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
        enCoursInitial={enCours}
      />
    </article>
  );
}
