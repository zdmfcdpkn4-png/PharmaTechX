import Link from "next/link";
import { PLAFOND_SIGNALEMENTS, listerSignalements } from "@/content/banque-db";
import { LIBELLES_STATUT_SIGNALEMENT } from "@/content/signalements";
import { getModule, getTousModulesAvecDeposes } from "@/content/store";
import { banqueDuModule } from "@/content/types";
import { actionRejeterSignalement, actionTraiterSignalement } from "../questions/actions";
import { moduleOuvrable, titreModule } from "../questions/commun";
import { LienModule } from "@/components/LienModule";
import { BarreFiltres } from "@/components/BarreFiltres";
import { adresseDuFiltre } from "@/content/filtres";
import {
  ETATS_SIGNALEMENT,
  MOTIFS_FILTRE,
  OBJETS_SIGNALEMENT,
  lireFiltreSignalements,
  signalementRetenu,
} from "@/content/filtres-listes";

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

export default async function Signalements({
  searchParams,
}: {
  /** Question 91 (lot 3) : état, motif, objet, module. */
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [lus, modules, p] = await Promise.all([listerSignalements(), getTousModulesAvecDeposes(), searchParams]);
  // Les modules cités par un signalement : la liste du filtre « Module ».
  const modulesCites = [...new Set(lus.map((s) => s.module_id))]
    .map((id) => ({ id, titre: titreModule(modules, id) }))
    .sort((a, b) => a.titre.localeCompare(b.titre, "fr"));
  const filtre = lireFiltreSignalements(p, modulesCites.map((m) => m.id));
  const signalements = lus.filter((s) => signalementRetenu(s, filtre));
  // Traiter ou rejeter revient à cette liste, filtre compris (question 92, choix a).
  const liste = adresseDuFiltre("/admin/signalements", filtre);
  const duCode = new Map(
    signalements.map((s) => [s.id, s.enonce || !s.question_id ? null : enonceDuCode(s.module_id, s.question_id)]),
  );
  return (
    <>
      <section className="panneau-titre">
        <h1>Signalements</h1>
        <p>Les remarques des apprenants sur une question ou une fiche de synthèse. Corrigez, puis closez le signalement.</p>
      </section>
      {/* La barre de la banque (question 91, choix a, lot 3). */}
      {lus.length > 0 && (
        <BarreFiltres
          adresse="/admin/signalements"
          champs={[
            { nom: "etat", libelle: "État", options: ETATS_SIGNALEMENT, valeur: filtre.etat, minuscule: true },
            { nom: "motif", libelle: "Motif", options: MOTIFS_FILTRE.map((m) => ({ valeur: m, libelle: m })), valeur: filtre.motif, minuscule: true },
            { nom: "objet", libelle: "Objet", options: OBJETS_SIGNALEMENT, valeur: filtre.objet, minuscule: true },
          ]}
          plus={[
            {
              nom: "module",
              libelle: "Module",
              options: modulesCites.map((m) => ({ valeur: m.id, libelle: m.titre.slice(0, 70) })),
              valeur: filtre.module,
              large: true,
            },
          ]}
          retenus={signalements.length}
          total={lus.length}
          unite={["signalement", "signalements"]}
          plafond={lus.length === PLAFOND_SIGNALEMENTS ? `(lus parmi les ${PLAFOND_SIGNALEMENTS} premiers, les ouverts d'abord)` : undefined}
        />
      )}
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
                {/* Venu de l'introduction (question 91), sous le lien qui y mène. */}
                {" "}: corrigée, elle repart « à vérifier ».
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
                <input type="hidden" name="liste" value={liste} />
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
        {signalements.length === 0 && (
          <li className="legende">{lus.length === 0 ? "Aucun signalement." : "Aucun signalement ne correspond à ces filtres."}</li>
        )}
      </ul>
    </>
  );
}
