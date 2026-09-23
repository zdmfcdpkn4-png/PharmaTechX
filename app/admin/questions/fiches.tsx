import { auteurCourant, peutValider, validationParAuteur, type CodeActeur } from "@/content/quatre-yeux";
import { LIBELLES_STATUT_FICHE, auteurDeFiche, mentionValidation } from "@/content/fiches";
import type { LigneFiche } from "@/lib/fiches-db";
import {
  actionCorrigerFiche,
  actionDeposerFiche,
  actionRemettreFiche,
  actionRetirerFiche,
  actionValiderFiche,
} from "./fiches-actions";
import { LienModule } from "@/components/LienModule";

/**
 * Fiches de synthèse dans la banque (questions 59 et 60, choix a,
 * 23/09/2026). Sur un module : toutes ses fiches et le dépôt d'une nouvelle ;
 * sans module, filtre « à vérifier » : les fiches qui attendent une
 * validation, tous modules confondus.
 */
export function SectionFiches({
  fiches,
  moduleId,
  titreModule,
  ouvrable,
  session,
  retour,
}: {
  fiches: LigneFiche[];
  moduleId?: string;
  titreModule: (id: string) => string;
  /** Identifiant du module s'il s'ouvre encore, pour un lien (tâche 69). */
  ouvrable: (id: string) => string | null;
  session: CodeActeur;
  retour: string;
}) {
  if (!moduleId && fiches.length === 0) return null;
  const date = (texte: string) => new Date(texte).toLocaleDateString("fr-FR");
  return (
    <section id="fiches" className="carte fiches-banque" aria-labelledby="t-fiches">
      <h2 id="t-fiches" style={{ fontSize: "1.15rem", marginTop: 0 }}>
        Fiches de synthèse{moduleId ? "" : " à vérifier"}
      </h2>
      <p className="legende">
        Montrées en fin de test et d&apos;entraînement une fois validées, par un autre code que leur auteur — ou par
        lui s&apos;il est d&apos;administration, validation tracée. Le rapport d&apos;évaluation cite la fiche montrée. Une
        fiche signalée se corrige ici : la version corrigée repart « à vérifier ».
      </p>
      {fiches.length === 0 && <p className="legende">Aucune fiche pour ce module.</p>}
      <ul className="liste-nue">
        {fiches.map((f) => {
          const auteur = auteurDeFiche(f);
          const peut = peutValider(auteur, session);
          return (
            <li key={f.id} className="fiche-ligne">
              <div className="etape-tete">
                <span
                  className={`etiquette ${f.statut === "valide" ? "etiquette--ok" : f.statut === "retire" ? "etiquette--neutre" : "etiquette--attention"}`}
                >
                  {LIBELLES_STATUT_FICHE[f.statut]}
                </span>
                {f.statut === "valide" && f.valide_par_auteur && (
                  <span className="etiquette etiquette--neutre">Validée par son auteur</span>
                )}
                {f.signalements_ouverts > 0 && (
                  <span className="etiquette etiquette--attention">
                    {f.signalements_ouverts} signalement{f.signalements_ouverts > 1 ? "s" : ""} ouvert{f.signalements_ouverts > 1 ? "s" : ""}
                  </span>
                )}
                <a href={f.url} target="_blank" rel="noreferrer">
                  {f.titre}
                </a>
              </div>
              <p className="legende" style={{ margin: ".25rem 0" }}>
                {moduleId ? "" : (
                  <>
                    <LienModule id={ouvrable(f.module_id)}>{titreModule(f.module_id)}</LienModule>
                    {" · "}
                  </>
                )}
                déposée le {date(f.depose_le)} par {f.depose_par}
                {f.edite_par && f.edite_le ? ` · corrigée le ${date(f.edite_le)} par ${f.edite_par}` : ""}
                {f.statut === "valide"
                  ? ` · ${mentionValidation({
                      valideeLe: f.valide_le,
                      valideePar: f.valide_par,
                      valideeParAuteur: f.valide_par_auteur,
                      deposeeLe: f.depose_le,
                    })}`
                  : ""}
              </p>
              <div className="actions" style={{ marginTop: ".25rem" }}>
                {f.statut === "a_verifier" &&
                  (peut ? (
                    <>
                      <form action={actionValiderFiche}>
                        <input type="hidden" name="id" value={f.id} />
                        <input type="hidden" name="retour" value={retour} />
                        <button type="submit" className="bouton bouton--compact">
                          Valider la fiche
                        </button>
                      </form>
                      {validationParAuteur(auteur, session) && (
                        <span className="legende">vous en êtes l&apos;auteur : validation tracée comme telle</span>
                      )}
                    </>
                  ) : (
                    <span className="legende">à valider par un autre code que {auteurCourant(auteur).libelle}</span>
                  ))}
                {f.statut !== "retire" ? (
                  <form action={actionRetirerFiche}>
                    <input type="hidden" name="id" value={f.id} />
                    <input type="hidden" name="retour" value={retour} />
                    <button type="submit" className="bouton bouton--compact bouton--secondaire">
                      Retirer la fiche
                    </button>
                  </form>
                ) : (
                  <form action={actionRemettreFiche}>
                    <input type="hidden" name="id" value={f.id} />
                    <input type="hidden" name="retour" value={retour} />
                    <button type="submit" className="bouton bouton--compact bouton--secondaire">
                      Remettre à vérifier
                    </button>
                  </form>
                )}
              </div>
              <details className="fiche-correction">
                <summary>Déposer une version corrigée</summary>
                <form action={actionCorrigerFiche} className="rangee" style={{ alignItems: "end" }}>
                  <input type="hidden" name="id" value={f.id} />
                  <input type="hidden" name="retour" value={retour} />
                  <label className="champ">
                    <span>Fichier corrigé</span>
                    <input type="file" name="fichier" required aria-label={`Fichier corrigé de la fiche ${f.titre}`} />
                  </label>
                  <div className="actions" style={{ marginTop: 0 }}>
                    <button type="submit" className="bouton bouton--compact">
                      Remplacer — la fiche repart à vérifier
                    </button>
                  </div>
                </form>
              </details>
            </li>
          );
        })}
      </ul>
      {moduleId && (
        <form action={actionDeposerFiche} className="fiche-depot">
          <input type="hidden" name="moduleId" value={moduleId} />
          <input type="hidden" name="retour" value={retour} />
          <div className="rangee">
            <label className="champ">
              <span>Nouvelle fiche (PDF ou image de préférence)</span>
              <input type="file" name="fichier" required />
            </label>
            <label className="champ">
              <span>Titre</span>
              <input type="text" name="titre" maxLength={200} placeholder="Fiche de synthèse — …" />
            </label>
          </div>
          <div className="actions" style={{ marginTop: 0 }}>
            <button type="submit" className="bouton bouton--compact">
              Déposer la fiche, à vérifier
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
