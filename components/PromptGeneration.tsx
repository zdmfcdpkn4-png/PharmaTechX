"use client";

import { useState } from "react";
import { promptGeneration, type TypeGeneration } from "@/content/prompt-depot";

/**
 * Prompt de génération de questions à partir d'un document — une variante
 * par type, puisque chaque répartition du modèle porte sur dix questions
 * d'un même type.
 *
 * Même règle que le prompt de mise en forme : le texte est affiché en clair,
 * le bouton ne fait que le copier, et le site n'appelle aucune IA. Ce qui
 * revient de l'assistant se colle dans le dépôt ci-dessous et entre au statut
 * « à vérifier » : un autre code que celui du déposant le valide.
 */
export function PromptGeneration() {
  const [type, setType] = useState<TypeGeneration>("QIM");
  const [etat, setEtat] = useState<"prêt" | "copié" | "refusé">("prêt");
  const texte = promptGeneration(type);

  const copier = async (t: TypeGeneration) => {
    setType(t);
    try {
      await navigator.clipboard.writeText(promptGeneration(t));
      setEtat("copié");
    } catch {
      setEtat("refusé");
    }
  };

  return (
    <details className="bloc" style={{ marginBottom: "1rem" }}>
      <summary>Générer 10 questions à partir d&apos;un document — copier le prompt</summary>
      <div className="contenu-bloc">
        <p>
          Joignez le document (procédure, chapitre des BPP…) à une conversation avec l&apos;assistant,
          collez ce prompt, puis collez la réponse dans le dépôt ci-dessous. Chaque proposition doit
          y être tranchée par un <strong>extrait du document recopié mot pour mot</strong> ; les
          extraits, les pièges et la difficulté sont versés dans la justification, affichée à
          l&apos;apprenant après la correction. Relisez chaque extrait contre le document : c&apos;est
          ce que vérifie le second code avant de valider.
        </p>
        <p className="legende">
          Une question peut s&apos;appuyer sur une figure ou une photographie du document : l&apos;assistant
          l&apos;annonce par « Image : figure-p12-1.png » ; déposez la capture de la figure sous ce nom,
          avec le texte. L&apos;assistant est un service extérieur : ne lui joignez aucun document ni
          aucune photo portant des données de patients ou une personne reconnaissable.
        </p>
        <div className="actions" style={{ marginTop: 0 }}>
          <button type="button" className="bouton bouton--compact" onClick={() => void copier("QIM")}>
            Copier le prompt QIM
          </button>
          <button type="button" className="bouton bouton--compact bouton--secondaire" onClick={() => void copier("QCM")}>
            Copier le prompt QCM
          </button>
          <span className="legende" role="status" aria-live="polite">
            {etat === "copié" && `Prompt ${type} copié.`}
            {etat === "refusé" && "Le navigateur a refusé le presse-papiers : sélectionnez le texte ci-dessous."}
          </span>
        </div>
        <pre className="exemple" aria-label={`Prompt de génération ${type}`}>{texte}</pre>
      </div>
    </details>
  );
}
