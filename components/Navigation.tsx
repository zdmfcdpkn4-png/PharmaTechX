"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { BoutonRevoirTutoriel } from "./Tutoriel";
import { groupePorteLaPage, relevePage, type IdGroupe } from "@/lib/rail";

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

/**
 * Sous-partie d'un groupe — un **sous-menu** depuis le 22/09/2026 : il se
 * replie comme un groupe. Groupe d'administration ouvert, la barre montrait
 * ses seize liens d'un bloc ; elle n'en montre plus que trois intitulés, plus
 * les liens du sous-menu qui porte la page courante.
 */
export interface SousGroupeRail {
  titre: string;
  liens: LienRail[];
}



export interface GroupeRail {
  /** Sert à décider quel groupe s'ouvre selon la page courante. */
  id: IdGroupe;
  titre: string;
  liens?: LienRail[];
  sous?: SousGroupeRail[];
  /**
   * Onglet (22/09/2026) : un groupe d'un seul lien, rendu comme un intitulé
   * cliquable, sans repli, et placé en fin de volet. C'est la forme de
   * l'onglet RGPD, qui porte seul toute l'information sur les données.
   */
  onglet?: boolean;
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
 *      se lisent pas. Des sous-parties — Suivi, Questions, Modules, Réglages
 *      depuis le 22/09/2026, où « Contenu » et ses huit liens a été coupé en
 *      deux — les rangent par usage et non par ordre d'écriture.
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
   * d'administration cachait le dépôt de questions à qui le cherchait. Même
   * règle dans le Menu (`lib/rail.ts`).
   */
  const porteLaPage = (id: GroupeRail["id"]) => groupePorteLaPage(id, chemin);

  const [choisis, setChoisis] = useState<Record<string, boolean>>({});
  const estOuvert = (id: GroupeRail["id"]) => choisis[id] ?? porteLaPage(id);
  const basculer = (id: string, ouvert: boolean) =>
    setChoisis((c) => (c[id] === ouvert ? c : { ...c, [id]: ouvert }));

  // Même règle pour un sous-menu : ouvert de lui-même s'il porte la page
  // courante, et un choix fait à la main l'emporte ensuite.
  const cleSous = (g: GroupeRail, s: SousGroupeRail) => `${g.id}/${s.titre}`;
  const sousOuvert = (g: GroupeRail, s: SousGroupeRail) =>
    choisis[cleSous(g, s)] ?? s.liens.some((l) => relevePage(chemin, l.href));

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

  const onglet = (g: GroupeRail) => {
    const l = g.liens?.[0];
    if (!l) return null;
    return (
      <Link
        key={g.id}
        href={l.href}
        className="rail-onglet"
        aria-current={courant(l.href) ? "page" : undefined}
      >
        {g.titre}
        <span className="rail-onglet-detail">{l.libelle}</span>
      </Link>
    );
  };

  const groupe = (g: GroupeRail) => g.onglet ? onglet(g) : (
    <details
      key={g.id}
      className="rail-groupe"
      open={estOuvert(g.id)}
      onToggle={(e) => basculer(g.id, e.currentTarget.open)}
    >
      <summary>{g.titre}</summary>
      <div className="rail-liens">
        {g.liens?.map(lien)}
        {g.sous?.map((s) => {
          const ouvert = sousOuvert(g, s);
          // Replié, un sous-menu montre la somme de ses comptes non nuls : sans
          // quoi « Rapports 3 » disparaîtrait avec lui.
          const enAttente = s.liens.reduce((n, l) => n + (l.compte ?? 0), 0);
          return (
            <details
              key={s.titre}
              className="rail-sous"
              open={ouvert}
              onToggle={(e) => basculer(cleSous(g, s), e.currentTarget.open)}
            >
              <summary>
                <span className="rail-sous-titre">{s.titre}</span>
                {!ouvert && enAttente > 0 ? (
                  <>
                    <span className="compte-attente" aria-hidden="true">{enAttente}</span>
                    <span className="lecture-seule">, {enAttente} en attente</span>
                  </>
                ) : null}
              </summary>
              <div className="rail-sous-liens">{s.liens.map(lien)}</div>
            </details>
          );
        })}
      </div>
    </details>
  );

  return (
    <>
      {groupes.filter((g) => !g.onglet).map(groupe)}
      {administration && groupe(administration)}
      {groupes.filter((g) => g.onglet).map(groupe)}

      {/* Rend `null` hors session : le volet de la connexion n'en porte pas. */}
      <BoutonRevoirTutoriel />
    </>
  );
}
