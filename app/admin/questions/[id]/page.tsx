import Link from "next/link";
import { notFound } from "next/navigation";
import { lireQuestion, listerSituations, signalementsOuvertsDe } from "@/content/banque-db";
import { EditeurQuestion } from "@/components/EditeurQuestion";
import { actionEnregistrerQuestion } from "../actions";
import { choixModules, versInitiale } from "../commun";

export const dynamic = "force-dynamic";

export default async function ModifierQuestion({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const q = await lireQuestion(id);
  if (!q) notFound();
  const situations = (await listerSituations()).map((s) => ({ id: s.id, titre: s.titre, moduleId: s.module_id }));
  const ouverts = await signalementsOuvertsDe(q.id);
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
      {/* Question 54 (a + b) : le signalement se lit là où la question se corrige. */}
      {ouverts.length > 0 && (
        <div className="encart encart--attention" role="note">
          <p>
            <strong>
              {ouverts.length} signalement{ouverts.length > 1 ? "s" : ""} ouvert{ouverts.length > 1 ? "s" : ""} sur cette question
            </strong>{" "}
            — tant qu&apos;un signalement reste ouvert, les rapports en cours qui l&apos;ont tirée ne peuvent être ni arbitrés
            ni visés.
          </p>
          <ul>
            {ouverts.map((s) => (
              <li key={s.id}>
                {s.motif}
                {s.note ? ` — « ${s.note} »` : ""} ({new Date(s.cree_le).toLocaleDateString("fr-FR")})
              </li>
            ))}
          </ul>
          <p>
            <Link href="/admin/signalements">Clore ou rejeter dans Signalements</Link>, une fois la question corrigée.
          </p>
        </div>
      )}
      <EditeurQuestion
        modules={await choixModules()}
        situations={situations}
        initiale={versInitiale(q)}
        action={actionEnregistrerQuestion}
      />
    </>
  );
}
