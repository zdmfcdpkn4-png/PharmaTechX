import Link from "next/link";
import { listerSituations } from "@/content/banque-db";
import { EditeurQuestion } from "@/components/EditeurQuestion";
import { actionEnregistrerQuestion } from "../actions";
import { choixModules } from "../commun";
import { retourBanque } from "@/content/arbre-banque";

export const dynamic = "force-dynamic";

export default async function NouvelleQuestion({
  searchParams,
}: {
  searchParams: Promise<{ module?: string; retour?: string }>;
}) {
  const p = await searchParams;
  // Venu de l'arborescence (question 64) : on y revient, au module de la question.
  const retour = retourBanque(p.retour) ?? undefined;
  const situations = (await listerSituations()).map((s) => ({ id: s.id, titre: s.titre, moduleId: s.module_id }));
  return (
    <>
      <p className="fil">
        <Link href={retour ?? "/admin/questions"}>Banque de questions</Link> › Nouvelle question
      </p>
      <section className="panneau-titre">
        <h1>Nouvelle question</h1>
        <p>
          QCM (tout ou rien), QIM (barème à la discordance) ou schéma à compléter. Elle entre au
          statut choisi ; « validée » la pose immédiatement aux apprenants.
        </p>
      </section>
      <EditeurQuestion
        modules={await choixModules()}
        situations={situations}
        moduleInitial={p.module}
        action={actionEnregistrerQuestion}
        retour={retour}
      />
    </>
  );
}
