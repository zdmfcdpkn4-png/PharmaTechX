import Link from "next/link";
import type { LigneQuestion } from "@/content/banque-db";
import { peutValider, validationParAuteur, type CodeActeur } from "@/content/quatre-yeux";
import { LIBELLES_NIVEAU_QUESTION, type LibellesNiveaux } from "@/content/niveaux-questions";
import { CONSEILS_REPERE, LIBELLES_REPERE, SEUILS_STAT, questionARevoir, type Repere, type Taux } from "@/lib/statistiques";
import { actionChangerStatutQuestion, actionSupprimerQuestion } from "./actions";
import { LIBELLES_STATUT } from "./commun";

/**
 * Une question de la banque, en pièces partagées par la liste et
 * l'arborescence (question 64, choix b, 23/09/2026) : les deux vues montrent
 * la même question avec les mêmes boutons, et un geste ajouté ici l'est dans
 * les deux.
 */

/**
 * Format, statut, signalements, niveau et rôle dans le tirage. `ici` : le
 * module sous lequel la question est montrée ; `horsProfil` : ses étiquettes
 * de profil excluent la branche où elle est montrée (question 74).
 */
export function EtiquettesQuestion({
  q,
  signalements,
  ici,
  horsProfil = false,
  stat,
  libellesNiveaux = LIBELLES_NIVEAU_QUESTION,
}: {
  q: LigneQuestion;
  signalements: number;
  ici?: string;
  horsProfil?: boolean;
  /** Statistiques de réussite (question 78), tous modules confondus. */
  stat?: StatQuestion;
  /** Noms des niveaux de question en vigueur (question 81). */
  libellesNiveaux?: LibellesNiveaux;
}) {
  return (
    <>
      <span className="etiquette etiquette--site">{q.format === "SCH" ? "Schéma" : q.format}</span>
      <span className={`etiquette ${q.statut === "valide" ? "etiquette--ok" : q.statut === "retire" ? "etiquette--neutre" : "etiquette--attention"}`}>
        {LIBELLES_STATUT[q.statut]}
      </span>
      {/* Validation par son auteur, permise à l'administration seule (23/09/2026) : elle se distingue. */}
      {q.statut === "valide" && q.valide_par_auteur && <span className="etiquette etiquette--neutre">Validée par son auteur</span>}
      {/* Question 54 (a + b) : le signalement se voit là où la question se corrige. */}
      {signalements > 0 && (
        <span className="etiquette etiquette--attention">
          {signalements} signalement{signalements > 1 ? "s" : ""} ouvert{signalements > 1 ? "s" : ""}
        </span>
      )}
      {q.niveau_question ? (
        <span className="etiquette etiquette--neutre">{libellesNiveaux[q.niveau_question]}</span>
      ) : (
        <span className="etiquette etiquette--attention">Niveau à préciser</span>
      )}
      {q.eliminatoire && <span className="etiquette etiquette--obligatoire">Éliminatoire</span>}
      {q.reservee && <span className="etiquette etiquette--neutre">Réservée à l&apos;évaluation</span>}
      {q.obligatoire && <span className="etiquette etiquette--neutre">Obligatoire</span>}
      {q.situation_titre && <span className="etiquette etiquette--neutre">Situation : {q.situation_titre}</span>}
      {/* Question 74 : posée dans plusieurs modules, limitée à des profils. */}
      {ici && ici !== q.module_id ? (
        <span className="etiquette etiquette--neutre">Aussi posée ici</span>
      ) : (
        q.aussi_dans.length > 0 && (
          <span className="etiquette etiquette--neutre">
            Posée dans {q.aussi_dans.length + 1} modules
          </span>
        )
      )}
      {(q.profil_filieres.length > 0 || q.profil_niveaux.length > 0) && (
        <span className={`etiquette ${horsProfil ? "etiquette--attention" : "etiquette--neutre"}`}>
          {horsProfil ? "Hors du profil de cette branche" : "Profils limités"}
        </span>
      )}
      {stat && questionARevoir(stat.reperes) && <span className="etiquette etiquette--attention">À revoir (statistiques)</span>}
    </>
  );
}

/** Réussite et discrimination d'une question sur les essais conservés (question 78, choix a). */
export interface StatQuestion {
  reussite: Taux;
  discrimination: number | null;
  reperes: Repere[];
}

