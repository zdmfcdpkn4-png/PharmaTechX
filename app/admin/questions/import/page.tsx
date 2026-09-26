import Link from "next/link";
import { ImportQuestions } from "@/components/ImportQuestions";
import { PromptDepot } from "@/components/PromptDepot";
import { PromptGeneration } from "@/components/PromptGeneration";
import { EXEMPLE_DEPOT } from "@/content/prompt-depot";
import { actionAnalyserImport, actionConfirmerImport } from "../actions";
import { choixModules, listeModulesPourPrompt } from "../commun";
import { lireNomsNiveaux } from "@/lib/niveaux-questions-db";
import { libellesDe } from "@/content/niveaux-questions";

export const dynamic = "force-dynamic";

export default async function Import({ searchParams }: { searchParams: Promise<{ module?: string }> }) {
  const p = await searchParams;
  const [modules, modulesPrompt, noms] = await Promise.all([choixModules(), listeModulesPourPrompt(), lireNomsNiveaux()]);
  return (
    <>
      <p className="fil">
        <Link href="/admin/questions">Banque de questions</Link> › Dépôt
      </p>
      <section className="panneau-titre">
        <h1>Déposer des questions</h1>
        <p>
          Collez un texte ou déposez un fichier (.txt, .md, .docx, .json). L&apos;analyse ne devine
          aucun verdict : ils viennent du corrigé écrit dans le texte. Le module et le format
          qu&apos;elle retient ou propose se vérifient dans l&apos;aperçu : chaque question y est
          montrée avant d&apos;être ajoutée, au statut « à vérifier ».
        </p>
      </section>
      <details className="bloc" style={{ marginBottom: "1rem" }}>
        <summary>Format attendu</summary>
        <div className="contenu-bloc">
          <pre className="exemple">{EXEMPLE_DEPOT}</pre>
          <p className="legende">
            Le mot-clé QCM ou QIM fixe le format ; sans lui, un intertitre « QCM » ou « QIM » seul
            sur sa ligne vaut pour les questions qui suivent ; sans intertitre, la consigne de
            l&apos;énoncé (« indiquez si … vraies ou fausses », « lesquelles… ? ») ; sinon, le format par
            défaut. Une ligne « Module : B1-05 » — code du critère, identifiant ou titre du module —
            vaut pour les questions qui suivent : un dépôt peut servir plusieurs modules. Un
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
      <PromptDepot modules={modulesPrompt} />
      <PromptGeneration />
      <ImportQuestions
        modules={modules}
        moduleInitial={p.module}
        analyser={actionAnalyserImport}
        confirmer={actionConfirmerImport}
        libellesNiveaux={libellesDe(noms)}
      />
    </>
  );
}
