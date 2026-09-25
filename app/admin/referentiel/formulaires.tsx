import { blocsCompetence, metiers, metierOuDefaut, parMetier } from "@/content/habilitation";
import type { Filiere } from "@/content/habilitation";
import { ChoixBadge } from "@/components/ChoixBadge";
import { actionEnregistrerFiliere, actionEnregistrerNiveau, actionSupprimerFiliere } from "./actions";

/**
 * Formulaires d'une filière et d'un niveau, communs au Référentiel et à la
 * page d'une filière (question 80, choix a) : les mêmes champs, les mêmes
 * actions, écrits une fois. `retour` dit où revenir après l'enregistrement ;
 * absent, c'est le Référentiel.
 */

export type Retour = "referentiel" | "filiere" | "filieres";

/** Préfixes des codes par métier, rappelés sous le champ « Code » (question 46, choix a). */
export const RAPPEL_PREFIXES = metiers
  .filter((m) => m.prefixe)
  .map((m) => `${m.prefixe} ${m.libelle.toLowerCase()}`)
  .join(", ");

/** Numéros des blocs de la fiche et préfixes seuls, rappelés sous les champs d'une filière. */
const PLAGE_BLOCS = `${blocsCompetence[0].numero} à ${blocsCompetence[blocsCompetence.length - 1].numero}`;
const PREFIXES = metiers.filter((m) => m.prefixe).map((m) => m.prefixe).join(", ");

function ChampRetour({ retour }: { retour?: Retour }) {
  return retour && retour !== "referentiel" ? <input type="hidden" name="retour" value={retour} /> : null;
}

/**
 * Ce que fait chaque champ d'une filière (demande du 24/09/2026). Aucun écran
 * ne lit les blocs : le dire évite de croire qu'ils composent le programme,
 * qui vient des modules. Une filière de la fiche garde sa place et son métier.
 */
export function AideFiliere({ id, fiche = false }: { id: string; fiche?: boolean }) {
  return (
    <ul className="liste-nue legende">
      <li id={`${id}-blocs`}>
        <strong>Blocs de compétence</strong> : numéros des blocs de la fiche d&apos;habilitation ({PLAGE_BLOCS}) que
        couvre la filière, pour mémoire. Le site ne s&apos;en sert pas : le programme de la filière vient des modules
        qui la cochent dans leur réglage (menu Modules).
      </li>
      <li id={`${id}-rang`}>
        <strong>Rang</strong> :{" "}
        {fiche
          ? "sans effet sur une filière de la fiche, qui garde sa place en tête des listes."
          : "ordre de la filière dans les listes du site, après celles de la fiche : rang croissant, puis ordre alphabétique à rang égal."}
      </li>
      <li id={`${id}-metier`}>
        <strong>Métier</strong> :{" "}
        {fiche
          ? "une filière de la fiche reste au préparateur."
          : `range la filière sous ce métier dans le référentiel. Les niveaux qui s'y rattachent prennent le préfixe de code de ce métier (${PREFIXES} ; aucun pour le préparateur) et se rangent avec ses niveaux. À choisir avant d'y déposer un niveau : il ne change plus tant qu'elle en porte.`}
      </li>
    </ul>
  );
}

/** « Modifier » une filière : libellé, blocs, rang, description, métier, badge, présence dans les listes. */
export function FormulaireFiliere({
  filiere,
  rang,
  actif,
  fiche,
  retour,
}: {
  filiere: Pick<Filiere, "id" | "libelle" | "description" | "blocs" | "badge" | "metier">;
  rang: number;
  actif: boolean;
  fiche: boolean;
  retour?: Retour;
}) {
  const f = filiere;
  return (
    <form action={actionEnregistrerFiliere} className="carte">
      <input type="hidden" name="id" value={f.id} />
      <ChampRetour retour={retour} />
      <div className="rangee">
        <label className="champ">
          <span>Libellé</span>
          <input name="libelle" defaultValue={f.libelle} maxLength={120} required />
        </label>
        <label className="champ">
          <span>Blocs de compétence</span>
          <input name="blocs" defaultValue={f.blocs.join(", ")} placeholder="1, 3, 5" aria-describedby={`aide-filiere-${f.id}-blocs`} />
        </label>
        <label className="champ">
          <span>Rang</span>
          <input name="rang" type="number" min={0} max={999} defaultValue={rang} aria-describedby={`aide-filiere-${f.id}-rang`} />
        </label>
      </div>
      <AideFiliere id={`aide-filiere-${f.id}`} fiche={fiche} />
      <label className="champ">
        <span>Description</span>
        <textarea name="description" defaultValue={f.description} maxLength={400} rows={2} />
      </label>
      {/* Une filière de la fiche reste au préparateur. */}
      {!fiche && (
        <label className="champ">
          <span>Métier</span>
          <select name="metier" defaultValue={metierOuDefaut(f.metier).id} aria-describedby={`aide-filiere-${f.id}-metier`}>
            {metiers.map((x) => (
              <option key={x.id} value={x.id}>{x.libelle}</option>
            ))}
          </select>
        </label>
      )}
      <ChoixBadge nom="badge" defaut={f.badge} familles="pictogrammes" />
      <label className="case-seule">
        <input type="checkbox" name="actif" defaultChecked={actif} />
        <span>Proposée dans les listes de rattachement</span>
      </label>
      <div className="actions">
        <button type="submit" className="bouton bouton--compact">Enregistrer</button>
      </div>
    </form>
  );
}

