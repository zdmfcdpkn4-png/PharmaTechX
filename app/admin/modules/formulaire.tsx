import { criteres } from "@/content/habilitation";
import { getReferentiel } from "@/content/referentiel-db";
import type { LigneModuleDepose } from "@/content/modules-db";
import { LIMITES_BAREME } from "@/content/bareme";
import { badgeSuggere, SANS_BADGE } from "@/content/badges";
import { ChoixBadge } from "@/components/ChoixBadge";

/**
 * Formulaire d'un module déposé (création et modification). Rendu serveur :
 * les cases cochées partent telles quelles à l'action.
 */
export async function FormulaireModule({
  initiale,
  action,
  seuilDefaut,
}: {
  initiale?: LigneModuleDepose | null;
  action: (formData: FormData) => Promise<void>;
  /** Seuil par défaut du barème, proposé à la création. */
  seuilDefaut: number;
}) {
  const { filieres, niveaux } = await getReferentiel();
  const coche = (liste: string[] | undefined, v: string, defaut = false) => (liste ? liste.includes(v) : defaut);
  return (
    <form action={action} className="carte">
      {initiale && <input type="hidden" name="id" value={initiale.id} />}
      <div className="rangee">
        <label className="champ">
          <span>Titre</span>
          <input
            type="text"
            name="titre"
            required
            maxLength={200}
            defaultValue={initiale?.titre ?? ""}
            placeholder="Réception et contrôle des matières premières"
          />
        </label>
        <label className="champ">
          <span>Critère de la fiche d&apos;habilitation (facultatif)</span>
          <select name="critereId" defaultValue={initiale?.critere_id ?? ""}>
            <option value="">Aucun — module hors fiche</option>
            {criteres.map((x) => (
              <option key={x.id} value={x.id}>
                {x.id} — {x.libelle.slice(0, 70)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="champ">
        <span>Objectif (une phrase : ce que l&apos;apprenant sait faire à l&apos;issue du module)</span>
        <input type="text" name="objectif" maxLength={300} defaultValue={initiale?.objectif ?? ""} />
      </label>
      <label className="champ">
        <span>Présentation (facultative ; paragraphes, **gras**, listes « - »)</span>
        <textarea name="presentation" rows={8} maxLength={20000} defaultValue={initiale?.presentation ?? ""} />
      </label>
      <fieldset className="groupe">
        <legend className="champ-titre">Filières (aucune cochée : tronc commun, tous postes)</legend>
        <div className="cases">
          {filieres
            .filter((f) => f.id !== "socle")
            .map((f) => (
              <label key={f.id}>
                <input type="checkbox" name="filieres" value={f.id} defaultChecked={coche(initiale?.filieres, f.id)} />
                {f.libelle}
              </label>
            ))}
        </div>
      </fieldset>
      <fieldset className="groupe">
        <legend className="champ-titre">Niveaux (aucun coché : tous niveaux)</legend>
        <div className="cases">
          {niveaux.map((n) => (
            <label key={n.code}>
              <input type="checkbox" name="niveaux" value={n.code} defaultChecked={coche(initiale?.niveaux, n.code)} />
              {n.libelle}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="groupe">
        <legend className="champ-titre">Parcours</legend>
        <div className="cases">
          <label>
            <input type="checkbox" name="parcours" value="integration" defaultChecked={coche(initiale?.parcours, "integration", true)} />
            Intégration
          </label>
          <label>
            <input type="checkbox" name="parcours" value="maintien" defaultChecked={coche(initiale?.parcours, "maintien", true)} />
            Maintien d&apos;habilitation
          </label>
        </div>
      </fieldset>
      {/*
        À la création, le titre n'est pas encore connu du serveur : « aucun »
        vaut « pas encore renseigné » (chaîne vide) et laisse le site proposer
        une illustration d'après le titre à la première lecture. À la
        modification, la proposition est déjà pré-cochée, donc « aucun » est un
        refus explicite (`SANS_BADGE`), qui ne se fait pas rattraper.
      */}
      <ChoixBadge
        nom="badge"
        defaut={initiale?.badge || badgeSuggere(initiale?.titre ?? "", initiale?.objectif ?? "")}
        valeurAucun={initiale ? SANS_BADGE : ""}
        libelleAucun={initiale ? "Aucun" : "Aucun — proposé d'après le titre"}
      />
      <div className="rangee">
        <label className="champ">
          <span>Seuil de réussite (%)</span>
          <input
            type="number"
            name="seuil"
            min={LIMITES_BAREME.seuil.min}
            max={LIMITES_BAREME.seuil.max}
            step={1}
            defaultValue={initiale?.seuil ?? seuilDefaut}
          />
        </label>
        <label className="champ">
          <span>Durée indicative (minutes)</span>
          <input type="number" name="dureeMinutes" min={0} max={600} defaultValue={initiale?.duree_minutes ?? 0} />
        </label>
      </div>
      <div className="actions">
        <button type="submit" className="bouton">
          {initiale ? "Enregistrer" : "Créer le module (brouillon)"}
        </button>
      </div>
    </form>
  );
}
