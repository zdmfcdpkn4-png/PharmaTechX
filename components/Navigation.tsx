"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { BoutonRevoirTutoriel } from "./Tutoriel";

export interface LienRail {
  href: string;
  libelle: string;
  /** Compteur affiché à droite du libellé (signalements ouverts, par exemple). */
  indice?: string;
}

export interface GroupeRail {
  titre: string;
  liens: LienRail[];
}

/**
 * Contenu du volet de navigation (question 37, choix c).
 *
 * Les liens sont fournis par le gabarit racine, qui seul connaît la session :
 * ce composant n'ajoute que le repérage de la page courante et le repli du
 * groupe d'administration, ouvert de lui-même sur les écrans d'administration.
 */
export function Navigation({
  groupes,
  administration,
}: {
  groupes: GroupeRail[];
  administration: GroupeRail | null;
}) {
  const chemin = usePathname();
  // Ouvert par défaut : replié, le groupe cachait le dépôt de questions à
  // qui le cherchait (remarque du 19/09/2026). Le repli reste possible.
  const [adminOuvert, setAdminOuvert] = useState(true);
  // Repérage : seuls les liens de page entière sont marqués. Les ancres d'une
  // même page ne le sont pas — c'est le défilement qui y répond, pas le volet.
  const courant = (href: string) => !href.includes("#") && chemin === href;

  const lien = (l: LienRail) => (
    <Link key={l.href} href={l.href} aria-current={courant(l.href) ? "page" : undefined}>
      {l.libelle}
      {l.indice ? <span className="indice">{l.indice}</span> : null}
    </Link>
  );

  return (
    <>
      {groupes.map((g) => (
        <div key={g.titre} className="rail-groupe">
          <span className="rail-titre">{g.titre}</span>
          {g.liens.map(lien)}
        </div>
      ))}

      {administration && (
        <details
          className="rail-groupe"
          open={adminOuvert || chemin.startsWith("/admin")}
          onToggle={(e) => setAdminOuvert(e.currentTarget.open)}
        >
          <summary>{administration.titre}</summary>
          <div className="rail-liens">{administration.liens.map(lien)}</div>
        </details>
      )}

      {/* Rend `null` hors session : le volet de la connexion n'en porte pas. */}
      <BoutonRevoirTutoriel />
    </>
  );
}
