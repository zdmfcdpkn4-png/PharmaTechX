import Link from "next/link";
import { notFound } from "next/navigation";
import { getModuleComplet, positionDansParcours } from "@/content/store";
import { getCritere, blocsCompetence } from "@/content/habilitation";
import { A_PRECISER, libelleNature } from "@/content/types";
import { baseConfiguree, depotsDuModule } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { STATUTS_MODULE } from "@/content/modules-db";
import { Corps } from "@/components/Corps";
import { LectureModule } from "@/components/LectureModule";

export const dynamic = "force-dynamic";

export default async function PageModule({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Un module déposé non publié n'est lisible qu'en tutorat ou en administration.
  const session = await getSession();
  const mod = await getModuleComplet(id, { inclureBrouillons: session?.role === "tuteur" || session?.role === "admin" });
  if (!mod) notFound();
  const depose = mod.origine === "base";

  const critere = typeof mod.critereId === "string" ? getCritere(mod.critereId) : undefined;
  const bloc = typeof mod.bloc === "number" ? blocsCompetence.find((b) => b.numero === mod.bloc) : undefined;
  const nbQuestions = mod.questions.length + mod.misesEnSituation.reduce((s, x) => s + x.questions.length, 0);
  const nbElim =
    mod.questions.filter((q) => q.eliminatoire).length +
    mod.misesEnSituation.reduce((s, x) => s + x.questions.filter((q) => q.eliminatoire).length, 0);
  const depots = baseConfiguree() ? await depotsDuModule(mod.id).catch(() => []) : [];
  const position = await positionDansParcours("integration", mod.id);
  const sommaire = mod.sections.map((s, i) => ({ id: `section-${i + 1}`, titre: s.titre }));

  const contenu = (
    <>
      {mod.sections.length > 0 && (
        <div className="corps-module">
          {mod.sections.map((s, i) => (
            <section key={i} id={`section-${i + 1}`} aria-labelledby={`titre-section-${i + 1}`}>
              <p className="sur-titre">Section {i + 1} sur {mod.sections.length}</p>
              <h2 id={`titre-section-${i + 1}`} tabIndex={-1}>{s.titre}</h2>
              <Corps texte={s.corps} />
              {s.references && s.references.length > 0 && (
                <details className="sources">
                  <summary>Sources de cette section</summary>
                  <ul>
                    {s.references.map((r, j) => (
                      <li key={j}>
                        {r.url ? (
                          <a href={r.url} target="_blank" rel="noreferrer">
                            {r.source} — {r.libelle}
                          </a>
                        ) : (
                          <>
                            {r.source} — {r.libelle}
                          </>
                        )}
                        {r.localisation ? ` · ${r.localisation}` : ""}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </section>
          ))}
        </div>
      )}

      {(mod.ressources.length > 0 || depots.length > 0) && (
        <section className="carte" style={{ marginTop: "1.5rem" }}>
          <div className="section-titre" style={{ marginTop: 0 }}>
            <h2>Documents rattachés</h2>
            <span className="compte">
              {mod.ressources.length + depots.length}
              {mod.ressources.some((r) => !r.url) ? ` · ${mod.ressources.filter((r) => !r.url).length} encore à rattacher` : ""}
            </span>
          </div>
          <ul className="liste-nue">
            {depots.map((d) => (
              <li key={`d-${d.id}`}>
                <span className="etiquette etiquette--neutre">{libelleNature(d.nature)}</span>{" "}
                <a href={d.url} target="_blank" rel="noreferrer">
                  {d.titre}
                </a>{" "}
                <span className="legende">— déposé le {new Date(d.depose_le).toLocaleDateString("fr-FR")}</span>
              </li>
            ))}
            {mod.ressources.map((r) => (
              <li key={r.id} className={r.url ? "" : "est-vide"}>
                <span className="etiquette etiquette--neutre">{libelleNature(r.nature)}</span>{" "}
                {r.url ? (
                  <a href={r.url} target="_blank" rel="noreferrer">
                    {r.titre}
                  </a>
                ) : (
                  <>
                    {r.titre} — <code className="a-preciser">à rattacher</code>{" "}
                    <span className="legende">{r.commentaire ?? "document à déposer"}</span>
                  </>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="encart" style={{ marginTop: "1.5rem" }}>
        <h2 style={{ fontSize: "1.1rem", marginBottom: ".25rem" }}>
          {nbQuestions > 0
            ? `L'évaluation de ce critère comporte ${nbQuestions} question${nbQuestions > 1 ? "s" : ""}`
            : "Ce critère n'a pas encore d'évaluation"}
        </h2>
        <p style={{ marginBottom: nbQuestions > 0 ? ".75rem" : 0 }}>
          {nbQuestions > 0 ? (
            <>
              QCM, QIM{mod.questions.some((q) => q.type === "SCH") ? ", schémas" : ""}
              {mod.misesEnSituation.length > 0 ? ` et ${mod.misesEnSituation.length} mise${mod.misesEnSituation.length > 1 ? "s" : ""} en situation` : ""}
              {nbElim > 0 ? ` — ${nbElim} question${nbElim > 1 ? "s" : ""} éliminatoire${nbElim > 1 ? "s" : ""}` : ""}.
              Réussir cette évaluation ne vaut pas habilitation : elle constitue la preuve de l&apos;étape 2 sur 6.
            </>
          ) : (
            <>Les tuteurs peuvent en déposer une depuis l&apos;administration.</>
          )}
        </p>
        {position && (
          <p className="legende" style={{ marginBottom: ".75rem" }}>
            Parcours : {position.libelle}, module {position.rang} sur {position.total}
            {position.precedent ? <> · précédent : <Link href={`/module/${position.precedent.id}`}>{position.precedent.titre}</Link></> : null}
            {position.suivant ? <> · suivant : <Link href={`/module/${position.suivant.id}`}>{position.suivant.titre}</Link></> : " · dernier de la liste"}
          </p>
        )}
        <div className="actions" style={{ marginTop: 0 }}>
          {nbQuestions > 0 && (
            <Link href={`/module/${mod.id}/evaluation`} className="bouton">
              Passer l&apos;évaluation
            </Link>
          )}
          {position?.suivant && (
            <Link href={`/module/${position.suivant.id}`} className="bouton bouton--secondaire">
              Module suivant
            </Link>
          )}
          <Link href="/" className="bouton bouton--secondaire">
            Retour au programme
          </Link>
        </div>
      </section>

      {mod.bibliographie.length > 0 && (
        <div className="references" style={{ marginTop: "2rem" }}>
          <strong>Bibliographie du module</strong>
          <ol>
            {mod.bibliographie.map((r, i) => (
              <li key={i}>
                {r.url ? (
                  <a href={r.url} target="_blank" rel="noreferrer">
                    {r.libelle}
                  </a>
                ) : (
                  r.libelle
                )}{" "}
                — {r.source}, {r.date}
                {r.localisation ? ` · ${r.localisation}` : ""}
              </li>
            ))}
          </ol>
        </div>
      )}
    </>
  );

  return (
    <article>
      <p className="fil">
        <Link href="/">Programme</Link> › {typeof mod.critereId === "string" && mod.critereId !== A_PRECISER ? mod.critereId : mod.titre}
      </p>

      <section className="panneau-titre">
        <ul className="meta-module" style={{ margin: 0 }}>
          {depose ? (
            <li className="etiquette etiquette--site">Module déposé</li>
          ) : null}
          {depose && mod.critereId === A_PRECISER ? null : (
            <li className="etiquette etiquette--code">
              {mod.critereId === A_PRECISER ? <code className="a-preciser">{A_PRECISER}</code> : mod.critereId}
            </li>
          )}
          {critere?.obligatoire && <li className="etiquette etiquette--obligatoire">Obligatoire</li>}
          <li className="legende">
            {bloc ? `Bloc ${bloc.numero} — ` : ""}
            {mod.affectation === "tronc-commun"
              ? "tronc commun, tous postes"
              : depose
                ? `filière${mod.postes.length > 1 ? "s" : ""} ${mod.postes.join(", ")}`
                : "critère de poste"}
            {mod.niveaux.length > 0 ? ` · niveau${mod.niveaux.length > 1 ? "x" : ""} ${mod.niveaux.join(", ")}` : depose ? " · tous niveaux" : ""}
            {" · "}revalidation {typeof mod.periodiciteMois === "number" ? `${mod.periodiciteMois} mois` : A_PRECISER}
          </li>
        </ul>
        <h1>{mod.titre}</h1>
        <p style={{ fontSize: "1.0625rem", maxWidth: "58ch" }}>{mod.objectif}</p>
        <ul className="meta-module" style={{ margin: 0 }}>
          {mod.sections.length > 0 && (
            <li className="etiquette etiquette--neutre">
              {mod.sections.length} section{mod.sections.length > 1 ? "s" : ""}
              {typeof mod.dureeMinutes === "number" && mod.dureeMinutes > 0 ? ` · ${mod.dureeMinutes} min` : ""}
            </li>
          )}
          {nbQuestions > 0 && (
            <li className="etiquette etiquette--neutre">
              {nbQuestions} question{nbQuestions > 1 ? "s" : ""}
              {mod.misesEnSituation.length > 0 ? ` · ${mod.misesEnSituation.length} mise${mod.misesEnSituation.length > 1 ? "s" : ""} en situation` : ""}
            </li>
          )}
          <li className="etiquette etiquette--neutre">
            Seuil {mod.seuilReussite} %{nbElim > 0 ? ` · ${nbElim} éliminatoire${nbElim > 1 ? "s" : ""}` : ""}
          </li>
        </ul>
      </section>

      {!mod.redige && (
        <p className="encart encart--attention">
          Ce critère est un emplacement ouvert : son contenu de formation reste à rédiger.
          {nbQuestions > 0 ? " Son évaluation, elle, est disponible à partir des questions déposées." : ""}
        </p>
      )}
      {depose && mod.statut !== "publie" && (
        <p className="encart encart--attention">
          Module déposé au statut « {STATUTS_MODULE[mod.statut ?? "brouillon"]} » : visible des tuteurs et
          administrateurs seulement, absent du programme des apprenants.
        </p>
      )}

      {sommaire.length > 0 ? (
        <LectureModule moduleId={mod.id} sommaire={sommaire}>
          {contenu}
        </LectureModule>
      ) : (
        contenu
      )}
    </article>
  );
}
