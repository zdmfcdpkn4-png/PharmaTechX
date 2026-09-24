import { getSession } from "@/lib/auth";
import { getReferentiel, listerFilieresDeposees, listerNiveauxDeposes, niveauxOrphelins } from "@/content/referentiel-db";
import { blocsCompetence, filieres as filieresFiche, metiers, metierOuDefaut, niveaux as niveauxFiche, parMetier } from "@/content/habilitation";
import { rangEffectif, rappelRangsFiche } from "@/content/ordre-niveaux";
import { Badge } from "@/components/Badge";
import { ChoixBadge } from "@/components/ChoixBadge";
import {
  actionEnregistrerFiliere,
  actionEnregistrerNiveau,
  actionSupprimerFiliere,
  actionSupprimerNiveau,
} from "./actions";

export const dynamic = "force-dynamic";

const MESSAGES: Record<string, string> = {
  filiere: "Filière enregistrée.",
  niveau: "Niveau enregistré.",
  "filiere-supprimee": "Dépôt de filière supprimé.",
  "niveau-supprime": "Dépôt de niveau supprimé.",
};

const ERREURS: Record<string, string> = {
  libelle: "Le libellé est obligatoire.",
  identifiant: "L'identifiant doit faire au moins deux caractères une fois normalisé.",
  code: "Le code du niveau est obligatoire.",
  "filiere-manquante": "Un niveau se rattache à une filière.",
  prefixe:
    "Ce code porte le préfixe d'un autre métier que celui de la filière choisie (PH- pharmacien / interne, AP- aide en pharmacie, AE- agent d'entretien).",
  longueur: "Le code dépasse douze caractères une fois le préfixe du métier ajouté.",
  "metier-change": "Un niveau ne change pas de métier : ajoutez-en un autre dans la filière voulue.",
  "metier-filiere":
    "Cette filière porte des niveaux : elle garde son métier. Supprimez d'abord ses niveaux déposés, ou ajoutez une autre filière.",
};

/** Codes des niveaux de la fiche : leur place fixe le rang par défaut (10, 20…). */
const CODES_FICHE = niveauxFiche.map((n) => String(n.code));

/** Préfixes des codes par métier, rappelés sous le champ « Code » (question 46, choix a). */
const RAPPEL_PREFIXES = metiers
  .filter((m) => m.prefixe)
  .map((m) => `${m.prefixe} ${m.libelle.toLowerCase()}`)
  .join(", ");

/** Numéros des blocs de la fiche et préfixes seuls, rappelés sous les champs d'une filière. */
const PLAGE_BLOCS = `${blocsCompetence[0].numero} à ${blocsCompetence[blocsCompetence.length - 1].numero}`;
const PREFIXES = metiers.filter((m) => m.prefixe).map((m) => m.prefixe).join(", ");

/**
 * Ce que fait chaque champ d'une filière (demande du 24/09/2026). Aucun écran
 * ne lit les blocs : le dire évite de croire qu'ils composent le programme,
 * qui vient des modules. Une filière de la fiche garde sa place et son métier.
 */
