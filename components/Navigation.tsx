"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { BoutonRevoirTutoriel } from "./Tutoriel";

export interface LienRail {
  href: string;
  libelle: string;
  /** Texte affiché à droite du libellé — l'identifiant d'agent, par exemple. */
  indice?: string;
  /**
   * Nombre d'actes en attente sur cet écran (paquet A, 21/09/2026). Le volet
   * n'affiche que les comptes non nuls : il est la carte, pas la file. C'est
   * l'accès rapide qui montre les zéros, parce qu'on l'ouvre justement pour
   * savoir s'il y a quelque chose.
   */
  compte?: number;
}

/** Sous-partie d'un groupe : un intitulé fin, jamais repliable. */
export interface SousGroupeRail {
  titre: string;
  liens: LienRail[];
}

export interface GroupeRail {
  /** Sert à décider quel groupe s'ouvre selon la page courante. */
  id: "formation" | "reperes" | "administration";
  titre: string;
  liens?: LienRail[];
  sous?: SousGroupeRail[];
}

/**
 * Contenu du volet de navigation (question 37, choix c ; refondu le
 * 19/09/2026, choix a + b + c).
 *
 * Trois partis, pris ensemble parce qu'ils règlent trois défauts distincts :
 *
 *   a. **Tous les groupes se replient.** Le volet alignait trente-quatre
 *      liens : plus haut que l'écran, donc parcouru au défilement. Un seul
 *      groupe s'ouvre de lui-même, celui de la page courante ; les autres
 *      attendent. Un repli ou une ouverture décidés à la main l'emportent
 *      ensuite sur cette règle, et tiennent jusqu'à la fin de la session de
 *      navigation.
 *   b. **L'administration se range en sous-parties.** Seize liens à plat ne
 *      se lisent pas. Trois sous-parties — Suivi, Contenu, Réglages — les
 *      rangent par usage et non par ordre d'écriture.
 *   c. **Le rythme se resserre**, mais au-dessus de 62 rem seulement : dans
 *      le tiroir de tablette et de téléphone, la cible tactile reste pleine
 *      (`--cible`).
 *
 * Les liens restent composés par le gabarit racine, seul endroit qui connaisse
 * la session, la conservation et la base.
 */
export function Navigation({
  groupes,
  administration,
}: {
  groupes: GroupeRail[];
  administration: GroupeRail | null;
}) {
  const chemin = usePathname();

  /**
   * Le groupe qui contient la page courante s'ouvre de lui-même. C'est ce qui
   * répond à l'objection du 19/09 : replié par défaut, le groupe
   * d'administration cachait le dépôt de questions à qui le cherchait.
   */
  const porteLaPage = (id: GroupeRail["id"]) => {
    if (id === "administration") return chemin.startsWith("/admin");
    if (id === "reperes") return chemin.startsWith("/reperes") || chemin.startsWith("/donnees-personnelles");
    return chemin === "/" || chemin.startsWith("/module");
  };

  const [choisis, setChoisis] = useState<Record<string, boolean>>({});
  const estOuvert = (id: GroupeRail["id"]) => choisis[id] ?? porteLaPage(id);
  const basculer = (id: GroupeRail["id"], ouvert: boolean) =>
    setChoisis((c) => (c[id] === ouvert ? c : { ...c, [id]: ouvert }));

  // Repérage : seuls les liens de page entière sont marqués. Les ancres d'une
  // même page ne le sont pas — c'est le défilement qui y répond, pas le volet.
  const courant = (href: string) => !href.includes("#") && chemin === href;

  const lien = (l: LienRail) => (
    <Link key={l.href} href={l.href} aria-current={courant(l.href) ? "page" : undefined}>
      {l.libelle}
      {l.indice ? <span className="indice">{l.indice}</span> : null}
      {l.compte ? (
        <>
          {/* Le compteur doit être dans le nom accessible, pas seulement à
              côté (WCAG 4.1.2) : « Signalements, 3 en attente ». */}
          <span className="compte-attente" aria-hidden="true">{l.compte}</span>
          <span className="lecture-seule">, {l.compte} en attente</span>
        </>
      ) : null}
    </Link>
  );

  const groupe = (g: GroupeRail) => (
    <details
      key={g.id}
      className="rail-groupe"
      open={estOuvert(g.id)}
      onToggle={(e) => basculer(g.id, e.currentTarget.open)}
    >
      <summary>{g.titre}</summary>
      <div className="rail-liens">
        {g.liens?.map(lien)}
        {g.sous?.map((s) => (
          <div key={s.titre} className="rail-sous">
            <span className="rail-sous-titre">{s.titre}</span>
            {s.liens.map(lien)}
          </div>
        ))}
      </div>
    </details>
  );

  return (
    <>
      {groupes.map(groupe)}
      {administration && groupe(administration)}

      {/* Rend `null` hors session : le volet de la connexion n'en porte pas. */}
      <BoutonRevoirTutoriel />
    </>
  );
}
