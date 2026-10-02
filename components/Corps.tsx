import React from "react";
import { MARQUEUR_TEXTE } from "@/content/complements";
import { ACompleter } from "./ACompleter";

/**
 * Rendu du corps des modules.
 *
 * Markdown volontairement restreint — paragraphes, listes à puces, listes
 * numérotées, **gras**, *italique*, et un paragraphe commençant par « > »
 * pour un point clé (filet rose à gauche, amorce en gras) — pour que le
 * contenu reste rédigeable par un pharmacien sans connaissance du HTML et
 * sans introduire d'injection. Aucun HTML brut n'est interprété.
 */

/** Rend le marqueur suivant du texte : sa donnée renseignée, ou son encadré. */
type Marque = (cle: string) => React.ReactNode;

function enrichir(texte: string, cle: string, marque: Marque): React.ReactNode[] {
  const morceaux: React.ReactNode[] = [];
  const motif = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let dernier = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  // Le marqueur [à préciser] est mis en évidence partout, même hors balise code, et toujours dans
  // l'ordre de lecture : c'est cet ordre qui donne sa clé à chaque donnée locale (02/10/2026).
  const marques = (t: string): React.ReactNode[] =>
    t.split(MARQUEUR_TEXTE).flatMap((p, j, tous) => [
      ...(p ? [p] : []),
      ...(j < tous.length - 1 ? [marque(`${cle}-ap-${i++}`)] : []),
    ]);

  while ((m = motif.exec(texte)) !== null) {
    if (m.index > dernier) morceaux.push(...marques(texte.slice(dernier, m.index)));
    const jeton = m[0];
    const k = `${cle}-${i++}`;
    if (jeton.startsWith("**")) {
      morceaux.push(<strong key={k}>{marques(jeton.slice(2, -2))}</strong>);
    } else if (jeton.startsWith("`")) {
      const contenu = jeton.slice(1, -1);
      morceaux.push(contenu === MARQUEUR_TEXTE ? marque(k) : <code key={k}>{marques(contenu)}</code>);
    } else {
      morceaux.push(<em key={k}>{marques(jeton.slice(1, -1))}</em>);
    }
    dernier = m.index + jeton.length;
  }
  if (dernier < texte.length) morceaux.push(...marques(texte.slice(dernier)));
  return morceaux;
}

/** Une donnée locale du texte : sa clé (Réglages › À compléter) et sa valeur, si elle est renseignée. */
export interface MarqueurTexte {
  cle: string;
  valeur: string | null;
}

/**
 * `marqueurs` : les données locales de ce texte, dans l'ordre de lecture ; une
 * valeur renseignée remplace son encadré, et l'encadré d'une donnée manquante
 * mène l'administration (`admin`) à son champ. Sans eux, l'encadré seul.
 */
export function Corps({ texte, marqueurs, admin }: { texte: string; marqueurs?: MarqueurTexte[]; admin?: boolean }) {
  const blocs = texte.split(/\n{2,}/);
  let rang = 0;
  const marque: Marque = (k) => {
    const d = marqueurs?.[rang++];
    if (d?.valeur) return <React.Fragment key={k}>{d.valeur}</React.Fragment>;
    if (d) return <ACompleter key={k} cle={d.cle} admin={admin} texte={MARQUEUR_TEXTE} />;
    return (
      <code key={k} className="a-preciser">
        {MARQUEUR_TEXTE}
      </code>
    );
  };

  return (
    <>
      {blocs.map((bloc, i) => {
        const lignes = bloc.split("\n");

        if (lignes.every((l) => /^\s*-\s+/.test(l))) {
          return (
            <ul key={i}>
              {lignes.map((l, j) => (
                <li key={j}>{enrichir(l.replace(/^\s*-\s+/, ""), `${i}-${j}`, marque)}</li>
              ))}
            </ul>
          );
        }

        if (lignes.every((l) => /^\s*\d+\.\s+/.test(l))) {
          return (
            <ol key={i}>
              {lignes.map((l, j) => (
                <li key={j}>
                  {enrichir(l.replace(/^\s*\d+\.\s+/, ""), `${i}-${j}`, marque)}
                </li>
              ))}
            </ol>
          );
        }

        if (lignes.every((l) => /^\s*>\s?/.test(l))) {
          return (
            <p key={i} className="point-cle">
              {enrichir(lignes.map((l) => l.replace(/^\s*>\s?/, "")).join(" "), `${i}`, marque)}
            </p>
          );
        }

        return <p key={i}>{enrichir(bloc, `${i}`, marque)}</p>;
      })}
    </>
  );
}
