import Link from "next/link";
import { getSession } from "@/lib/auth";
import { comptesParModule, listerQuestions, type StatutQuestion } from "@/content/banque-db";
import { getTousModulesAvecDeposes } from "@/content/store";
import { actionChangerStatutQuestion, actionSupprimerQuestion } from "./actions";
import { LIBELLES_STATUT, etiquetteModule, titreModule as titreDe } from "./commun";
import { peutValider } from "@/content/quatre-yeux";
import { getReferentiel } from "@/content/referentiel-db";
import { ArbreBanque } from "@/components/ArbreBanque";
import { LIBELLES_NIVEAU_QUESTION, NIVEAUX_QUESTION, type NiveauQuestion } from "@/content/types";

export const dynamic = "force-dynamic";

const MESSAGES: Record<string, string> = {
  creee: "Question créée.",
  modifiee: "Question enregistrée.",
};

export default async function Questions({
  searchParams,
}: {
  searchParams: Promise<{ module?: string; statut?: string; niveau?: string; ok?: string; erreur?: string }>;
}) {
  const p = await searchParams;
  const session = (await getSession())!;
  const modules = await getTousModulesAvecDeposes();
  const statut = (["a_verifier", "valide", "retire"] as const).includes(p.statut as StatutQuestion)
    ? (p.statut as StatutQuestion)
    : undefined;
  const moduleId = modules.some((m) => m.id === p.module) ? p.module : undefined;
  // Filtre par niveau : « a_preciser » retient les questions sans niveau.
  const filtreNiveau: NiveauQuestion | "a_preciser" | undefined =
    p.niveau === "a_preciser"
      ? "a_preciser"
      : (NIVEAUX_QUESTION as readonly string[]).includes(p.niveau ?? "")
        ? (p.niveau as NiveauQuestion)
        : undefined;
  const [toutes, comptes, referentiel] = await Promise.all([
    listerQuestions({ moduleId, statut }),
    comptesParModule(),
    getReferentiel(),
  ]);
  const questions = filtreNiveau
    ? toutes.filter((q) => (filtreNiveau === "a_preciser" ? !q.niveau_question : q.niveau_question === filtreNiveau))
    : toutes;
  const parModule = new Map<string, typeof questions>();
  for (const q of questions) {
    const liste = parModule.get(q.module_id) ?? [];
    liste.push(q);
    parModule.set(q.module_id, liste);
  }
  const retour = `/admin/questions?${new URLSearchParams({
    ...(moduleId ? { module: moduleId } : {}),
    ...(statut ? { statut } : {}),
  }).toString()}`;
  const titreModule = (id: string) => titreDe(modules, id);

  return (
    <>
      <section className="panneau-titre">
        <h1>Banque de questions</h1>
        <p>
          Questions déposées par les tuteurs et administrateurs, en complément de la banque
          versionnée avec le site. Seules les questions <strong>validées</strong> entrent dans les
          tirages ; une question importée ou créée reste « à vérifier » jusqu&apos;à relecture.
        </p>
        <div className="actions" style={{ marginTop: 0 }}>
          <Link href={`/admin/questions/nouvelle${moduleId ? `?module=${encodeURIComponent(moduleId)}` : ""}`} className="bouton">
            Nouvelle question
          </Link>
          <Link href="/admin/questions/import" className="bouton bouton--secondaire">
            Déposer un texte ou un fichier
          </Link>
          <Link href="/admin/questions/situations" className="bouton bouton--secondaire">
            Mises en situation
          </Link>
        </div>
      </section>

      {p.ok && MESSAGES[p.ok] && <p className="encart encart--ok">{MESSAGES[p.ok]}</p>}
      {p.erreur === "quatre-yeux" && (
        <p className="encart encart--attention" role="alert">
          Règle des quatre yeux : une question se valide par un autre code que celui qui l&apos;a écrite (création ou dernière
          modification).
        </p>
      )}

      <ArbreBanque
        filieres={referentiel.filieres}
        niveaux={referentiel.niveaux}
        modules={modules.map((m) => ({
          id: m.id,
          titre: m.titre,
          etiquette: etiquetteModule(m),
          postes: m.postes ?? [],
          niveaux: (m.niveaux ?? []).map(String),
        }))}
        comptes={comptes}
        moduleActif={moduleId}
      />

      <form method="get" className="carte filtres">
        <div className="rangee">
          <label className="champ">
            <span>Module</span>
            <select name="module" defaultValue={moduleId ?? ""}>
              <option value="">Tous les modules</option>
              {modules.map((m) => {
                const c = comptes[m.id];
                return (
                  <option key={m.id} value={m.id}>
                    {etiquetteModule(m)} — {m.titre.slice(0, 60)}
                    {c
                      ? ` (${c.valides} validée${c.valides > 1 ? "s" : ""}, ${c.aVerifier} à vérifier${c.reservees ? `, ${c.reservees} réservée${c.reservees > 1 ? "s" : ""} à l'évaluation` : ""})`
                      : ""}
                  </option>
                );
              })}
            </select>
          </label>
          <label className="champ">
            <span>Statut</span>
            <select name="statut" defaultValue={statut ?? ""}>
              <option value="">Tous</option>
              <option value="a_verifier">À vérifier</option>
              <option value="valide">Validées</option>
              <option value="retire">Retirées</option>
            </select>
          </label>
          <label className="champ">
            <span>Niveau</span>
            <select name="niveau" defaultValue={filtreNiveau ?? ""}>
              <option value="">Tous</option>
              {NIVEAUX_QUESTION.map((n) => (
                <option key={n} value={n}>{LIBELLES_NIVEAU_QUESTION[n]}</option>
              ))}
              <option value="a_preciser">À préciser</option>
            </select>
          </label>
        </div>
        <div className="actions">
          <button type="submit" className="bouton bouton--compact bouton--secondaire">
            Filtrer
          </button>
          <span className="legende">{questions.length} question{questions.length > 1 ? "s" : ""}</span>
        </div>
      </form>

      {questions.length === 0 && (
        <p className="encart">Aucune question en base pour ce filtre. La banque versionnée avec le site n&apos;apparaît pas ici : elle se modifie dans <code>content/modules/</code>.</p>
      )}

      {[...parModule.entries()].map(([mid, liste]) => (
        <section key={mid} className="section">
          <div className="section-titre">
            <h2 style={{ fontSize: "1.15rem" }}>{titreModule(mid)}</h2>
            <span className="compte">
              <Link href={`/module/${mid}`}>voir le module</Link>
            </span>
          </div>
          <ul className="liste-nue">
            {liste.map((q) => (
              <li key={q.id} className="carte question-ligne">
                <div className="etape-tete">
                  <span className="etiquette etiquette--site">{q.format === "SCH" ? "Schéma" : q.format}</span>
                  <span className={`etiquette ${q.statut === "valide" ? "etiquette--ok" : q.statut === "retire" ? "etiquette--neutre" : "etiquette--attention"}`}>
                    {LIBELLES_STATUT[q.statut]}
                  </span>
                  {q.niveau_question ? (
                    <span className="etiquette etiquette--neutre">{LIBELLES_NIVEAU_QUESTION[q.niveau_question]}</span>
                  ) : (
                    <span className="etiquette etiquette--attention">Niveau à préciser</span>
                  )}
                  {q.eliminatoire && <span className="etiquette etiquette--obligatoire">Éliminatoire</span>}
                  {q.reservee && <span className="etiquette etiquette--neutre">Réservée à l&apos;évaluation</span>}
                  {q.situation_titre && <span className="etiquette etiquette--neutre">Situation : {q.situation_titre}</span>}
                  <span className="legende" style={{ marginLeft: "auto" }}>
                    v{q.version} · créée par {q.cree_par}
                    {q.edite_par && q.edite_par !== q.cree_par ? ` · modifiée par ${q.edite_par}` : ""}
                    {q.valide_par ? ` · validée par ${q.valide_par}` : ""}
                  </span>
                </div>
                <p className="question-enonce" style={{ fontSize: "1rem" }}>{q.enonce}</p>
                {q.format === "SCH" ? (
                  <p className="legende">
                    {q.legendes.length} légende{q.legendes.length > 1 ? "s" : ""} · réponse à {q.mode_reponse === "choisir" ? "choisir" : "écrire"}
                    {q.image_id ? "" : " · image manquante"}
                  </p>
                ) : (
                  <ul className="apercu-options">
                    {q.options.map((o) => (
                      <li key={o.id} className={o.vrai ? "vraie" : "fausse"}>
                        <span className="num">{o.id.toUpperCase()}</span> {o.texte}{" "}
                        <span className="legende">({o.vrai ? "vrai" : "faux"})</span>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="actions" style={{ marginTop: ".5rem" }}>
                  <Link href={`/admin/questions/${q.id}`} className="bouton bouton--compact bouton--secondaire">
                    Modifier
                  </Link>
                  {q.statut !== "valide" &&
                    (peutValider(q, session) ? (
                      <form action={actionChangerStatutQuestion}>
                        <input type="hidden" name="id" value={q.id} />
                        <input type="hidden" name="statut" value="valide" />
                        <input type="hidden" name="retour" value={retour} />
                        <button type="submit" className="bouton bouton--compact">Valider</button>
                      </form>
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
                      <button type="submit" className="bouton bouton--compact bouton--discret">Supprimer</button>
                    </form>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}
