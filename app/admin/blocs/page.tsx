import Link from "next/link";
import { sessionRequise } from "@/lib/auth";
import { criteres, getCritere } from "@/content/habilitation";
import { modulesDeposesParBloc, tousLesBlocs } from "@/content/blocs-db";
import { numeroSuivant } from "@/content/blocs";
import { STATUTS_MODULE, type StatutModule } from "@/content/modules-db";
import { toutesLesFilieres } from "@/content/referentiel-db";
import { LienModule } from "@/components/LienModule";
import { actionEnregistrerBloc, actionSupprimerBloc } from "./actions";

export const dynamic = "force-dynamic";

const MESSAGES: Record<string, string> = {
  bloc: "Bloc enregistré.",
  "bloc-supprime": "Dépôt du bloc supprimé.",
};

const ERREURS: Record<string, string> = {
  numero: "Le numéro d'un bloc va de 1 à 99.",
  titre: "Le titre est obligatoire.",
  "numero-pris": "Ce numéro existe déjà : modifiez ce bloc plutôt que d'en ajouter un.",
  "bloc-occupe":
    "Ce bloc porte encore des modules déposés : rangez-les d'abord dans un autre bloc (formulaire du module), puis recommencez.",
};

/** Module d'un critère de la fiche : rédigé, ou emplacement à rédiger. */
const moduleDuCritere = (id: string) => getCritere(id)?.moduleId ?? `critere-${id.toLowerCase()}`;

/**
 * Blocs de compétence et leurs critères (question 81, choix a, 26/09/2026).
 * Un bloc se corrige ou s'ajoute, comme une filière ; les critères de la
 * fiche s'y lisent, versionnés avec le site, sans se modifier ici — un
 * module hors fiche se range dans un bloc depuis son formulaire.
 */
