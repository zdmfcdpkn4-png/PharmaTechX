import { ImportQuestions } from "@/components/ImportQuestions";
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
          <pre className="exemple">{`QCM 1. Énoncé de la question (plusieurs réponses)
A. Première proposition (V)
B. Deuxième proposition (F)
C. Troisième proposition (V)
D. Quatrième proposition (F)
Réponses : A C
Justification : texte affiché après correction.
Source : ANSM — Bonnes pratiques de préparation 2023 — 21/07/2023 — https://ansm.sante.fr/…
Éliminatoire : oui

QIM 2. Concernant …, indiquer la ou les propositions exactes.
A. … (V)
B. … (F)
C. … (V)
D. … (F)
E. … (V)

SCHÉMA 1. Légendez les éléments repérés sur cette coupe d'isolateur.
Image : isolateur-coupe.png
1. sas de transfert (32, 24, 14, 5)
2. filtre HEPA | filtre terminal (58, 19)
Justification : …`}</pre>
          <p className="legende">
            Le mot-clé QCM ou QIM fixe le format ; sans lui, le format par défaut s&apos;applique. Un
            corrigé se lit dans « (V) / (F) » en fin de proposition ou dans « Réponses : A C ».
            Pour un schéma, les quatre nombres sont le rectangle du mot d&apos;origine (x, y,
            largeur, hauteur en % de l&apos;image) ; deux nombres posent un repère sans cache. Un
            JSON exporté de ce site ou une banque au schéma 3.0 du Lecteur QIM · QCM sont aussi lus.
          </p>
        </div>
      </details>
      <ImportQuestions
        modules={choixModules()}
        moduleInitial={p.module}
        analyser={actionAnalyserImport}
        confirmer={actionConfirmerImport}
      />
    </>
  );
}
