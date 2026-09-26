import Link from "next/link";
import { getSession } from "@/lib/auth";
import { getReferentiel, listerNiveauxDeposes, niveauxOrphelins, toutesLesFilieres } from "@/content/referentiel-db";
import { metiers, metierOuDefaut, niveaux as niveauxFiche } from "@/content/habilitation";
import { rangEffectif, rappelRangsFiche } from "@/content/ordre-niveaux";
import { actionEnregistrerNiveau, actionSupprimerNiveau } from "../referentiel/actions";
import { FormulaireNouveauNiveau } from "../referentiel/formulaires";
import { ERREURS, MESSAGES } from "../referentiel/messages";

export const dynamic = "force-dynamic";

/** Codes des niveaux de la fiche : leur place fixe le rang par défaut (10, 20…). */
const CODES_FICHE = niveauxFiche.map((n) => String(n.code));

/**
 * Niveaux d'habilitation (question 81, choix a, 26/09/2026) : la moitié
 * « niveaux » de l'ancien Référentiel, dans le sous-menu Squelette. La fiche
 * reste la référence ; un dépôt la corrige ou l'étend (question 38, choix b).
 */
export default async function Niveaux({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; erreur?: string }>;
}) {
  const p = await searchParams;
  const session = (await getSession())!;
  const estAdmin = session.role === "admin";
  const [{ filieres, niveaux }, liste, deposesN, orphelins] = await Promise.all([
    getReferentiel(),
    toutesLesFilieres(),
    listerNiveauxDeposes(true),
    niveauxOrphelins().catch(() => []),
  ]);
  const depotN = new Map(deposesN.map((n) => [n.code, n]));
  // Un niveau déposé puis désactivé ne figure plus dans le référentiel servi :
  // on l'affiche ici quand même, pour pouvoir le rouvrir.
  const inactifsN = deposesN.filter((n) => !n.actif && !niveaux.some((x) => String(x.code) === n.code));
  const toutesFilieres = liste.map((x) => x.filiere);
  const metierDeFiliere = new Map(toutesFilieres.map((f) => [f.id, f.metier]));
  const libelleFiliere = new Map(toutesFilieres.map((f) => [f.id, f.libelle]));
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
        <p className="legende" style={{ margin: 0 }}>Squelette de la formation</p>
        <h1>Niveaux</h1>
        <p>
          Les niveaux d&apos;habilitation, rangés par métier. La fiche d&apos;habilitation livrée avec le site
          reste la référence : un niveau déposé la <strong>corrige</strong> quand son code existe déjà, et
          l&apos;<strong>étend</strong> sinon. Les rapports déjà émis portent leur propre copie des libellés :
          les modifier ici ne les réécrit pas. Un niveau se rattache à une <Link href="/admin/filieres">filière</Link>.
        </p>
      </section>

      {p.ok && MESSAGES[p.ok] && <p className="encart encart--ok">{MESSAGES[p.ok]}</p>}
      {p.erreur && ERREURS[p.erreur] && (
        <p className="encart encart--attention" role="alert">{ERREURS[p.erreur]}</p>
      )}
      {!estAdmin && (
        <p className="encart encart--attention">
          Consultation seule : les niveaux se modifient avec un code d&apos;administration.
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
            — cocher le nouveau niveau à la place, régler son plafond dans{" "}
            <Link href="/admin/niveaux-questions">Niveaux des questions</Link> puis l&apos;enregistrer,
            remplacer un code d&apos;accès par un code du nouveau niveau et révoquer l&apos;ancien — ou se
            laisse telle quelle. L&apos;échelle du préparateur a aussi été corrigée le 22/09/2026 :{" "}
            <code>P1</code> et <code>P2</code> ont laissé place à <code>N1b</code>.
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
                  <Link href={`/admin/filieres/${encodeURIComponent(n.filiere)}`} className="legende">
                    {libelleFiliere.get(n.filiere) ?? n.filiere}
                  </Link>
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
          <FormulaireNouveauNiveau
            filieres={filieres}
            prerequis={niveaux.map((x) => String(x.code))}
            idRangs="rangs-niveaux"
          />
        )}
      </section>
    </>
  );
}
