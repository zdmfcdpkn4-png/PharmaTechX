import Link from "next/link";
import { notFound } from "next/navigation";
import { getModule, getTousModules } from "@/content/store";
import { banquePublique } from "@/content/types";
import { Evaluation } from "@/components/Evaluation";

export function generateStaticParams() {
  return getTousModules()
    .filter((m) => m.redige)
    .map((m) => ({ id: m.id }));
}

export default async function PageEvaluation({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const mod = getModule(id);
  if (!mod) notFound();

  // Les bonnes réponses et les justifications sont retirées ici : elles ne
  // quittent le serveur qu'après soumission, via la route de correction.
  const banque = banquePublique(mod);
  if (banque.length === 0) notFound();

  return (
    <article>
      <p className="fil">
        <Link href="/">Programme</Link> ›{" "}
        <Link href={`/module/${mod.id}`}>{mod.titre}</Link> › Évaluation
      </p>

      <section className="panneau-titre">
        <h1>Évaluation — {mod.titre}</h1>
        <p>
          Seuil de réussite {mod.seuilReussite}&nbsp;%. Les questions
          éliminatoires invalident le critère en cas d&apos;erreur, quel que soit
          le score global.
        </p>
      </section>

      <Evaluation
        moduleId={mod.id}
        moduleTitre={mod.titre}
        banque={banque}
        seuil={mod.seuilReussite}
      />
    </article>
  );
}
