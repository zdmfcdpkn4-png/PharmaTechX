import { ImportQuestions } from "@/components/ImportQuestions";
import { PromptDepot } from "@/components/PromptDepot";
import { EXEMPLE_DEPOT } from "@/content/prompt-depot";
import { actionAnalyserImport, actionConfirmerImport } from "../actions";
import { choixModules } from "../commun";

export const dynamic = "force-dynamic";

export default async function Import({ searchParams }: { searchParams: Promise<{ module?: string }> }) {
  const p = await searchParams;
  return (
    <>
      <section className="panneau-titre">
        <h1>Déposer des questions</h1>
        <p>
          Collez un texte ou déposez un fichier (.txt, .md, .docx, .json). L&apos;analyse ne devine
          rien : les verdicts viennent du corrigé écrit dans le texte. Chaque question est montrée
          avant d&apos;être ajoutée, au statut « à vérifier ».
        </p>
      </section>
      <details className="bloc" style={{ marginBottom: "1rem" }}>
        <summary>Format attendu</summary>
        <div className="contenu-bloc">
          <pre className="exemple">{EXEMPLE_DEPOT}</pre>
          <p className="legende">
            Le mot-clé QCM ou QIM fixe le format ; sans lui, le format par défaut s&apos;applique. Un
            corrigé se lit dans « (V) / (F) » en fin de proposition ou dans « Réponses : A C ».
            Pour un schéma, les quatre nombres sont le rectangle du mot d&apos;origine (x, y,
            largeur, hauteur en % de l&apos;image) ; deux nombres posent un repère sans cache. Un
            JSON exporté de ce site ou une banque au schéma 3.0 du Lecteur QIM · QCM sont aussi lus.
            Une question de n&apos;importe quel format peut porter une{" "}
            <strong>illustration</strong> : la ligne « Image : nom-du-fichier.png » l&apos;attache
            au fichier déposé du même nom, ci-dessous.
          </p>
        </div>
      </details>
      <PromptDepot />
      <ImportQuestions
        modules={await choixModules()}
        moduleInitial={p.module}
        analyser={actionAnalyserImport}
        confirmer={actionConfirmerImport}
      />
    </>
  );
}
