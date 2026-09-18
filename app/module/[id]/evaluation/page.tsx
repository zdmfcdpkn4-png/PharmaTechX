import Link from "next/link";
import { notFound } from "next/navigation";
import { getModuleComplet, positionDansParcours } from "@/content/store";
import { syntheseDuModule } from "@/lib/synthese";
import { lireEnCours, rattachement } from "@/lib/progression";
import { A_PRECISER, banquePublique } from "@/content/types";
import { baseConfiguree } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { lireBareme } from "@/lib/bareme-db";
import { Evaluation } from "@/components/Evaluation";

export const dynamic = "force-dynamic";

export default async function PageEvaluation({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Un module déposé non publié ne s'évalue qu'en tutorat ou en administration.
  const session = await getSession();
  const mod = await getModuleComplet(id, { inclureBrouillons: session?.role === "tuteur" || session?.role === "admin" });
  if (!mod) notFound();
  const [bareme, syntheses, position, ratt] = await Promise.all([
    lireBareme(),
    syntheseDuModule(mod),
    positionDansParcours("integration", mod.id),
    rattachement(),
  ]);
  const enCours = ratt ? await lireEnCours(ratt.agentId, mod.id).catch(() => null) : null;

  // Les bonnes réponses et les justifications sont retirées ici : elles ne
  // quittent le serveur qu'après soumission, via la route de correction.
  const banque = banquePublique(mod);
  if (banque.length === 0) notFound();

  return (
    <article>
      <p className="fil">
        <Link href="/">Programme</Link> ›{" "}
        <Link href={`/module/${mod.id}`}>{typeof mod.critereId === "string" && mod.critereId !== A_PRECISER ? mod.critereId : mod.titre}</Link> › Évaluation
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
        syntheses={syntheses}
        suivant={position?.suivant ? { id: position.suivant.id, titre: position.suivant.titre } : null}
        rattache={Boolean(ratt)}
        enCoursInitial={enCours}
      />
    </article>
  );
}
