import type { ReactNode } from "react";

/**
 * Pictogrammes des têtes de menu (question 77, choix a, 25/09/2026) : un par
 * thème, le même dans le tiroir « Aller à » et dans le volet de poste.
 *
 * Dessinés sur la grille de 24 des pictogrammes du site (`components/Badge.tsx`),
 * d'un trait plus appuyé (2 au lieu de 1,5) : ils se lisent entre 13 et 16 px.
 * Monochromes, à la couleur de l'intitulé. Hors de la banque des badges, pour
 * qu'aucun ne s'offre comme badge de module. Toujours décoratifs : l'intitulé
 * dit le thème, le lecteur d'écran n'entend rien de plus.
 *
 * Remplacer un pictogramme : changer son tracé ici, rien d'autre.
 */

export type ThemeMenu =
  | "formation"
  | "reperes"
  | "administration"
  | "rgpd"
  | "suivi"
  | "questions"
  | "modules"
  | "squelette"
  | "reglages";

const TRACES: Record<ThemeMenu, ReactNode> = {
  // Toque de diplômé : se former.
  formation: (
    <>
      <path d="M2.5 9.5L12 5l9.5 4.5L12 14z" />
      <path d="M6.5 11.7V16c0 1.6 2.5 3 5.5 3s5.5-1.4 5.5-3v-4.3" />
      <path d="M21.5 9.5V15" />
    </>
  ),
  // Boussole : se repérer dans le dispositif.
  reperes: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M15.5 8.5l-2 5-5 2 2-5z" />
    </>
  ),
  // Écusson (question 76) : ne reste que sur le groupe « Administration » du
  // volet de poste, seul endroit où ce groupe porte un intitulé.
  administration: (
    <>
      <path d="M12 3l7 3v5c0 4.6-3 8.3-7 10-4-1.7-7-5.4-7-10V6l7-3z" />
      <path d="M9 12l2 2 4-4" />
    </>
  ),
  // Cadenas : vos données et vos droits.
  rgpd: (
    <>
      <rect x="5" y="10.5" width="14" height="10" rx="2" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
    </>
  ),
  // Courbe : suivre les résultats.
  suivi: (
    <>
      <path d="M4 4v16h16" />
      <path d="M8 15l3.5-4 3 2.5L19 8" />
    </>
  ),
  // Bulle et point d'interrogation : la banque de questions.
  questions: (
    <>
      <path d="M5 4h14a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-8l-5 4v-4H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" />
      <path d="M10 8.5a2 2 0 1 1 2.8 1.8c-.5.3-.8.7-.8 1.2" />
      <path d="M12 13.5h.01" />
    </>
  ),
  // Couches : les modules, empilés en programme.
  modules: (
    <>
      <path d="M12 3l9 4.5-9 4.5-9-4.5z" />
      <path d="M3 12l9 4.5 9-4.5" />
      <path d="M3 16.5L12 21l9-4.5" />
    </>
  ),
  // Arborescence : le squelette de la formation — filières, niveaux, blocs (question 81).
  squelette: (
    <>
      <rect x="9" y="3" width="6" height="5" rx="1" />
      <rect x="3" y="16" width="6" height="5" rx="1" />
      <rect x="15" y="16" width="6" height="5" rx="1" />
      <path d="M12 8v4M6 16v-4h12v4" />
    </>
  ),
  // Curseurs : les réglages.
  reglages: (
    <>
      <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
      <circle cx="15" cy="7" r="2" />
      <circle cx="9" cy="17" r="2" />
    </>
  ),
};

export function PictoMenu({ theme, taille = 16 }: { theme: ThemeMenu; taille?: number }) {
  return (
    <svg
      className={`picto-menu picto-menu--${theme}`}
      width={taille}
      height={taille}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {TRACES[theme]}
    </svg>
  );
}