export default async function Blocs({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; erreur?: string }>;
}) {
  await sessionRequise("admin");
  const p = await searchParams;
  const [blocs, deposes, filieres] = await Promise.all([tousLesBlocs(), modulesDeposesParBloc(), toutesLesFilieres()]);
  const libelleFiliere = new Map(filieres.map((x) => [x.filiere.id, x.filiere.libelle]));
  const optionsFiliere = (
    <>
      {filieres.map((x) => (
        <option key={x.filiere.id} value={x.filiere.id}>
          {x.filiere.libelle}
        </option>
      ))}
    </>
  );

  return (
    <>
      <section className="panneau-titre">
        <p className="legende" style={{ margin: 0 }}>Squelette de la formation</p>
        <h1>Blocs et critères</h1>
        <p>
          Les blocs de compétence de la fiche d&apos;habilitation et leurs critères. Un bloc déposé{" "}
          <strong>corrige</strong> un bloc de la fiche — titre, référence, filière — ou en{" "}
          <strong>ajoute</strong> un, qui reçoit des modules hors fiche. Les critères, versionnés avec le site,
          se lisent ici sans s&apos;y modifier ; leur rattachement se règle dans{" "}
          <Link href="/admin/rattachement">Rattachement des modules</Link>.
        </p>
      </section>

      {p.ok && MESSAGES[p.ok] && <p className="encart encart--ok">{MESSAGES[p.ok]}</p>}
      {p.erreur && ERREURS[p.erreur] && (
        <p className="encart encart--attention" role="alert">{ERREURS[p.erreur]}</p>
      )}

      <section className="section">
        <div className="section-titre">
          <h2 style={{ fontSize: "1.15rem" }}>Blocs</h2>
          <span className="compte">{blocs.filter((b) => b.actif).length}</span>
        </div>
        <p id="aide-filiere-bloc" className="legende">
          Filière du bloc : pour mémoire, comme les blocs d&apos;une filière. Le programme d&apos;une filière vient
          des modules qui la cochent, pas de ses blocs.
        </p>
        <ul className="liste-nue">
          {blocs.map((b) => {
            const siens = criteres.filter((c) => c.bloc === b.numero);
            const horsFiche = deposes[b.numero] ?? [];
            return (
              <li key={b.numero} id={`bloc-${b.numero}`} className="carte">
                <div className="etape-tete">
                  <span className="etiquette etiquette--neutre">Bloc {b.numero}</span>
                  <strong>{b.titre}</strong>
                  <span className={`etiquette ${b.origine === "base" ? "etiquette--ok" : "etiquette--site"}`}>
                    {b.fiche ? (b.origine === "base" ? "Fiche, corrigée" : "Fiche") : b.actif ? "Déposé" : "Déposé, inactif"}
                  </span>
                </div>
                <p className="legende">
                  {b.reference ? `${b.reference} · ` : ""}filière : {libelleFiliere.get(b.filiere) ?? b.filiere}
                </p>
                <details>
                  <summary className="legende">
                    {siens.length} critère{siens.length > 1 ? "s" : ""} de la fiche
                    {horsFiche.length > 0 ? `, ${horsFiche.length} module${horsFiche.length > 1 ? "s" : ""} hors fiche` : ""}
                  </summary>
                  <ul className="liste-programme">
                    {siens.map((c) => (
                      <li key={c.id} className="ligne-programme">
                        <span className="code">
                          <LienModule id={moduleDuCritere(c.id)}>{c.id}</LienModule>
                        </span>
                        <span className="ligne-programme-choix">{c.libelle}</span>
                        <span className="legende">
                          {c.niveau}
                          {c.obligatoire ? " · obligatoire" : ""}
                        </span>
                      </li>
                    ))}
                    {horsFiche.map((m) => (
                      <li key={m.id} className="ligne-programme">
                        <span className="code">
                          <Link href={`/admin/modules/${encodeURIComponent(m.id)}`}>—</Link>
                        </span>
                        <span className="ligne-programme-choix">{m.titre}</span>
                        <span className="legende">
                          module hors fiche · {STATUTS_MODULE[m.statut as StatutModule]?.toLowerCase() ?? m.statut}
                        </span>
                      </li>
                    ))}
                  </ul>
                </details>
                <details>
                  <summary className="legende">Modifier</summary>
                  <form action={actionEnregistrerBloc} className="carte">
                    <input type="hidden" name="numero" value={b.numero} />
                    <input type="hidden" name="existant" value="1" />
                    <div className="rangee">
                      <label className="champ">
                        <span>Titre</span>
                        <input name="titre" defaultValue={b.titre} maxLength={200} required />
                      </label>
                      <label className="champ">
                        <span>Filière</span>
                        <select name="filiere" defaultValue={b.filiere} aria-describedby="aide-filiere-bloc">
                          {optionsFiliere}
                        </select>
                      </label>
                    </div>
                    <label className="champ">
                      <span>Référence (ancrage réglementaire)</span>
                      <textarea name="reference" defaultValue={b.reference} maxLength={400} rows={2} />
                    </label>
                    {b.fiche ? (
                      <p className="legende">Un bloc de la fiche reste proposé : ses critères en dépendent.</p>
                    ) : (
                      <label className="case-seule">
                        <input type="checkbox" name="actif" defaultChecked={b.actif} />
                        <span>Proposé dans les listes</span>
                      </label>
                    )}
                    <div className="actions">
                      <button type="submit" className="bouton bouton--compact">Enregistrer</button>
                    </div>
                  </form>
                  {b.origine === "base" && (
                    <form action={actionSupprimerBloc}>
                      <input type="hidden" name="numero" value={b.numero} />
                      <button type="submit" className="bouton bouton--compact bouton--discret">
                        Supprimer le dépôt
                      </button>
                    </form>
                  )}
                </details>
              </li>
            );
          })}
        </ul>

        <form action={actionEnregistrerBloc} className="carte">
          <h3 style={{ fontSize: "1rem", margin: 0 }}>Ajouter un bloc</h3>
          <div className="rangee">
            <label className="champ champ--rang">
              <span>Numéro</span>
              <input name="numero" type="number" min={1} max={99} defaultValue={numeroSuivant(blocs)} required />
            </label>
            <label className="champ">
              <span>Titre</span>
              <input name="titre" maxLength={200} required placeholder="Stérilisation des dispositifs médicaux" />
            </label>
            <label className="champ">
              <span>Filière</span>
              <select name="filiere" defaultValue="socle" aria-describedby="aide-filiere-bloc">
                {optionsFiliere}
              </select>
            </label>
          </div>
          <label className="champ">
            <span>Référence (ancrage réglementaire)</span>
            <textarea name="reference" maxLength={400} rows={2} />
          </label>
          <input type="hidden" name="actif" value="1" />
          <div className="actions">
            <button type="submit" className="bouton">Ajouter le bloc</button>
          </div>
        </form>
      </section>
    </>
  );
}
