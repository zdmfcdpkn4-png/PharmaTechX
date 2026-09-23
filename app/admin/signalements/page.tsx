import Link from "next/link";
import { listerSignalements } from "@/content/banque-db";
import { LIBELLES_STATUT_SIGNALEMENT } from "@/content/signalements";
import { getModule, getTousModulesAvecDeposes } from "@/content/store";
import { banqueDuModule } from "@/content/types";
import { actionRejeterSignalement, actionTraiterSignalement } from "../questions/actions";
import { moduleOuvrable, titreModule } from "../questions/commun";
import { LienModule } from "@/components/LienModule";

export const dynamic = "force-dynamic";

/**
 * Énoncé d'une question de la banque versionnée avec le site : absente de la
 * table des questions, elle ne sortait de la jointure que par son identifiant
 * (question 54, choix a + b).
 */
function enonceDuCode(moduleId: string, questionId: string): string | null {
  const m = getModule(moduleId);
  return m ? (banqueDuModule(m).find((q) => q.id === questionId)?.enonce ?? null) : null;
}

export default async function Signalements() {
  const [signalements, modules] = await Promise.all([listerSignalements(), getTousModulesAvecDeposes()]);
  const duCode = new Map(
    signalements.map((s) => [s.id, s.enonce || !s.question_id ? null : enonceDuCode(s.module_id, s.question_id)]),
  );
  return (
    <>
      <section className="panneau-titre">
        <h1>Signalements</h1>
        <p>
          Remarques déposées par les apprenants depuis la correction — motif fermé, note libre —,
          sur une question ou sur une fiche de synthèse. Le tutorat tranche : corriger, puis clore
          le signalement. Une question de la banque versionnée avec le site se corrige dans le code ;
          une fiche se corrige depuis la banque de son module, où elle repart « à vérifier ».
        </p>
      </section>
      <ul className="liste-nue">
        {signalements.map((s) => (
          <li key={s.id} className="carte">
            <div className="etape-tete">
              <span className={`etiquette ${s.statut === "ouvert" ? "etiquette--attention" : "etiquette--neutre"}`}>{LIBELLES_STATUT_SIGNALEMENT[s.statut]}</span>
              <strong>{s.motif}</strong>
              <span className="legende" style={{ marginLeft: "auto" }}>
                {new Date(s.cree_le).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })} ·{" "}
                <LienModule id={moduleOuvrable(modules, s.module_id)}>{titreModule(modules, s.module_id)}</LienModule>
              </span>
            </div>
            {s.depot_id !== null ? (
              // Fiche de synthèse (question 60) : sans effet sur les rapports.
              <p style={{ marginBottom: ".25rem" }}>
                <span className="etiquette etiquette--neutre">Fiche de synthèse</span>{" "}
                {s.fiche_titre && s.fiche_url ? (
                  <a href={s.fiche_url} target="_blank" rel="noreferrer">{s.fiche_titre}</a>
                ) : (
                  <span className="legende">Fiche supprimée depuis le signalement (dépôt {s.depot_id}).</span>
                )}
              </p>
            ) : (
              <p style={{ marginBottom: ".25rem" }}>
                {s.enonce ?? duCode.get(s.id) ?? (
                  <span className="legende">Question introuvable, supprimée ou renommée depuis le signalement : {s.question_id}</span>
                )}
              </p>
            )}
            {s.note && <p className="legende">« {s.note} »</p>}
            {s.depot_id !== null ? (
              <p className="legende">
                <Link href={`/admin/questions?module=${encodeURIComponent(s.module_id)}#fiches`}>
                  Corriger ou retirer la fiche dans la banque du module
                </Link>
              </p>
            ) : s.enonce ? (
              <p className="legende">
                <Link href={`/admin/questions/${s.question_id}`}>Ouvrir la question</Link>
              </p>
            ) : duCode.get(s.id) ? (
              <p className="legende">Banque versionnée avec le site : elle se corrige dans le code ({s.question_id}).</p>
            ) : null}
            {s.statut === "ouvert" ? (
              <form action={actionTraiterSignalement}>
                <input type="hidden" name="id" value={s.id} />
                <label className="champ">
                  <span>Réponse (facultative, visible ici seulement)</span>
                  <input type="text" name="reponse" maxLength={1000} />
                </label>
                <div className="actions">
                  <button type="submit" name="statut" value="traite" className="bouton bouton--compact">Clore — traité</button>
                  <button type="submit" formAction={actionRejeterSignalement} className="bouton bouton--compact bouton--secondaire">Rejeter</button>
                </div>
              </form>
            ) : (
              <p className="legende">
                {LIBELLES_STATUT_SIGNALEMENT[s.statut]} par {s.traite_par} le{" "}
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
