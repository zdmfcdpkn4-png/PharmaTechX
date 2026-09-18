import { listerSituations } from "@/content/banque-db";
import { EditeurQuestion } from "@/components/EditeurQuestion";
import { actionEnregistrerQuestion } from "../actions";
import { choixModules } from "../commun";

export const dynamic = "force-dynamic";

export default async function NouvelleQuestion({
  searchParams,
}: {
  searchParams: Promise<{ module?: string }>;
}) {
  const p = await searchParams;
  const situations = (await listerSituations()).map((s) => ({ id: s.id, titre: s.titre, moduleId: s.module_id }));
  return (
    <>
      <section className="panneau-titre">
        <h1>Nouvelle question</h1>
        <p>
          QCM (tout ou rien), QIM (barème à la discordance) ou schéma à compléter. Elle entre au
          statut choisi ; « validée » la pose immédiatement aux apprenants.
        </p>
      </section>
      <EditeurQuestion
        modules={choixModules()}
        situations={situations}
        moduleInitial={p.module}
        action={actionEnregistrerQuestion}
      />
    </>
  );
}
