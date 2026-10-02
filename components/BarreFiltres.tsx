import Link from "next/link";
import type { ReactNode } from "react";
import { RECHERCHE_MAX } from "@/content/filtres-banque";
import {
  adresseFiltree,
  compteRetenu,
  filtrent,
  pucesFiltres,
  type ChampFiltre,
  type RechercheFiltre,
} from "@/content/filtres";

const LOUPE = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
);

function Champ({ c, visible }: { c: ChampFiltre; visible: boolean }) {
  const classe = visible ? `champ ${c.large ? "filtre-module" : "filtre-court"}` : "champ";
  if (c.type === "jour") {
    return (
      <label className={classe}>
        <span>{c.libelle}</span>
        <input type="date" name={c.nom} defaultValue={c.valeur} />
      </label>
    );
  }
  return (
    <label className={classe}>
      <span>{c.libelle}</span>
      <select name={c.nom} defaultValue={c.valeur}>
        <option value="">{c.tous ?? "Tous"}</option>
        {(c.options ?? []).map((o) => (
          <option key={o.valeur} value={o.valeur}>
            {o.libelle}
          </option>
        ))}
      </select>
    </label>
  );
}

/**
 * La barre de filtres de la banque (question 89), commune aux listes
 * (question 91, choix a, lot 3) : formulaire en GET, donc les filtres restent
 * dans l'adresse. Deux ou trois champs en vue, les autres sous « Plus de
 * filtres », qui dit combien y sont actifs ; le nombre de lignes retenues ;
 * une puce par filtre actif, qui le retire, et « Tout effacer » dès deux.
 * Calculs dans `content/filtres.ts`.
 */
export function BarreFiltres({
  adresse,
  recherche,
  champs,
  plus = [],
  plusLibelle = "Plus de filtres",
  gardes = [],
  retenus,
  total,
  unite,
  plafond,
  ancre = "",
  classe = "",
  children,
}: {
  /** Page filtrée, sans paramètre. */
  adresse: string;
  recherche?: RechercheFiltre;
  /** Deux ou trois champs, en vue. */
  champs: readonly ChampFiltre[];
  /** Les autres, sous « Plus de filtres ». */
  plus?: readonly ChampFiltre[];
  /** Intitulé du repli quand il porte aussi un tri : « Plus de filtres et tri », comme la banque. */
  plusLibelle?: string;
  /** Paramètres qui ne sont pas des filtres, gardés par le formulaire et les puces. */
  gardes?: readonly (readonly [string, string])[];
  retenus: number;
  total: number;
  /** Singulier et pluriel de ce que compte la liste. */
  unite: readonly [string, string];
  /** Phrase ajoutée au compte quand la liste lue est plafonnée. */
  plafond?: string;
  /** Section où revenir après un filtre (Repères : `programme`). */
  ancre?: string;
  /** Classe ajoutée au formulaire. */
  classe?: string;
  /** Ce que la page ajoute sous la barre (le périmètre du Pilotage). */
  children?: ReactNode;
}) {
  const tous = [...champs, ...plus];
  const puces = pucesFiltres(adresse, gardes, recherche, tous, ancre);
  const filtre = filtrent(recherche, tous);
  const replies = plus.filter((c) => c.valeur !== "").length;
  return (
    <form method="get" action={ancre ? `${adresse}#${ancre}` : adresse} className={`carte filtres${classe ? ` ${classe}` : ""}`} role="search">
      {gardes.map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <div className="filtres-ligne">
        {recherche && (
          <label className="recherche-banque">
            {LOUPE}
            <span className="lecture-seule">Rechercher</span>
            <input
              type="search"
              name={recherche.nom ?? "q"}
              defaultValue={recherche.valeur}
              maxLength={RECHERCHE_MAX}
              placeholder={recherche.placeholder}
            />
          </label>
        )}
        {champs.map((c) => (
          <Champ key={c.nom} c={c} visible />
        ))}
      </div>
      {plus.length > 0 && (
        <details className="filtres-plus">
          <summary>
            {plusLibelle}
            {replies > 0 && <span className="filtres-nb">{replies}</span>}
          </summary>
          <div className="filtres-panneau">
            {plus.map((c) => (
              <Champ key={c.nom} c={c} visible={false} />
            ))}
          </div>
        </details>
      )}
      <div className="actions filtres-pied">
        <button type="submit" className="bouton bouton--compact bouton--secondaire">
          Filtrer
        </button>
        <span className="legende filtres-compte" role="status">
          {compteRetenu(retenus, total, unite, filtre)}
          {plafond ? ` ${plafond}` : ""}
        </span>
      </div>
      {puces.length > 0 && (
        <p className="puces" aria-label="Filtres actifs">
          {puces.map((x) => (
            <Link key={x.cle} href={x.href} className="puce" aria-label={`${x.libelle} — retirer ce filtre`}>
              {x.libelle}
              <span className="puce-x" aria-hidden="true">
                ✕
              </span>
            </Link>
          ))}
          {puces.length > 1 && (
            <Link href={adresseFiltree(adresse, gardes, ancre)} className="puces-effacer">
              Tout effacer
            </Link>
          )}
        </p>
      )}
      {children}
    </form>
  );
}
