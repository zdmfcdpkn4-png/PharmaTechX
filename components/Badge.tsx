import type { ReactNode } from "react";

/**
 * Banque de pictogrammes du site.
 *
 * Dessinés ici, en SVG monochrome (`currentColor`) sur une grille de 24 : rien
 * n'est téléchargé, aucune licence tierce n'entre dans le dépôt, et le trait
 * reste lisible en impression noir et blanc sur les rapports. Ils servent de
 * badge de filière (décision du 19/09/2026, question 38) et d'illustration de
 * domaine dans les listes.
 *
 * Ajouter un pictogramme : une entrée de plus dans `BADGES`, rien d'autre.
 * L'identifiant est stocké en base ; un identifiant inconnu n'affiche rien
 * plutôt que de casser l'écran.
 */

export interface DefinitionBadge {
  libelle: string;
  trace: ReactNode;
}

export const BADGES: Record<string, DefinitionBadge> = {
  isolateur: {
    libelle: "Isolateur",
    trace: (
      <>
        <rect x="2.5" y="6" width="19" height="12" rx="1.5" />
        <path d="M2.5 10h19" />
        <circle cx="9" cy="14" r="2" />
        <circle cx="15" cy="14" r="2" />
      </>
    ),
  },
  hotte: {
    libelle: "Hotte à flux laminaire",
    trace: (
      <>
        <rect x="3" y="4" width="18" height="16" rx="1.5" />
        <path d="M3 9h18" />
        <path d="M8 12v4m0 0-1.2-1.4M8 16l1.2-1.4" />
        <path d="M16 12v4m0 0-1.2-1.4M16 16l1.2-1.4" />
      </>
    ),
  },
  flacon: {
    libelle: "Flacon",
    trace: (
      <>
        <path d="M10 3h4v4l3 5v7a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-7l3-5V3z" />
        <path d="M9.5 3h5" />
        <path d="M7 14h10" />
      </>
    ),
  },
  seringue: {
    libelle: "Seringue",
    trace: (
      <>
        <path d="M14.5 4.5 19.5 9.5" />
        <path d="M17 2 22 7" />
        <path d="M13 6 6 13l5 5 7-7z" />
        <path d="M6.5 15.5 3 19" />
        <path d="M9.5 9.5 12 12" />
      </>
    ),
  },
  poche: {
    libelle: "Poche de perfusion",
    trace: (
      <>
        <path d="M10 2h4v2h-4z" />
        <rect x="6" y="4" width="12" height="13" rx="2" />
        <path d="M12 17v3" />
        <path d="M6 9h12" />
      </>
    ),
  },
  gants: {
    libelle: "Gants",
    trace: (
      <>
        <path d="M7 21V10a1.5 1.5 0 0 1 3 0V5a1.5 1.5 0 0 1 3 0v5" />
        <path d="M13 10V6.5a1.5 1.5 0 0 1 3 0V13" />
        <path d="M16 13v-1.5a1.5 1.5 0 0 1 3 0V16a5 5 0 0 1-5 5H7" />
      </>
    ),
  },
  balance: {
    libelle: "Balance",
    trace: (
      <>
        <path d="M12 3v16" />
        <path d="M7 21h10" />
        <path d="M4 7h16" />
        <path d="M4 7 1.5 13h5z" />
        <path d="M20 7l-2.5 6h5z" />
      </>
    ),
  },
  sonde: {
    libelle: "Sonde de température",
    trace: (
      <>
        <path d="M12 3a2 2 0 0 1 2 2v8.2a4 4 0 1 1-4 0V5a2 2 0 0 1 2-2z" />
        <path d="M12 8v6" />
        <circle cx="12" cy="17" r="1.6" />
      </>
    ),
  },
  filtre: {
    libelle: "Filtre HEPA",
    trace: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="1.5" />
        <path d="M6 5v14M9 5v14M12 5v14M15 5v14M18 5v14" />
      </>
    ),
  },
  dechets: {
    libelle: "Déchets",
    trace: (
      <>
        <path d="M4 7h16" />
        <path d="M9 7V4.5h6V7" />
        <path d="M6 7l1 13h10l1-13" />
        <path d="M10 11v6M14 11v6" />
      </>
    ),
  },
  etiquette: {
    libelle: "Étiquetage",
    trace: (
      <>
        <path d="M3 11.5V4.5A1.5 1.5 0 0 1 4.5 3h7l9 9-8 8z" />
        <circle cx="7.5" cy="7.5" r="1.4" />
      </>
    ),
  },
  controle: {
    libelle: "Contrôle",
    trace: (
      <>
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="M15.5 15.5 21 21" />
        <path d="m7.8 10.6 2 2 3.4-3.8" />
      </>
    ),
  },
  document: {
    libelle: "Document",
    trace: (
      <>
        <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
        <path d="M14 3v5h5" />
        <path d="M8.5 13h7M8.5 16.5h5" />
      </>
    ),
  },
  formation: {
    libelle: "Formation",
    trace: (
      <>
        <path d="M12 4 2.5 8.5 12 13l9.5-4.5z" />
        <path d="M6 10.5V16c0 1.7 2.7 3 6 3s6-1.3 6-3v-5.5" />
        <path d="M21.5 8.5V14" />
      </>
    ),
  },
  sas: {
    libelle: "Sas",
    trace: (
      <>
        <rect x="3" y="3" width="7" height="18" rx="1" />
        <rect x="14" y="3" width="7" height="18" rx="1" />
        <path d="M10.5 12h3" />
        <path d="m12.5 10.2 1.8 1.8-1.8 1.8" />
      </>
    ),
  },
  nettoyage: {
    libelle: "Nettoyage",
    trace: (
      <>
        <path d="M9 3h4v3H9z" />
        <path d="M8 6h6a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z" />
        <path d="M6 11h10" />
        <path d="M18 5h2M18 8h2M18 11h2" />
      </>
    ),
  },
  preparation: {
    libelle: "Préparation",
    trace: (
      <>
        <path d="M9 2v6.5L4.5 17a3 3 0 0 0 2.6 4.5h9.8a3 3 0 0 0 2.6-4.5L15 8.5V2z" />
        <path d="M8 2h8" />
        <path d="M6.6 14h10.8" />
      </>
    ),
  },
  stockage: {
    libelle: "Stockage",
    trace: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="1.5" />
        <path d="M3 9h18M3 15h18M12 3v18" />
      </>
    ),
  },
};

export const NOMS_BADGE = Object.keys(BADGES);

/** Le pictogramme d'un identifiant, ou rien si l'identifiant est inconnu ou vide. */
export function Badge({
  nom,
  taille = 24,
  className,
}: {
  nom?: string | null;
  taille?: number;
  className?: string;
}) {
  const def = nom ? BADGES[nom] : undefined;
  if (!def) return null;
  return (
    <svg
      className={className ? `badge ${className}` : "badge"}
      width={taille}
      height={taille}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label={def.libelle}
    >
      {def.trace}
    </svg>
  );
}
