"use client";

import type { QuestionPublique } from "@/content/types";

/**
 * Séquence à ordonner : chaque étape reçoit son rang dans un menu déroulant.
 *
 * Pas de glisser-déposer : l'usage se fait sur tablette, gants aux mains, et
 * un menu natif s'ouvre en plein écran sur iPad et sur téléphone — c'est le
 * même choix que pour les légendes d'un schéma en mode « attribuer ». Un rang
 * déjà pris est retiré à l'étape qui le portait (le parent s'en charge) : la
 * réponse reste toujours lisible, sans deux étapes au même rang.
 */
export function OrdreQuestion({
  question,
  valeurs,
  onChange,
  verrouille = false,
}: {
  question: QuestionPublique;
  /** Rang donné à chaque étape, par identifiant d'option. */
  valeurs: Record<string, number>;
  onChange?: (optionId: string, rang: number) => void;
  verrouille?: boolean;
}) {
  const rangs = Array.from({ length: question.options.length }, (_, i) => i + 1);
  return (
    <ul className="sequence">
      {question.options.map((o) => (
        <li key={o.id} className="etape-sequence">
          <label className="champ champ--rang">
            <span className="visually-hidden">Rang de l&apos;étape « {o.texte} »</span>
            <select
              value={valeurs[o.id] ?? ""}
              disabled={verrouille}
              onChange={(e) => onChange?.(o.id, Number(e.target.value))}
            >
              <option value="">—</option>
              {rangs.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
          <span className="libelle">{o.texte}</span>
        </li>
      ))}
    </ul>
  );
}
