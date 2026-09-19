"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

/**
 * Volet de navigation : permanent à partir de 62 rem, tiroir en deçà.
 *
 * Question 37 (choix c) : la navigation quitte l'en-tête, où elle occupait
 * deux lignes sous 1000 px, pour un volet unique — barre latérale sur poste,
 * tiroir ouvert par le bouton « Menu » sur tablette et téléphone. Le volet
 * porte les sections de l'accueil, les repères et, pour un profil de tutorat
 * ou d'administration, les écrans d'administration.
 *
 * Fermé, le volet est en `visibility: hidden` (feuille de style) : ses liens
 * sortent de l'ordre de tabulation et ne sont pas annoncés. Il se ferme à la
 * touche d'échappement, au clic sur le voile, au suivi d'un lien, et dès que
 * l'écran repasse au-dessus du seuil où il est permanent.
 */
interface EtatMenu {
  ouvert: boolean;
  basculer: () => void;
  fermer: () => void;
}

const ContexteMenu = createContext<EtatMenu | null>(null);

export function MenuProvider({ children }: { children: React.ReactNode }) {
  const [ouvert, setOuvert] = useState(false);
  const fermer = useCallback(() => setOuvert(false), []);
  const basculer = useCallback(() => setOuvert((v) => !v), []);

  useEffect(() => {
    if (!ouvert) return;
    const auClavier = (e: KeyboardEvent) => {
      if (e.key === "Escape") fermer();
    };
    const seuil = window.matchMedia("(min-width: 62rem)");
    const auSeuil = () => {
      if (seuil.matches) fermer();
    };
    document.addEventListener("keydown", auClavier);
    seuil.addEventListener("change", auSeuil);
    document.body.classList.add("menu-ouvert");
    return () => {
      document.removeEventListener("keydown", auClavier);
      seuil.removeEventListener("change", auSeuil);
      document.body.classList.remove("menu-ouvert");
    };
  }, [ouvert, fermer]);

  return (
    <ContexteMenu.Provider value={{ ouvert, basculer, fermer }}>{children}</ContexteMenu.Provider>
  );
}

/** Bouton d'ouverture, dans l'en-tête ; masqué là où le volet est permanent. */
export function BoutonMenu() {
  const menu = useContext(ContexteMenu);
  if (!menu) return null;
  return (
    <button
      type="button"
      className="bouton-menu"
      aria-expanded={menu.ouvert}
      aria-controls="volet-principal"
      onClick={menu.basculer}
    >
      <span className="barres" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
      Menu
    </button>
  );
}

/** Le volet lui-même, et le voile qui le referme au clic. */
export function VoletMenu({ children }: { children: React.ReactNode }) {
  const menu = useContext(ContexteMenu);
  const ouvert = menu?.ouvert ?? false;
  return (
    <>
      <div
        className={`voile${ouvert ? " voile--visible" : ""}`}
        onClick={menu?.fermer}
        aria-hidden="true"
      />
      <nav
        id="volet-principal"
        className={`rail${ouvert ? " rail--ouvert" : ""}`}
        aria-label="Navigation principale"
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("a")) menu?.fermer();
        }}
      >
        {children}
      </nav>
    </>
  );
}
