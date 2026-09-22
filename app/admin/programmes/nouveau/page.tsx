import Link from "next/link";
import { FormulaireProgramme } from "../formulaire";
import { actionCreerProgramme } from "../actions";

export const dynamic = "force-dynamic";

export default async function NouveauProgramme({
  searchParams,
}: {
  searchParams: Promise<{ erreur?: string }>;
}) {
  const p = await searchParams;
  return (
    <>
      <p className="fil">
        <Link href="/admin/programmes">Programmes à la carte</Link> › Nouveau
      </p>
      <section className="panneau-titre">
        <h1>Composer un programme à la carte</h1>
        <p>
          Il naît brouillon, invisible des postes. Il se valide ensuite, avec son motif, par un code de tutorat
          ou d&apos;administration.
        </p>
      </section>
      {p.erreur === "nom" && (
        <p className="encart encart--attention" role="alert">
          Le nom du programme est obligatoire.
        </p>
      )}
      <FormulaireProgramme action={actionCreerProgramme} libelleBouton="Enregistrer le brouillon" />
    </>
  );
}
