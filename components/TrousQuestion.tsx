"use client";

import { morceauxDuTexte, type QuestionPublique } from "@/content/types";

/**
 * Texte à trous : chaque trou est un menu déroulant de vignettes.
 *
 * L'énoncé porte les marques `{1}`, `{2}`… ; la liste des vignettes est
 * commune à tous les trous et mélangée par le serveur (les attendues y sont
 * mêlées aux leurres). Une même vignette peut donc être proposée deux fois :
 * c'est voulu, la correction compare le mot, pas l'étiquette.
 */
export function TrousQuestion({
  question,
  valeurs,
  onChange,
  verrouille = false,
}: {
  question: QuestionPublique;
  /** Vignette choisie par trou, la clé étant le numéro du trou. */
  valeurs: Record<string, string>;
  onChange?: (trou: string, optionId: string) => void;
  verrouille?: boolean;
}) {
  const morceaux = morceauxDuTexte(question.enonce);
  return (
    <p className="texte-a-trous">
      {morceaux.map((m, i) =>
        "texte" in m ? (
          <span key={i}>{m.texte}</span>
        ) : (
          <label key={i} className="trou">
            <span className="visually-hidden">Trou {m.trou}</span>
            <select
              value={valeurs[String(m.trou)] ?? ""}
              disabled={verrouille}
              onChange={(e) => onChange?.(String(m.trou), e.target.value)}
            >
              <option value="">— {m.trou} —</option>
              {question.options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.texte}
                </option>
              ))}
            </select>
          </label>
        ),
      )}
    </p>
  );
}
