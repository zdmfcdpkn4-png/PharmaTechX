"use client";

import { useState } from "react";

/**
 * Bouton « Copier la mention » — la cellule à coller dans la colonne
 * « Outils / Preuve de compétence » de la fiche d'habilitation.
 *
 * Décision du 22/09/2026 (question 48, choix b). Le texte est affiché en
 * clair à côté du bouton : c'est ce qui partira dans un document qualité, il
 * n'y a aucune raison de le cacher, et si le navigateur refuse le
 * presse-papiers il reste sélectionnable à la main.
 */
export function CopierMention({
  texte,
  compact = false,
}: {
  texte: string;
  compact?: boolean;
}) {
  const [etat, setEtat] = useState<"prêt" | "copié" | "refusé">("prêt");

  const copier = async () => {
    try {
      await navigator.clipboard.writeText(texte);
      setEtat("copié");
    } catch {
      setEtat("refusé");
    }
  };

  return (
    <span className="mention-preuve">
      <button
        type="button"
        className="bouton bouton--discret bouton--compact"
        onClick={copier}
        title={texte}
      >
        Copier la mention
      </button>
      <span className="legende" role="status" aria-live="polite">
        {etat === "copié" && "Mention copiée."}
        {etat === "refusé" && "Presse-papiers refusé : sélectionnez le texte."}
      </span>
      {!compact && <code className="mention-texte">{texte}</code>}
    </span>
  );
}
