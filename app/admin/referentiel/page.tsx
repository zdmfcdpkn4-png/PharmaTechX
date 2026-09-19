import { getSession } from "@/lib/auth";
import { getReferentiel, listerFilieresDeposees, listerNiveauxDeposes } from "@/content/referentiel-db";
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
};

export default async function Referentiel({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; erreur?: string }>;
}) {
  const p = await searchParams;
  const session = (await getSession())!;
  const estAdmin = session.role === "admin";
  const [{ filieres, niveaux }, deposeesF, deposesN] = await Promise.all([
    getReferentiel(),
    listerFilieresDeposees(true),
    listerNiveauxDeposes(true),
  ]);
  const depotF = new Map(deposeesF.map((f) => [f.id, f]));
  const depotN = new Map(deposesN.map((n) => [n.code, n]));
  // Une filière ou un niveau déposé puis désactivé ne figure plus dans le
  // référentiel servi : on l'affiche ici quand même, pour pouvoir le rouvrir.
  const inactivesF = deposeesF.filter((f) => !f.actif && !filieres.some((x) => x.id === f.id));
  const inactifsN = deposesN.filter((n) => !n.actif && !niveaux.some((x) => String(x.code) === n.code));

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

      <section className="section">
        <div className="section-titre">
          <h2 style={{ fontSize: "1.15rem" }}>Filières</h2>
          <span className="compte">{filieres.length}</span>
        </div>
        <ul className="liste-nue">
          {[...filieres, ...inactivesF.map((f) => ({
            id: f.id, libelle: f.libelle, description: f.description, blocs: f.blocs,
            niveaux: [] as string[], badge: f.badge, origine: "base" as const,
          }))].map((f) => {
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
                          <input name="blocs" defaultValue={f.blocs.join(", ")} placeholder="1, 3, 5" />
                        </label>
                        <label className="champ">
                          <span>Rang</span>
                          <input name="rang" type="number" min={0} max={999} defaultValue={d?.rang ?? 0} />
                        </label>
                      </div>
                      <label className="champ">
                        <span>Description</span>
                        <textarea name="description" defaultValue={f.description} maxLength={400} rows={2} />
                      </label>
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
          })}
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
                <span>Blocs</span>
                <input name="blocs" placeholder="1, 3" />
              </label>
              <label className="champ">
                <span>Rang</span>
                <input name="rang" type="number" min={0} max={999} defaultValue={0} />
              </label>
            </div>
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
        <ul className="liste-nue">
          {[...niveaux.map((n) => ({
            code: String(n.code), libelle: n.libelle, filiere: n.filiere,
            condition: n.condition, prerequis: n.prerequis.map(String), origine: n.origine ?? "code",
          })), ...inactifsN.map((n) => ({
            code: n.code, libelle: n.libelle, filiere: n.filiereId,
            condition: n.condition, prerequis: n.prerequis, origine: "base" as const,
          }))].map((n) => {
            const d = depotN.get(n.code);
            return (
              <li key={n.code} className="carte">
                <div className="etape-tete">
                  <span className="etiquette etiquette--neutre">{n.code}</span>
                  <strong>{n.libelle}</strong>
                  <span className="legende">{n.filiere}</span>
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
                      <div className="rangee">
                        <label className="champ">
                          <span>Libellé</span>
                          <input name="libelle" defaultValue={n.libelle} maxLength={120} required />
                        </label>
                        <label className="champ">
                          <span>Filière</span>
                          <select name="filiereId" defaultValue={n.filiere}>
                            {filieres.map((f) => (
                              <option key={f.id} value={f.id}>{f.libelle}</option>
                            ))}
                          </select>
                        </label>
                        <label className="champ">
                          <span>Rang</span>
                          <input name="rang" type="number" min={0} max={999} defaultValue={d?.rang ?? 0} />
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
          })}
        </ul>

        {estAdmin && (
          <form action={actionEnregistrerNiveau} className="carte">
            <h3 style={{ fontSize: "1rem", margin: 0 }}>Ajouter un niveau</h3>
            <div className="rangee">
              <label className="champ">
                <span>Code</span>
                <input name="code" maxLength={12} required placeholder="S1" />
              </label>
              <label className="champ">
                <span>Libellé</span>
                <input name="libelle" maxLength={120} required placeholder="S1 — stérilisation (base)" />
              </label>
              <label className="champ">
                <span>Filière</span>
                <select name="filiereId" defaultValue={filieres[0]?.id}>
                  {filieres.map((f) => (
                    <option key={f.id} value={f.id}>{f.libelle}</option>
                  ))}
                </select>
              </label>
              <label className="champ">
                <span>Rang</span>
                <input name="rang" type="number" min={0} max={999} defaultValue={0} />
              </label>
            </div>
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
