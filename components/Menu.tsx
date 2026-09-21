"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";

/**
 * État du déclencheur de l'accès rapide (paquet A, 21/09/2026).
 *
 * Avant ce paquet, le hamburger ouvrait le volet de navigation en tiroir sous
 * 62 rem et disparaissait au-dessus. Il ouvre désormais **une seule surface**,
 * l'accès rapide (`components/AccesRapide.tsx`), à toutes les tailles : tiroir
 * à gauche sous 62 rem, panneau centré au-dessus. Le volet, lui, redevient ce
 * qu'il n'aurait jamais dû cesser d'être — une barre latérale permanente,
 * présente au-dessus de 62 rem et rien d'autre.
 *
 * Le déclencheur garde sa référence ici : à la fermeture, le focus lui revient
 * (WCAG 2.4.3), sans quoi la tabulation repart du haut du document.
 */
export interface EtatMenu {
  ouvert: boolean;
  ouvrir: () => void;
  basculer: () => void;
  fermer: () => void;
  declencheur: React.RefObject<HTMLButtonElement | null>;
}

export const ContexteMenu = createContext<EtatMenu | null>(null);

export function MenuProvider({ children }: { children: React.ReactNode }) {
  const [ouvert, setOuvert] = useState(false);
  const declencheur = useRef<HTMLButtonElement | null>(null);

  const fermer = useCallback(() => {
    setOuvert((v) => {
      if (v) declencheur.current?.focus({ preventScroll: true });
      return false;
    });
  }, []);
  const ouvrir = useCallback(() => setOuvert(true), []);
  const basculer = useCallback(() => {
    setOuvert((v) => {
      if (v) declencheur.current?.focus({ preventScroll: true });
      return !v;
    });
  }, []);

  return (
    <ContexteMenu.Provider value={{ ouvert, ouvrir, basculer, fermer, declencheur }}>
      {children}
    </ContexteMenu.Provider>
  );
}

/**
 * Déclencheur, dans l'en-tête. Une **pastille, pas un nombre** : un nombre
 * oblige à le lire et à le comparer à chaque passage, la pastille dit la seule
 * chose utile de l'extérieur — il y a quelque chose. Aucune pastille pour un
 * profil de poste, qui n'a pas de file d'attente.
 */
export function BoutonMenu({ pastille = false }: { pastille?: boolean }) {
  const menu = useContext(ContexteMenu);
  if (!menu) return null;
  return (
    <button
      ref={menu.declencheur}
      type="button"
      className="bouton-menu"
      aria-expanded={menu.ouvert}
      aria-haspopup="dialog"
      aria-controls="acces-rapide"
      onClick={menu.basculer}
    >
      <span className="barres" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
      Menu
      {pastille ? <span className="bouton-menu-pastille" aria-hidden="true" /> : null}
      {pastille ? <span className="lecture-seule"> — des éléments attendent</span> : null}
    </button>
  );
}

/** Le volet permanent. Masqué sous 62 rem, où l'accès rapide le porte. */
export function VoletMenu({ children }: { children: React.ReactNode }) {
  return (
    <nav id="volet-principal" className="rail" aria-label="Navigation principale">
      {children}
    </nav>
  );
}
