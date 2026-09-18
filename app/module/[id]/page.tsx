import Link from "next/link";
import { notFound } from "next/navigation";
import { getModule, getTousModules } from "@/content/store";
import { A_PRECISER } from "@/content/types";
import { Corps } from "@/components/Corps";

export function generateStaticParams() {
  return getTousModules()
    .filter((m) => m.redige)
    .map((m) => ({ id: m.id }));
}

const NATURES: Record<string, string> = {
  "procedure-interne": "Procédure interne",
  reglementaire: "Référentiel",
  "fiche-reflexe": "Fiche réflexe",
  video: "Vidéo",
};

export default async function PageModule({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const mod = getModule(id);
  if (!mod) notFound();

  const nbQuestions =
    mod.questions.length +
    mod.misesEnSituation.reduce((s, x) => s + x.questions.length, 0);

  return (
    <article>
      <p className="fil">
        <Link href="/">Programme</Link> › {mod.titre}
      </p>

      <section className="panneau-titre">
        <h1>{mod.titre}</h1>
        <p>{mod.objectif}</p>
      </section>

      <ul className="meta-module">
        <li className="etiquette etiquette--neutre">
          Bloc{" "}
          {typeof mod.bloc === "number" ? (
            mod.bloc
          ) : (
            <code className="a-preciser">{A_PRECISER}</code>
          )}
        </li>
        <li className="etiquette etiquette--neutre">
          {mod.affectation === "tronc-commun"
            ? "Tronc commun — tous postes"
            : "Critère de poste"}
        </li>
        <li className="etiquette etiquette--neutre">
          Critère{" "}
          {mod.critereId === A_PRECISER ? (
            <code className="a-preciser">{A_PRECISER}</code>
          ) : (
            mod.critereId
          )}
        </li>
        <li className="etiquette">
          {typeof mod.dureeMinutes === "number"
            ? `${mod.dureeMinutes} min`
            : "durée à préciser"}
        </li>
        <li className="etiquette">Seuil {mod.seuilReussite} %</li>
      </ul>

      {!mod.redige && (
        <p className="encart encart--attention">
          Ce critère est un emplacement ouvert : son contenu reste à rédiger.
        </p>
      )}

      <div className="corps-module">
        {mod.sections.map((s, i) => (
          <section key={i}>
            <h2>{s.titre}</h2>
            <Corps texte={s.corps} />
            {s.references && s.references.length > 0 && (
              <div className="references">
                <strong>Sources de cette section</strong>
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
              </div>
            )}
          </section>
        ))}
      </div>

      {mod.ressources.length > 0 && (
        <>
          <div className="section-titre">
            <h2>Documents rattachés</h2>
            <span className="compte">{mod.ressources.length}</span>
          </div>
          <ul className="liste-nue">
            {mod.ressources.map((r) => (
              <li key={r.id} className={r.url ? "" : "est-vide"}>
                <span className="etiquette etiquette--neutre">
                  {NATURES[r.nature] ?? r.nature}
                </span>{" "}
                {r.url ? (
                  <a href={r.url} target="_blank" rel="noreferrer">
                    {r.titre}
                  </a>
                ) : (
                  <>
                    {r.titre} —{" "}
                    <span className="legende">
                      {r.commentaire ?? "document à déposer"}
                    </span>
                  </>
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      {mod.misesEnSituation.length > 0 && (
        <p className="encart">
          L&apos;évaluation de ce critère comporte {nbQuestions} questions —
          QCM, QIM et {mod.misesEnSituation.length} mise
          {mod.misesEnSituation.length > 1 ? "s" : ""} en situation. Les
          questions marquées éliminatoires invalident le critère en cas
          d&apos;erreur, quel que soit le score global.
        </p>
      )}

      <div className="actions">
        {nbQuestions > 0 && (
          <Link href={`/module/${mod.id}/evaluation`} className="bouton">
            Passer l&apos;évaluation
          </Link>
        )}
        <Link href="/" className="bouton bouton--secondaire">
          Retour au programme
        </Link>
      </div>

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
    </article>
  );
}
