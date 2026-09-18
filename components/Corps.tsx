import React from "react";

/**
 * Rendu du corps des modules.
 *
 * Markdown volontairement restreint — paragraphes, listes à puces, listes
 * numérotées, **gras**, *italique* — pour que le contenu reste rédigeable par
 * un pharmacien sans connaissance du HTML et sans introduire d'injection.
 * Aucun HTML brut n'est interprété.
 */

function enrichir(texte: string, cle: string): React.ReactNode[] {
  const morceaux: React.ReactNode[] = [];
  const motif = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let dernier = 0;
  let m: RegExpExecArray | null;
  let i = 0;

  while ((m = motif.exec(texte)) !== null) {
    if (m.index > dernier) morceaux.push(texte.slice(dernier, m.index));
    const jeton = m[0];
    const k = `${cle}-${i++}`;
    if (jeton.startsWith("**")) {
      morceaux.push(<strong key={k}>{jeton.slice(2, -2)}</strong>);
    } else if (jeton.startsWith("`")) {
      const contenu = jeton.slice(1, -1);
      morceaux.push(
        contenu === "[à préciser]" ? (
          <code key={k} className="a-preciser">
            {contenu}
          </code>
        ) : (
          <code key={k}>{contenu}</code>
        ),
      );
    } else {
      morceaux.push(<em key={k}>{jeton.slice(1, -1)}</em>);
    }
    dernier = m.index + jeton.length;
  }
  if (dernier < texte.length) morceaux.push(texte.slice(dernier));

  // Le marqueur [à préciser] est mis en évidence même hors balise code.
  return morceaux.flatMap((n, idx) => {
    if (typeof n !== "string") return [n];
    const parts = n.split("[à préciser]");
    if (parts.length === 1) return [n];
    const out: React.ReactNode[] = [];
    parts.forEach((p, j) => {
      if (p) out.push(p);
      if (j < parts.length - 1) {
        out.push(
          <code key={`${cle}-ap-${idx}-${j}`} className="a-preciser">
            [à préciser]
          </code>,
        );
      }
    });
    return out;
  });
}

export function Corps({ texte }: { texte: string }) {
  const blocs = texte.split(/\n{2,}/);

  return (
    <>
      {blocs.map((bloc, i) => {
        const lignes = bloc.split("\n");

        if (lignes.every((l) => /^\s*-\s+/.test(l))) {
          return (
            <ul key={i}>
              {lignes.map((l, j) => (
                <li key={j}>{enrichir(l.replace(/^\s*-\s+/, ""), `${i}-${j}`)}</li>
              ))}
            </ul>
          );
        }

        if (lignes.every((l) => /^\s*\d+\.\s+/.test(l))) {
          return (
            <ol key={i}>
              {lignes.map((l, j) => (
                <li key={j}>
                  {enrichir(l.replace(/^\s*\d+\.\s+/, ""), `${i}-${j}`)}
                </li>
              ))}
            </ol>
          );
        }

        return <p key={i}>{enrichir(bloc, `${i}`)}</p>;
      })}
    </>
  );
}