/**
 * Ce que disent les essais d'une question, et le lien vers sa ligne dans la
 * fiche statistique de son module. Rien tant qu'elle n'a pas été posée.
 */
export function StatistiqueQuestion({ q, stat, ici }: { q: LigneQuestion; stat?: StatQuestion; ici?: string }) {
  if (!stat || stat.reussite.n === 0) return null;
  const moduleVu = ici ?? q.module_id;
  const r = stat.reussite;
  return (
    <p className="legende stat-question">
      Statistiques :{" "}
      {r.taux === null
        ? `posée ${r.n} fois — un taux à partir de ${SEUILS_STAT.effectif} agents`
        : `réussie ${r.taux} % (IC 95 % ${r.bas}–${r.haut}) sur ${r.n} essais`}
      {stat.discrimination !== null && ` · discrimination ${String(stat.discrimination).replace(".", ",")}`}
      {stat.reperes.map((x: Repere) => (
        <span key={x}>
          {" · "}
          <strong>{LIBELLES_REPERE[x]}</strong>
          {x !== "tres-facile" && ` : ${CONSEILS_REPERE[x]}`}
        </span>
      ))}
      {" · "}
      <Link href={`/admin/statistiques/${encodeURIComponent(moduleVu)}#q-${encodeURIComponent(q.id)}`}>Analyse</Link>
    </p>
  );
}

/** Ce qu'il faut pour dire en clair où une question est posée (question 74). */
export interface LecturesRattachement {
  /** « Critère — titre » d'un module, ou son identifiant s'il n'existe plus. */
  titreModule: (id: string) => string;
  /** Blocs de la question : ceux de ses modules et ceux de ses étiquettes. */
  blocs: (q: LigneQuestion) => number[];
  /** Étiquettes de profil en clair ; vide sans étiquette. */
  profils: (q: LigneQuestion) => string;
}

/**
 * Où la question est posée, ses blocs et ses profils (question 74, choix c) —
 * seulement quand elle a d'autres modules ou des étiquettes, ou qu'elle est
 * montrée sous un module qui n'est pas le sien.
 */
export function RattachementQuestion({
  q,
  lectures,
  ici,
}: {
  q: LigneQuestion;
  lectures: LecturesRattachement;
  ici?: string;
}) {
  const profils = lectures.profils(q);
  const ailleurs = Boolean(ici && ici !== q.module_id);
  if (q.aussi_dans.length === 0 && q.blocs.length === 0 && !profils && !ailleurs) return null;
  const blocs = lectures.blocs(q);
  return (
    <p className="legende rattachement-question">
      Module d&apos;origine : {lectures.titreModule(q.module_id)}
      {ailleurs ? " — elle s'y modifie et s'y valide" : ""}
      {q.aussi_dans.length > 0 && <> · aussi posée dans : {q.aussi_dans.map(lectures.titreModule).join(" ; ")}</>}
      {blocs.length > 0 && <> · bloc{blocs.length > 1 ? "s" : ""} {blocs.join(", ")}</>}
      {profils && <> · profils : {profils}</>}
    </p>
  );
}

/** Version, auteur, modification, validation. */
export function TraceQuestion({ q }: { q: LigneQuestion }) {
  return (
    <span className="legende" style={{ marginLeft: "auto" }}>
      v{q.version} · créée par {q.cree_par}
      {q.edite_par && q.edite_par !== q.cree_par ? ` · modifiée par ${q.edite_par}` : ""}
      {q.valide_par ? ` · validée par ${q.valide_par}${q.valide_par_auteur ? " (son auteur)" : ""}` : ""}
    </span>
  );
}

/** Propositions avec leur verdict, ou résumé d'un schéma ; puis justification et source. */
export function ContenuQuestion({ q }: { q: LigneQuestion }) {
  return (
    <>
      {q.format === "SCH" ? (
        <p className="legende">
          {q.legendes.length} légende{q.legendes.length > 1 ? "s" : ""} · réponse à {q.mode_reponse === "choisir" ? "choisir" : q.mode_reponse === "decouvrir" ? "découvrir avec le tuteur" : "écrire"}
          {q.image_id ? "" : " · image manquante"}
        </p>
      ) : (
        <ul className="apercu-options">
          {q.options.map((o) => (
            <li key={o.id} className={o.vrai ? "vraie" : "fausse"}>
              <span className="num">{o.id.toUpperCase()}</span> {o.texte} <span className="legende">({o.vrai ? "vrai" : "faux"})</span>
            </li>
          ))}
        </ul>
      )}
      <JustificationQuestion q={q} />
    </>
  );
}

