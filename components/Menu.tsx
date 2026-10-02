"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";

/**
 * État du déclencheur de l'accès rapide (paquet A, 21/09/2026).
 *
 * Avant ce paquet, le hamburger ouvrait le volet de navigation en tiroir sous
 * 62 rem et disparaissait au-dessus. Il ouvre désormais **une seule surface**,
 * l'accès rapide (`components/AccesRapide.tsx`), à toutes les tailles : un
 * tiroir à gauche, posé sur le volet au-dessus de 62 rem (question 61,
 * choix a). Le volet, lui, redevient ce
 * qu'il n'aurait jamais dû cesser d'être — une barre latérale permanente,
 * présente au-dessus de 62 rem et rien d'autre.
 *
 * Le déclencheur garde sa référence ici : à la fermeture, le focus lui revient
 * (WCAG 2.4.3), sans quoi la tabulation repart du haut du document. Ouvert
 * depuis la barre de recherche de l'en-tête (question 93, choix b), c'est à
 * elle qu'il revient.
 */
export interface DemandeOuverture {
  /** Ce qui est déjà tapé : le panneau s'ouvre filtré. */
  filtre?: string;
  /** Viser le champ de recherche, même sur écran tactile : on est venu chercher. */
  recherche?: boolean;
  /** Où rendre le focus à la fermeture ; à défaut, le hamburger. */
  depuis?: HTMLElement | null;
}

export interface EtatMenu {
  ouvert: boolean;
  ouvrir: (demande?: DemandeOuverture) => void;
  basculer: () => void;
  fermer: () => void;
  declencheur: React.RefObject<HTMLButtonElement | null>;
  /** La dernière demande d'ouverture, que le panneau lit en s'ouvrant. */
  demande: React.RefObject<DemandeOuverture>;
}

export const ContexteMenu = createContext<EtatMenu | null>(null);

export function MenuProvider({ children }: { children: React.ReactNode }) {
  const [ouvert, setOuvert] = useState(false);
  const declencheur = useRef<HTMLButtonElement | null>(null);
  const demande = useRef<DemandeOuverture>({});

  // L'élément qui a ouvert le panneau, s'il est encore affiché ; sinon le hamburger.
  const rendreFocus = useCallback(() => {
    const depuis = demande.current.depuis;
    const cible = depuis && depuis.isConnected && depuis.getClientRects().length > 0 ? depuis : declencheur.current;
    cible?.focus({ preventScroll: true });
  }, []);
  const fermer = useCallback(() => {
    setOuvert((v) => {
      if (v) rendreFocus();
      return false;
    });
  }, [rendreFocus]);
  const ouvrir = useCallback((d: DemandeOuverture = {}) => {
    demande.current = d;
    setOuvert(true);
  }, []);
  const basculer = useCallback(() => {
    setOuvert((v) => {
      if (v) rendreFocus();
      else demande.current = {};
      return !v;
    });
  }, [rendreFocus]);

  return (
    <ContexteMenu.Provider value={{ ouvert, ouvrir, basculer, fermer, declencheur, demande }}>
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
      {/* Sur téléphone, le libellé quitte l'écran mais reste le nom du bouton. */}
      <span className="bouton-menu-libelle">Menu</span>
      {pastille ? <span className="bouton-menu-pastille" aria-hidden="true" /> : null}
      {pastille ? <span className="lecture-seule"> — des éléments attendent</span> : null}
    </button>
  );
}

/**
 * Barre de recherche de l'en-tête (02/10/2026, question 93, choix b) : la
 * recherche de l'accès rapide, mise en vue. Un bouton qui en a l'allure, et
 * non un second champ : le panneau, boîte de dialogue modale, prend le focus,
 * et un champ hors de lui laisserait le curseur dehors. Un clic l'ouvre,
 * curseur dans sa recherche ; une lettre tapée sur la barre l'ouvre déjà
 * filtré — l'écouteur unique du panneau s'en charge (`AccesRapide.tsx`). La
 * feuille de style lui donne la forme que permet la place laissée par
 * l'en-tête : un champ, une loupe, ou rien.
 */
export function BarreRecherche() {
  const menu = useContext(ContexteMenu);
  if (!menu) return null;
  return (
    <div className="recherche-entete">
      <button
        type="button"
        className="recherche-entete-bouton"
        aria-label="Rechercher un écran"
        aria-haspopup="dialog"
        aria-controls="acces-rapide"
        aria-expanded={menu.ouvert}
        onClick={(e) => menu.ouvrir({ recherche: true, depuis: e.currentTarget })}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <span className="recherche-entete-texte" aria-hidden="true">
          Rechercher un écran…
        </span>
      </button>
    </div>
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
