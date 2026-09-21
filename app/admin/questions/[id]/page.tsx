import Link from "next/link";
import { notFound } from "next/navigation";
import { lireQuestion, listerSituations } from "@/content/banque-db";
import { EditeurQuestion } from "@/components/EditeurQuestion";
import { actionEnregistrerQuestion } from "../actions";
import { choixModules, versInitiale } from "../commun";

export const dynamic = "force-dynamic";

export default async function ModifierQuestion({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const q = await lireQuestion(id);
  if (!q) notFound();
  const situations = (await listerSituations()).map((s) => ({ id: s.id, titre: s.titre, moduleId: s.module_id }));
  return (
    <>
      <p className="fil">
        <Link href="/admin/questions">Banque de questions</Link> › {q.id}
      </p>
      <section className="panneau-titre">
        <h1>Modifier la question</h1>
        <p className="legende">
          {q.id} · version {q.version} · créée par {q.cree_par} le {new Date(q.cree_le).toLocaleDateString("fr-FR")}
          {q.valide_par ? ` · validée par ${q.valide_par}` : ""}
        </p>
      </section>
      <EditeurQuestion
        modules={await choixModules()}
        situations={situations}
        initiale={versInitiale(q)}
        action={actionEnregistrerQuestion}
      />
    </>
  );
}