/**
 * Justification et source, que le relecteur confronte au document d'origine
 * avant de valider (24/09/2026) : la justification porte l'extrait du
 * document quand le dépôt en donnait un. Visibles tant que la question est à
 * vérifier, repliées ensuite.
 */
function JustificationQuestion({ q }: { q: LigneQuestion }) {
  const justification = q.justification.trim();
  const contenu = (
    <>
      <p>
        <strong>Justification</strong> :{" "}
        {justification || <span className="legende">aucune — à écrire dans l&apos;éditeur, d&apos;après le document</span>}
      </p>
      {q.refs.length > 0 && (
        <p className="legende">
          Source :{" "}
          {q.refs.map((r, i) => (
            <span key={i}>
              {i > 0 ? " ; " : ""}
              {[r.source, r.libelle, r.date, r.localisation].filter(Boolean).join(" — ")}
              {r.url && (
                <>
                  {" — "}
                  <a href={r.url} target="_blank" rel="noopener noreferrer">lien</a>
                </>
              )}
            </span>
          ))}
        </p>
      )}
    </>
  );
  return q.statut === "a_verifier" ? (
    <div className="relecture">{contenu}</div>
  ) : (
    <details className="relecture">
      <summary>Justification et source</summary>
      {contenu}
    </details>
  );
}

/**
 * Modifier, Valider, Remettre à vérifier, Retirer, Supprimer. `retour` est
 * l'adresse où revenir après le geste ; `retourSuppression`, celle d'après une
 * suppression — la question n'existant plus, l'arborescence rouvre son module.
 * Sans elle, la suppression ramène à la liste du module, comme avant.
 */
export function ActionsQuestion({
  q,
  session,
  retour,
  modifier = `/admin/questions/${q.id}`,
  retourSuppression,
}: {
  q: LigneQuestion;
  session: CodeActeur;
  retour: string;
  modifier?: string;
  retourSuppression?: string;
}) {
  return (
    <div className="actions" style={{ marginTop: ".5rem" }}>
      <Link href={modifier} className="bouton bouton--compact bouton--secondaire">
        Modifier
      </Link>
      {q.statut !== "valide" &&
        (peutValider(q, session) ? (
          <>
            <form action={actionChangerStatutQuestion}>
              <input type="hidden" name="id" value={q.id} />
              <input type="hidden" name="statut" value="valide" />
              <input type="hidden" name="retour" value={retour} />
              <button type="submit" className="bouton bouton--compact">Valider</button>
            </form>
            {/* L'écart aux quatre yeux se dit avant le geste, pas seulement après. */}
            {validationParAuteur(q, session) && (
              <span className="legende" style={{ alignSelf: "center" }}>
                vous en êtes l&apos;auteur : validation tracée comme telle
              </span>
            )}
          </>
        ) : (
          <span className="legende" style={{ alignSelf: "center" }}>
            à valider par un autre code que {q.edite_par ?? q.cree_par}
          </span>
        ))}
      {q.statut === "valide" && (
        <form action={actionChangerStatutQuestion}>
          <input type="hidden" name="id" value={q.id} />
          <input type="hidden" name="statut" value="a_verifier" />
          <input type="hidden" name="retour" value={retour} />
          <button type="submit" className="bouton bouton--compact bouton--secondaire">Remettre à vérifier</button>
        </form>
      )}
      {q.statut !== "retire" && (
        <form action={actionChangerStatutQuestion}>
          <input type="hidden" name="id" value={q.id} />
          <input type="hidden" name="statut" value="retire" />
          <input type="hidden" name="retour" value={retour} />
          <button type="submit" className="bouton bouton--compact bouton--secondaire">Retirer</button>
        </form>
      )}
      {session.role === "admin" && (
        <form action={actionSupprimerQuestion}>
          <input type="hidden" name="id" value={q.id} />
          {retourSuppression && <input type="hidden" name="retour" value={retourSuppression} />}
          <button type="submit" className="bouton bouton--compact bouton--discret">Supprimer</button>
        </form>
      )}
    </div>
  );
}
