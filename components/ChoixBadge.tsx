import { Badge, BADGES } from "./Badge";
import { NOMS_ILLUSTRATION, NOMS_PICTOGRAMME, SANS_BADGE } from "@/content/badges";

/**
 * Choix d'un badge sur une grille qui montre les dessins, plutôt qu'une liste
 * de noms : personne ne choisit une image d'après son identifiant.
 *
 * `familles` suit la contrainte mesurée : les illustrations ne se lisent pas en
 * dessous de ~72 px, donc elles ne sont proposées que là où le badge est rendu
 * en vignette (module). Une filière, dont le badge s'affiche en pastille de
 * 24 px, ne reçoit que des pictogrammes.
 *
 * `valeurAucun` : chaîne vide pour une filière (jamais de proposition
 * automatique), `SANS_BADGE` pour un module, où la chaîne vide signifie « pas
 * encore renseigné » et laisse jouer la proposition d'après le titre.
 */
export function ChoixBadge({
  nom,
  defaut,
  familles = "toutes",
  valeurAucun = "",
  libelleAucun = "Aucun",
}: {
  nom: string;
  defaut?: string;
  familles?: "toutes" | "pictogrammes";
  valeurAucun?: string;
  libelleAucun?: string;
}) {
  const aucunCoche = !defaut || defaut === valeurAucun;
  const grille = (noms: readonly string[], taille: number) => (
    <div className={taille > 24 ? "grille-badges grille-badges--vignettes" : "grille-badges"}>
      {noms.map((n) => (
        <label key={n} className="choix-badge">
          <input type="radio" name={nom} value={n} defaultChecked={defaut === n} />
          <Badge nom={n} taille={taille} />
          <span className="legende">{BADGES[n].libelle}</span>
        </label>
      ))}
    </div>
  );
  return (
    <fieldset className="groupe">
      <legend className="champ-titre">Badge</legend>
      <div className="grille-badges grille-badges--aucun">
        <label className="choix-badge">
          <input type="radio" name={nom} value={valeurAucun} defaultChecked={aucunCoche} />
          <span className="badge badge--vide" aria-hidden="true" />
          <span className="legende">{libelleAucun}</span>
        </label>
      </div>
      {familles === "toutes" && (
        <>
          <p className="legende" style={{ margin: ".5rem 0 0" }}>
            Illustrations — vignette du module. Ornement : aucune valeur normative, jamais reprise sur un rapport.
          </p>
          {grille(NOMS_ILLUSTRATION, 56)}
          <p className="legende" style={{ margin: ".5rem 0 0" }}>Pictogrammes</p>
        </>
      )}
      {grille(NOMS_PICTOGRAMME, 24)}
    </fieldset>
  );
}

export { SANS_BADGE };
