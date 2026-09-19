"use client";

import { useState } from "react";
import { PROMPT_DEPOT } from "@/content/prompt-depot";

/**
 * Prompt de mise en forme, à copier dans l'assistant de son choix.
 *
 * Le dépôt n'appelle aucune IA : c'est le tuteur qui fait mettre en forme son
 * texte brut ailleurs, puis colle le résultat ici. Le prompt est affiché en
 * clair — il fait partie de ce qui est relu — et le bouton ne fait que le
 * copier. Si le navigateur refuse le presse-papiers, le texte reste
 * sélectionnable à la main.
 */
export function PromptDepot() {
  const [etat, setEtat] = useState<"prêt" | "copié" | "refusé">("prêt");

  const copier = async () => {
    try {
      await navigator.clipboard.writeText(PROMPT_DEPOT);
      setEtat("copié");
    } catch {
      setEtat("refusé");
    }
  };

  return (
    <details className="bloc" style={{ marginBottom: "1rem" }}>
      <summary>Faire mettre en forme un texte par une IA — copier le prompt</summary>
      <div className="contenu-bloc">
        <p>
          Pour un polycopié, un questionnaire papier ou des notes de formation, ce prompt fait
          mettre le texte au format attendu par un assistant. Il lui{" "}
          <strong>interdit d&apos;inventer</strong> un corrigé, une justification ou une source :
          ce que le texte source ne porte pas ne doit pas apparaître. Relisez la sortie avant de
          la coller — et de toute façon, chaque question déposée entre « à vérifier » et attend la
          validation d&apos;un autre code que le vôtre.
        </p>
        <div className="actions" style={{ marginTop: 0 }}>
          <button type="button" className="bouton bouton--compact" onClick={copier}>
            Copier le prompt
          </button>
          <span className="legende" role="status" aria-live="polite">
            {etat === "copié" && "Prompt copié."}
            {etat === "refusé" && "Le navigateur a refusé le presse-papiers : sélectionnez le texte ci-dessous."}
          </span>
        </div>
        <pre className="exemple">{PROMPT_DEPOT}</pre>
      </div>
    </details>
  );
}
