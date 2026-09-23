"use client";

import { useEffect, useRef } from "react";

/**
 * Coque d'interface : jauge de lecture, en-tête dynamique, retour en haut.
 *
 * Comportements repris de la passation de design :
 *  - un seul écouteur `scroll` en { passive, capture }, tout le travail dans un
 *    requestAnimationFrame avec garde anti-rafale ;
 *  - l'en-tête se masque au défilement descendant (+6 px) et réapparaît au
 *    montant (−6 px), jamais masqué dans les `hauteur + 8 px` premiers pixels ;
 *  - un ResizeObserver écrit la hauteur réelle de l'en-tête dans la cale et
 *    dans `--decalage` — l'en-tête passe sur deux lignes sous 1000 px, une
 *    valeur en dur masquerait le haut de page ;
 *  - `prefers-reduced-motion` neutralise le défilement animé.
 *
 * `annonce` : bande pleine largeur au-dessus de la ligne d'en-tête (bandeau du
 * mode test). Dans l'en-tête, elle est comptée dans la cale et suit son
 * masquage.
 */
export function Chrome({ children, annonce }: { children: React.ReactNode; annonce?: React.ReactNode }) {
  const jauge = useRef<HTMLDivElement>(null);
  const entete = useRef<HTMLElement>(null);
  const cale = useRef<HTMLDivElement>(null);
  const retour = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const el = entete.current;
    if (!el) return;

    let dernier = window.scrollY;
    let enCours = false;

    const mesurer = () => {
      const h = el.offsetHeight;
      if (cale.current) cale.current.style.height = `${h + 4}px`;
      document.documentElement.style.setProperty("--decalage", `${h + 20}px`);
    };

    const observer = new ResizeObserver(mesurer);
    observer.observe(el);
    mesurer();

    const traiter = () => {
      enCours = false;
      const y = window.scrollY;
      const h = el.offsetHeight;

      // Jauge de lecture
      const course = document.documentElement.scrollHeight - window.innerHeight;
      const pct = course > 0 ? Math.min(100, Math.max(0, (y / course) * 100)) : 0;
      if (jauge.current) {
        jauge.current.style.width = `${pct}%`;
        jauge.current.parentElement?.setAttribute(
          "aria-valuenow",
          String(Math.round(pct)),
        );
      }

      // En-tête : masqué en descente, rétabli en montée
      const delta = y - dernier;
      el.classList.toggle("entete--decollee", y > 4);
      if (y <= h + 8) {
        el.classList.remove("entete--masque");
      } else if (delta > 6) {
        el.classList.add("entete--masque");
      } else if (delta < -6) {
        el.classList.remove("entete--masque");
      }
      if (Math.abs(delta) > 2) dernier = y;

      // Retour en haut au-delà de 1,8 hauteur d'écran
      retour.current?.classList.toggle(
        "retour-haut--visible",
        y > window.innerHeight * 1.8,
      );
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
      observer.disconnect();
    };
  }, []);

  const remonter = () => {
    const doux = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: doux ? "smooth" : "auto" });
    entete.current?.focus({ preventScroll: true });
  };

  return (
    <>
      <div
        className="progression-lecture"
        role="progressbar"
        aria-label="Progression de la lecture"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={0}
      >
        <span ref={jauge} />
      </div>

      <a className="lien-evitement" href="#contenu">
        Aller au contenu
      </a>

      <header className="entete" ref={entete} tabIndex={-1}>
        {annonce}
        <div className="entete-interne">{children}</div>
      </header>
      <div className="cale-entete" ref={cale} aria-hidden="true" />

      <button
        type="button"
        className="retour-haut"
        ref={retour}
        onClick={remonter}
        aria-label="Revenir en haut de la page"
      >
        ↑
      </button>
    </>
  );
}