/** « Supprimer le dépôt » : une filière de la fiche reprend son libellé d'origine, une filière ajoutée disparaît. */
export function SupprimerDepotFiliere({ id, retour }: { id: string; retour?: Retour }) {
  return (
    <form action={actionSupprimerFiliere}>
      <input type="hidden" name="id" value={id} />
      <ChampRetour retour={retour} />
      <button type="submit" className="bouton bouton--compact bouton--discret">
        Supprimer le dépôt
      </button>
    </form>
  );
}

/** « Ajouter une filière ». */
export function FormulaireNouvelleFiliere({ retour }: { retour?: Retour }) {
  return (
    <form action={actionEnregistrerFiliere} className="carte">
      <h3 style={{ fontSize: "1rem", margin: 0 }}>Ajouter une filière</h3>
      <ChampRetour retour={retour} />
      <div className="rangee">
        <label className="champ">
          <span>Libellé</span>
          <input name="libelle" maxLength={120} required placeholder="Parcours Stérilisation" />
        </label>
        <label className="champ">
          <span>Identifiant (facultatif)</span>
          <input name="id" maxLength={40} placeholder="déduit du libellé" />
        </label>
        <label className="champ">
          <span>Blocs de compétence</span>
          <input name="blocs" placeholder="1, 3" aria-describedby="aide-nouvelle-filiere-blocs" />
        </label>
        <label className="champ">
          <span>Rang</span>
          <input name="rang" type="number" min={0} max={999} defaultValue={0} aria-describedby="aide-nouvelle-filiere-rang" />
        </label>
        <label className="champ">
          <span>Métier</span>
          <select name="metier" defaultValue={metiers[0].id} aria-describedby="aide-nouvelle-filiere-metier">
            {metiers.map((x) => (
              <option key={x.id} value={x.id}>{x.libelle}</option>
            ))}
          </select>
        </label>
      </div>
      <AideFiliere id="aide-nouvelle-filiere" />
      <label className="champ">
        <span>Description</span>
        <textarea name="description" maxLength={400} rows={2} />
      </label>
      {/* Pictogrammes seuls, comme dans « Modifier » : le badge d'une filière
          s'affiche en pastille de 24 px, où une illustration ne se lit pas. */}
      <ChoixBadge nom="badge" familles="pictogrammes" />
      <input type="hidden" name="actif" value="1" />
      <div className="actions">
        <button type="submit" className="bouton">Ajouter la filière</button>
      </div>
    </form>
  );
}

/**
 * « Ajouter un niveau ». Sur la page d'une filière, la filière est donnée
 * (`filiereFixe`) : le niveau s'y rattache sans liste à choisir.
 */
export function FormulaireNouveauNiveau({
  filieres,
  prerequis,
  filiereFixe,
  idRangs,
  retour,
}: {
  filieres: Pick<Filiere, "id" | "libelle" | "metier">[];
  /** Codes proposés en prérequis, dans l'ordre du référentiel. */
  prerequis: string[];
  filiereFixe?: string;
  /** Élément qui explique les rangs, s'il est sur la page. */
  idRangs?: string;
  retour?: Retour;
}) {
  return (
    <form action={actionEnregistrerNiveau} className="carte">
      <h3 style={{ fontSize: "1rem", margin: 0 }}>Ajouter un niveau{filiereFixe ? " à cette filière" : ""}</h3>
      <ChampRetour retour={retour} />
      <div className="rangee">
        <label className="champ">
          <span>Code</span>
          <input name="code" maxLength={12} required placeholder="S1" aria-describedby="rappel-prefixes" />
        </label>
        <label className="champ">
          <span>Libellé</span>
          <input name="libelle" maxLength={120} required placeholder="S1 — stérilisation (base)" />
        </label>
        {filiereFixe ? (
          <input type="hidden" name="filiereId" value={filiereFixe} />
        ) : (
          <label className="champ">
            <span>Filière</span>
            <select name="filiereId" defaultValue={filieres[0]?.id}>
              {parMetier(filieres, (f) => f.metier).map(({ metier, liste }) => (
                <optgroup key={metier.id} label={metier.libelle}>
                  {liste.map((f) => (
                    <option key={f.id} value={f.id}>{f.libelle}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
        )}
        <label className="champ">
          <span>Rang</span>
          <input name="rang" type="number" min={0} max={999} defaultValue={0} aria-describedby={idRangs} />
        </label>
      </div>
      <p id="rappel-prefixes" className="legende" style={{ margin: 0 }}>
        Le code prend le préfixe du métier de la filière s&apos;il ne l&apos;a pas : {RAPPEL_PREFIXES}.
        Le préparateur n&apos;en a pas.
      </p>
      <label className="champ">
        <span>Condition d&apos;obtention</span>
        <textarea name="condition" maxLength={600} rows={2} />
      </label>
      <fieldset className="groupe">
        <legend className="champ-titre">Prérequis</legend>
        <div className="cases">
          {prerequis.map((code) => (
            <label key={code}>
              <input type="checkbox" name="prerequis" value={code} />
              <span>{code}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <input type="hidden" name="actif" value="1" />
      <div className="actions">
        <button type="submit" className="bouton">Ajouter le niveau</button>
      </div>
    </form>
  );
}
