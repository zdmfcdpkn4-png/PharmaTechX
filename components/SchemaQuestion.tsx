"use client";

import { useMemo } from "react";
import { ordreLecture } from "@/content/schema";
import type { QuestionPublique } from "@/content/types";
import type { DetailLegende } from "@/app/api/evaluation/route";

/**
 * Schéma à compléter, côté apprenant — repris du Lecteur QIM · QCM.
 *
 * L'image porte des caches opaques à la place des mots d'origine et un
 * repère numéroté par légende ; sous l'image, un champ par numéro. En mode
 * « choisir », le champ est une liste des mots attendus, mélangés.
 *
 * Les repères sont en pourcentage de l'image : le rendu suit la largeur
 * disponible, tablette comprise. Les champs font 44 px au moins.
 */
export function SchemaQuestion({
  question,
  valeurs,
  onChange,
  verrouille = false,
  revelation,
}: {
  question: QuestionPublique;
  valeurs: Record<string, string>;
  onChange?: (legendeId: string, valeur: string) => void;
  verrouille?: boolean;
  /** Après correction : le détail par légende, dans l'ordre de lecture. */
  revelation?: DetailLegende[];
}) {
  const legendes = useMemo(() => question.legendes ?? [], [question.legendes]);
  const ordre = useMemo(() => ordreLecture(legendes), [legendes]);
  const image = question.image;

  if (!image) {
    return <p className="encart encart--attention">Image du schéma indisponible.</p>;
  }

  return (
    <figure className="schema">
      <div
        className={`schema-cadre${revelation ? " schema-cadre--revele" : ""}`}
        style={{ aspectRatio: `${image.largeur || 4} / ${image.hauteur || 3}` }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={image.url} alt={image.alt || "Schéma à compléter"} draggable={false} />
        {ordre.map((i, k) => {
          const l = legendes[i];
          const c = l.repere.cache;
          return (
            <span key={l.id}>
              {c && (
                <span
                  className="schema-cache"
                  aria-hidden="true"
                  style={{ left: `${c.x}%`, top: `${c.y}%`, width: `${c.w}%`, height: `${c.h}%` }}
                />
              )}
              <span
                className="schema-repere"
                style={{ left: `${l.repere.x}%`, top: `${l.repere.y}%` }}
                aria-hidden="true"
              >
                {k + 1}
              </span>
            </span>
          );
        })}
      </div>
      <figcaption className="legende">
        {question.modeReponse === "choisir"
          ? "Attribuez à chaque numéro la légende qui lui correspond."
          : "Écrivez la légende qui correspond à chaque numéro. Accents, majuscules et articles ne comptent pas."}
      </figcaption>

      {revelation ? (
        <ol className="schema-legendes schema-legendes--revele">
          {revelation.map((d) => (
            <li key={d.numero} className={`legende-${d.verdict}`}>
              <span className="num" aria-hidden="true">{d.numero}</span>
              <span>
                <strong>{d.attendu}</strong>
                {d.verdict === "juste" ? " — juste" : d.verdict === "fausse" ? ` — vous avez écrit « ${d.reponse} »` : " — sans réponse"}
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <ol className="schema-legendes">
          {ordre.map((i, k) => {
            const l = legendes[i];
            const id = `${question.id}-${l.id}`;
            return (
              <li key={l.id}>
                <label htmlFor={id}>
                  <span className="num" aria-hidden="true">{k + 1}</span>
                  <span className="visually-hidden">Légende {k + 1}</span>
                </label>
                {question.modeReponse === "choisir" ? (
                  <select
                    id={id}
                    value={valeurs[l.id] ?? ""}
                    disabled={verrouille}
                    onChange={(e) => onChange?.(l.id, e.target.value)}
                  >
                    <option value="">— choisir —</option>
                    {(question.etiquettes ?? []).map((e) => (
                      <option key={e} value={e}>{e}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    id={id}
                    type="text"
                    autoComplete="off"
                    spellCheck={false}
                    // Tablette et téléphone : ni correction ni majuscule automatiques,
                    // qui réécriraient une abréviation (« TCP ») à l'insu de l'apprenant.
                    autoCorrect="off"
                    autoCapitalize="none"
                    enterKeyHint="next"
                    value={valeurs[l.id] ?? ""}
                    disabled={verrouille}
                    onChange={(e) => onChange?.(l.id, e.target.value)}
                  />
                )}
              </li>
            );
          })}
        </ol>
      )}
    </figure>
  );
}
