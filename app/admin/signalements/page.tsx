import Link from "next/link";
import { listerSignalements } from "@/content/banque-db";
import { actionTraiterSignalement } from "../questions/actions";

export const dynamic = "force-dynamic";

export default async function Signalements() {
  const signalements = await listerSignalements();
  return (
    <>
      <section className="panneau-titre">
        <h1>Signalements</h1>
        <p>
          Remarques déposées par les apprenants depuis la correction — motif fermé, note libre.
          Le tutorat tranche : corriger la question, puis clore le signalement.
          Une question de la banque versionnée avec le site se corrige dans le code.
        </p>
      </section>
      <ul className="liste-nue">
        {signalements.map((s) => (
          <li key={s.id} className="carte">
            <div className="etape-tete">
              <span className={`etiquette ${s.statut === "ouvert" ? "etiquette--attention" : "etiquette--neutre"}`}>{s.statut}</span>
              <strong>{s.motif}</strong>
              <span className="legende" style={{ marginLeft: "auto" }}>
                {new Date(s.cree_le).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })} · {s.module_id}
              </span>
            </div>
            <p style={{ marginBottom: ".25rem" }}>{s.enonce ?? <span className="legende">question de la banque versionnée : {s.question_id}</span>}</p>
            {s.note && <p className="legende">« {s.note} »</p>}
            {s.enonce && (
              <p className="legende">
                <Link href={`/admin/questions/${s.question_id}`}>Ouvrir la question</Link>
              </p>
            )}
            {s.statut === "ouvert" ? (
              <form action={actionTraiterSignalement}>
                <input type="hidden" name="id" value={s.id} />
                <label className="champ">
                  <span>Réponse (facultative, visible ici seulement)</span>
                  <input type="text" name="reponse" maxLength={1000} />
                </label>
                <div className="actions">
                  <button type="submit" name="statut" value="traite" className="bouton bouton--compact">Clore — traité</button>
                  <button type="submit" name="statut" value="rejete" className="bouton bouton--compact bouton--secondaire">Rejeter</button>
                </div>
              </form>
            ) : (
              <p className="legende">
                {s.statut === "traite" ? "Traité" : "Rejeté"} par {s.traite_par} le{" "}
                {s.traite_le ? new Date(s.traite_le).toLocaleDateString("fr-FR") : ""}{s.reponse ? ` — ${s.reponse}` : ""}
              </p>
            )}
          </li>
        ))}
        {signalements.length === 0 && <li className="legende">Aucun signalement.</li>}
      </ul>
    </>
  );
}
