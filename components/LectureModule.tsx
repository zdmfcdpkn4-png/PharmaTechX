"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Lecture longue d'un module — écran 2 de la passation de design.
 *
 * - sommaire collant, section courante marquée (`aria-current`) : dernière
 *   section dont le haut est passé sous l'en-tête + 40 px, calculée dans le
 *   même `requestAnimationFrame` que la jauge (un seul écouteur, garde
 *   anti-rafale) ;
 * - reprise de lecture : la section courante est écrite dans `localStorage`
 *   (`fp-lecture-<module>`), avec un debounce de 600 ms, dans un try/catch.
 *   C'est la seule donnée persistée par l'application ; elle est locale au
 *   poste, non nominative, et s'efface depuis le sommaire.
 */
export interface EntreeSommaire {
  id: string;
  titre: string;
}

interface Repere {
  id: string;
  titre: string;
  num: number;
}

export function LectureModule({
  moduleId,
  sommaire,
  children,
}: {
  moduleId: string;
  sommaire: EntreeSommaire[];
  children: React.ReactNode;
}) {
  const cle = `fp-lecture-${moduleId}`;
  const [courante, setCourante] = useState<string | null>(null);
  const [repere, setRepere] = useState<Repere | null>(null);
  const minuteur = useRef<number | null>(null);

  useEffect(() => {
    try {
      const brut = localStorage.getItem(cle);
      if (brut) setRepere(JSON.parse(brut) as Repere);
    } catch {
      // stockage indisponible : la lecture fonctionne sans repère
    }
  }, [cle]);

  useEffect(() => {
    let enCours = false;
    const traiter = () => {
      enCours = false;
      const decalage =
        parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--decalage")) || 124;
      let id: string | null = null;
      for (const s of sommaire) {
        const el = document.getElementById(s.id);
        if (!el) continue;
        if (el.getBoundingClientRect().top <= decalage + 40) id = s.id;
      }
      setCourante((prec) => (prec === id ? prec : id));
    };
    const onScroll = () => {
      if (enCours) return;
      enCours = true;
      requestAnimationFrame(traiter);
    };
    window.addEventListener("scroll", onScroll, { passive: true, capture: true });
    window.addEventListener("resize", onScroll, { passive: true });
    traiter();
    return () => {
      window.removeEventListener("scroll", onScroll, { capture: true });
      window.removeEventListener("resize", onScroll);
    };
  }, [sommaire]);

  useEffect(() => {
    if (!courante) return;
    if (minuteur.current) window.clearTimeout(minuteur.current);
    minuteur.current = window.setTimeout(() => {
      const num = sommaire.findIndex((s) => s.id === courante) + 1;
      const titre = sommaire[num - 1]?.titre ?? "";
      const r: Repere = { id: courante, titre, num };
      try {
        localStorage.setItem(cle, JSON.stringify(r));
      } catch {
        // stockage refusé : rien à faire
      }
      setRepere(r);
    }, 600);
    return () => {
      if (minuteur.current) window.clearTimeout(minuteur.current);
    };
  }, [courante, cle, sommaire]);

  const reprendre = useCallback(() => {
    if (!repere) return;
    const el = document.getElementById(repere.id);
    if (!el) return;
    const doux = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: doux ? "smooth" : "auto", block: "start" });
    (el.querySelector("h2") as HTMLElement | null)?.focus?.();
  }, [repere]);

  const oublier = useCallback(() => {
    try {
      localStorage.removeItem(cle);
    } catch {
      // rien
    }
    setRepere(null);
  }, [cle]);

  const numCourant = sommaire.findIndex((s) => s.id === courante) + 1;
  const repriseUtile = repere && repere.num > 1 && repere.id !== courante;

  return (
    <div className="module">
      <nav className="sommaire" aria-label="Sommaire du module">
        <span className="sommaire-titre">Sommaire</span>
        {repriseUtile && (
          <button type="button" className="bouton bouton--reprise" onClick={reprendre}>
            Reprendre : {repere!.titre}
          </button>
        )}
        <ol>
          {sommaire.map((s, i) => (
            <li key={s.id}>
              <a href={`#${s.id}`} aria-current={courante === s.id ? "true" : undefined}>
                <span className="num">{i + 1}</span>
                <span>{s.titre}</span>
              </a>
            </li>
          ))}
        </ol>
        <div className="sommaire-pied">
          <span className="legende">
            Votre lecture est repérée localement sur ce poste, pour reprendre après une interruption.
            {numCourant > 0 ? ` Section ${numCourant} sur ${sommaire.length}.` : ""}
          </span>
          {repere && (
            <button type="button" className="bouton bouton--compact bouton--discret" onClick={oublier}>
              Oublier ce repère
            </button>
          )}
        </div>
      </nav>
      <div>{children}</div>
    </div>
  );
}