function AideFiliere({ id, fiche = false }: { id: string; fiche?: boolean }) {
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

export default async function Referentiel({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; erreur?: string }>;
}) {
  const p = await searchParams;
  const session = (await getSession())!;
  const estAdmin = session.role === "admin";
  const [{ filieres, niveaux }, deposeesF, deposesN, orphelins] = await Promise.all([
    getReferentiel(),
    listerFilieresDeposees(true),
    listerNiveauxDeposes(true),
    niveauxOrphelins().catch(() => []),
  ]);
  const depotF = new Map(deposeesF.map((f) => [f.id, f]));
  const depotN = new Map(deposesN.map((n) => [n.code, n]));
  // Une filière ou un niveau déposé puis désactivé ne figure plus dans le
  // référentiel servi : on l'affiche ici quand même, pour pouvoir le rouvrir.
  const inactivesF = deposeesF.filter((f) => !f.actif && !filieres.some((x) => x.id === f.id));
  const inactifsN = deposesN.filter((n) => !n.actif && !niveaux.some((x) => String(x.code) === n.code));
  const idsFiche = new Set(filieresFiche.map((f) => f.id));
  const toutesFilieres = [...filieres, ...inactivesF.map((f) => ({
    id: f.id, libelle: f.libelle, description: f.description, blocs: f.blocs,
    niveaux: [] as string[], badge: f.badge, origine: "base" as const, metier: f.metierId,
  }))];
  const metierDeFiliere = new Map(toutesFilieres.map((f) => [f.id, f.metier]));
  const tousNiveaux = [...niveaux.map((n) => ({
    code: String(n.code), libelle: n.libelle, filiere: n.filiere,
    condition: n.condition, prerequis: n.prerequis.map(String), origine: n.origine ?? "code", metier: n.metier,
  })), ...inactifsN.map((n) => ({
    code: n.code, libelle: n.libelle, filiere: n.filiereId,
    condition: n.condition, prerequis: n.prerequis, origine: "base" as const, metier: metierDeFiliere.get(n.filiereId),
  }))];
  // Même métier : un niveau ne change pas de métier en changeant de filière.
  const memeMetier = (a: string | undefined, b: string | undefined) =>
    metierOuDefaut(a).id === metierOuDefaut(b).id;

  return (
    <>
      <section className="panneau-titre">
        <h1>Référentiel : filières et niveaux</h1>
        <p>
          La fiche d&apos;habilitation livrée avec le site reste la référence. Ce qui est déposé ici
          la <strong>corrige</strong> lorsqu&apos;un identifiant existe déjà, et l&apos;<strong>étend</strong>{" "}
          sinon. Les rapports déjà émis portent leur propre copie des libellés : les modifier ici ne
          les réécrit pas.
        </p>
      </section>

      {p.ok && MESSAGES[p.ok] && <p className="encart encart--ok">{MESSAGES[p.ok]}</p>}
      {p.erreur && ERREURS[p.erreur] && (
        <p className="encart encart--attention" role="alert">{ERREURS[p.erreur]}</p>
      )}
      {!estAdmin && (
        <p className="encart encart--attention">
          Consultation seule : le référentiel se modifie avec un code d&apos;administration.
        </p>
      )}

      {orphelins.length > 0 && (
        <section className="encart encart--attention" role="status">
          <p>
            <strong>
              {orphelins.length === 1
                ? "Un rattachement cite un niveau inconnu"
                : `${orphelins.length} rattachements citent un niveau inconnu`}
              .
            </strong>{" "}
            Un niveau supprimé, ou renommé par l&apos;ajout d&apos;un nouveau code, laisse ici
            tout ce qui le citait. Rien n&apos;a été effacé : chaque ligne se reprend à la main
            — cocher le nouveau niveau à la place, régler son plafond au Barème puis
            l&apos;enregistrer, remplacer un code d&apos;accès par un code du nouveau niveau et
            révoquer l&apos;ancien — ou se laisse telle quelle. L&apos;échelle du préparateur a
            aussi été corrigée le 22/09/2026 : <code>P1</code> et <code>P2</code> ont
            laissé place à <code>N1b</code>.
          </p>
          <ul className="liste-nue">
            {orphelins.map((o) => (
              <li key={`${o.origine}-${o.cle}`} className="legende">
                {o.origine} — <strong>{o.cle}</strong> : {o.codes.join(", ")}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="section">
        <div className="section-titre">
          <h2 style={{ fontSize: "1.15rem" }}>Filières</h2>
          <span className="compte">{filieres.length}</span>
        </div>
        {/* Rangées par métier (question 53, choix b) : un métier sans filière
            le dit, c'est là que ses profils de poste se déposent. */}
        <ul className="liste-nue">
          {metiers.flatMap((m) => [
            <li key={`metier-${m.id}`}>
              <h3 style={{ fontSize: "1rem", margin: ".75rem 0 0" }}>{m.libelle}</h3>
              {!toutesFilieres.some((f) => memeMetier(f.metier, m.id)) && (
                <p className="legende" style={{ margin: ".25rem 0 0" }}>
                  Aucune filière pour ce métier : l&apos;ajouter ci-dessous, avec ce métier.
                </p>
              )}
            </li>,
            ...toutesFilieres.filter((f) => memeMetier(f.metier, m.id)).map((f) => {
            const d = depotF.get(f.id);
            return (
              <li key={f.id} className="carte">
                <div className="etape-tete">
                  <Badge nom={f.badge} />
                  <strong>{f.libelle}</strong>
                  <code className="legende">{f.id}</code>
                  <span className={`etiquette ${f.origine === "base" ? "etiquette--ok" : "etiquette--site"}`}>
                    {f.origine === "base" ? (d?.actif === false ? "Déposée, inactive" : "Déposée") : "Fiche"}
                  </span>
                  {f.niveaux.length > 0 && (
                    <span className="legende" style={{ marginLeft: "auto" }}>
                      niveaux : {f.niveaux.join(", ")}
                    </span>
                  )}
                </div>
                {f.description && <p className="legende">{f.description}</p>}
                {estAdmin && (
                  <details>
                    <summary className="legende">Modifier</summary>
                    <form action={actionEnregistrerFiliere} className="carte">
                      <input type="hidden" name="id" value={f.id} />
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
                          <input name="rang" type="number" min={0} max={999} defaultValue={d?.rang ?? 0} aria-describedby={`aide-filiere-${f.id}-rang`} />
                        </label>
                      </div>
                      <AideFiliere id={`aide-filiere-${f.id}`} fiche={idsFiche.has(f.id)} />
                      <label className="champ">
                        <span>Description</span>
                        <textarea name="description" defaultValue={f.description} maxLength={400} rows={2} />
                      </label>
                      {/* Une filière de la fiche reste au préparateur. */}
                      {!idsFiche.has(f.id) && (
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
                        <input type="checkbox" name="actif" defaultChecked={d?.actif !== false} />
                        <span>Proposée dans les listes de rattachement</span>
                      </label>
                      <div className="actions">
                        <button type="submit" className="bouton bouton--compact">Enregistrer</button>
                      </div>
                    </form>
                    {d && (
                      <form action={actionSupprimerFiliere}>
                        <input type="hidden" name="id" value={f.id} />
                        <button type="submit" className="bouton bouton--compact bouton--discret">
                          Supprimer le dépôt
                        </button>
                      </form>
                    )}
                  </details>
                )}
              </li>
            );
          }),
          ])}
        </ul>

        {estAdmin && (
          <form action={actionEnregistrerFiliere} className="carte">
            <h3 style={{ fontSize: "1rem", margin: 0 }}>Ajouter une filière</h3>
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
            <ChoixBadge nom="badge" />
            <input type="hidden" name="actif" value="1" />
            <div className="actions">
              <button type="submit" className="bouton">Ajouter la filière</button>
            </div>
          </form>
        )}
      </section>

      <section className="section">
        <div className="section-titre">
          <h2 style={{ fontSize: "1.15rem" }}>Niveaux</h2>
          <span className="compte">{niveaux.length}</span>
        </div>
        {/* L'ordre se règle ici et vaut pour tous les écrans (tâche 66). */}
        <p id="rangs-niveaux" className="legende">
          Ordre : chaque métier range ses niveaux par rang croissant, sur tous les écrans. Ceux de la
          fiche valent {rappelRangsFiche(CODES_FICHE)} : un rang de 45 place un niveau entre N2 et N3.
          Au rang 0, un niveau ajouté vient après ceux qui ont un rang.
        </p>
        <ul className="liste-nue">
          {metiers.flatMap((m) => [
            <li key={`metier-${m.id}`}>
              <h3 style={{ fontSize: "1rem", margin: ".75rem 0 0" }}>
                {m.libelle}
                {m.prefixe && <span className="legende"> — codes {m.prefixe}…</span>}
              </h3>
              {!tousNiveaux.some((n) => memeMetier(n.metier, m.id)) && (
                <p className="legende" style={{ margin: ".25rem 0 0" }}>
                  Aucun niveau pour ce métier : l&apos;ajouter ci-dessous, dans l&apos;une de ses filières.
                </p>
              )}
            </li>,
            ...tousNiveaux.filter((n) => memeMetier(n.metier, m.id)).map((n) => {
            const d = depotN.get(n.code);
            const rang = rangEffectif(n.code, d?.rang, CODES_FICHE);
            return (
              <li key={n.code} className="carte">
                <div className="etape-tete">
                  <span className="etiquette etiquette--neutre">{n.code}</span>
                  <strong>{n.libelle}</strong>
                  <span className="legende">{n.filiere}</span>
                  <span className="legende niveau-rang">{rang === null ? "sans rang" : `rang ${rang}`}</span>
                  <span className={`etiquette ${n.origine === "base" ? "etiquette--ok" : "etiquette--site"}`}>
                    {n.origine === "base" ? (d?.actif === false ? "Déposé, inactif" : "Déposé") : "Fiche"}
                  </span>
                  {n.prerequis.length > 0 && (
                    <span className="legende" style={{ marginLeft: "auto" }}>
                      prérequis : {n.prerequis.join(", ")}
                    </span>
                  )}
                </div>
                {n.condition && <p className="legende">{n.condition}</p>}
                {estAdmin && (
                  <details>
                    <summary className="legende">Modifier</summary>
                    <form action={actionEnregistrerNiveau} className="carte">
                      <input type="hidden" name="code" value={n.code} />
                      <input type="hidden" name="existant" value="1" />
                      <div className="rangee">
                        <label className="champ">
                          <span>Libellé</span>
                          <input name="libelle" defaultValue={n.libelle} maxLength={120} required />
                        </label>
                        <label className="champ">
                          <span>Filière</span>
                          {/* Les filières de son métier seulement : un niveau n'en change pas.
                              La sienne y figure même inactive, sans quoi l'enregistrement
                              le rattacherait à la première de la liste. */}
                          <select name="filiereId" defaultValue={n.filiere}>
                            {toutesFilieres.filter((f) => memeMetier(f.metier, n.metier)).map((f) => (
                              <option key={f.id} value={f.id}>
                                {`${f.libelle}${filieres.some((x) => x.id === f.id) ? "" : " (inactive)"}`}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="champ">
                          <span>Rang</span>
                          {/* Le rang effectif, et non 0 : enregistrer une correction
                              d'un niveau de la fiche ne le déplace pas. */}
                          <input name="rang" type="number" min={0} max={999} defaultValue={rang ?? 0} aria-describedby="rangs-niveaux" />
                        </label>
                      </div>
                      <label className="champ">
                        <span>Condition d&apos;obtention</span>
                        <textarea name="condition" defaultValue={n.condition} maxLength={600} rows={2} />
                      </label>
                      <fieldset className="groupe">
                        <legend className="champ-titre">Prérequis</legend>
                        <div className="cases">
                          {niveaux
                            .filter((x) => String(x.code) !== n.code)
                            .map((x) => (
                              <label key={String(x.code)}>
                                <input
                                  type="checkbox"
                                  name="prerequis"
                                  value={String(x.code)}
                                  defaultChecked={n.prerequis.includes(String(x.code))}
                                />
                                <span>{String(x.code)}</span>
                              </label>
                            ))}
                        </div>
                      </fieldset>
                      <label className="case-seule">
                        <input type="checkbox" name="actif" defaultChecked={d?.actif !== false} />
                        <span>Proposé dans les listes de rattachement</span>
                      </label>
                      <div className="actions">
                        <button type="submit" className="bouton bouton--compact">Enregistrer</button>
                      </div>
                    </form>
                    {d && (
                      <form action={actionSupprimerNiveau}>
                        <input type="hidden" name="code" value={n.code} />
                        <button type="submit" className="bouton bouton--compact bouton--discret">
                          Supprimer le dépôt
                        </button>
                      </form>
                    )}
                  </details>
                )}
              </li>
            );
          }),
          ])}
        </ul>

        {estAdmin && (
          <form action={actionEnregistrerNiveau} className="carte">
            <h3 style={{ fontSize: "1rem", margin: 0 }}>Ajouter un niveau</h3>
            <div className="rangee">
              <label className="champ">
                <span>Code</span>
                <input name="code" maxLength={12} required placeholder="S1" aria-describedby="rappel-prefixes" />
              </label>
              <label className="champ">
                <span>Libellé</span>
                <input name="libelle" maxLength={120} required placeholder="S1 — stérilisation (base)" />
              </label>
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
              <label className="champ">
                <span>Rang</span>
                <input name="rang" type="number" min={0} max={999} defaultValue={0} aria-describedby="rangs-niveaux" />
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
                {niveaux.map((x) => (
                  <label key={String(x.code)}>
                    <input type="checkbox" name="prerequis" value={String(x.code)} />
                    <span>{String(x.code)}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <input type="hidden" name="actif" value="1" />
            <div className="actions">
              <button type="submit" className="bouton">Ajouter le niveau</button>
            </div>
          </form>
        )}
      </section>
    </>
  );
}
