import Link from "next/link";
import { listerDepots } from "@/lib/db";
import { LIBELLES_STATUT_FICHE } from "@/content/fiches";
import { stockageConfigure, TAILLE_MAX_FICHIER } from "@/lib/stockage";
import { getTousModulesAvecDeposes } from "@/content/store";
import { getReferentiel } from "@/content/referentiel-db";
import { NATURES_DOCUMENT, libelleNature } from "@/content/types";
import { actionDeposer, actionSupprimerDepot } from "@/app/actions";
import { etiquetteModule, moduleOuvrable, titreModule } from "../questions/commun";
import { LienModule } from "@/components/LienModule";
import { BarreFiltres } from "@/components/BarreFiltres";
import { DOCUMENTS_GENERAUX, documentRetenu, lireFiltreDocuments } from "@/content/filtres-listes";

export const dynamic = "force-dynamic";

const MESSAGES: Record<string, string> = {
  "fichier-manquant": "Aucun fichier sélectionné.",
  "fichier-trop-lourd": `Fichier trop lourd : ${Math.round(TAILLE_MAX_FICHIER / 1024 / 1024)} Mo au plus.`,
  "type-refuse": "Type de fichier refusé : PDF, PNG, JPEG, MP4, WebM, texte, Word, PowerPoint ou Excel.",
  "stockage-absent": "Aucun stockage de fichiers n'est disponible.",
  "module-inconnu": "Module de rattachement inconnu.",
  "fiche-sans-module":
    "Une fiche de synthèse se rattache à un module : elle se montre en fin de test de ce module, et se valide depuis sa banque.",
};

export default async function Documents({
  searchParams,
}: {
  /**
   * `module` : celui d'un module (bouton « Documents » de l'écran Modules) préremplit le dépôt et filtre la
   * liste ; `general`, les documents généraux. Question 91 (lot 3) : recherche, nature, filière, niveau.
   */
  searchParams: Promise<{ erreur?: string; ok?: string; module?: string; [cle: string]: string | string[] | undefined }>;
}) {
  const p = await searchParams;
  const { filieres, niveaux } = await getReferentiel();
  const [depots, modules] = await Promise.all([listerDepots(), getTousModulesAvecDeposes()]);
  const moduleInitial = modules.some((m) => m.id === p.module) ? p.module : "";
  // Filtres de la liste (question 91, choix a, lot 3).
  const filieresPostes = filieres.filter((f) => f.id !== "socle");
  const filtre = lireFiltreDocuments(p, {
    natures: Object.keys(NATURES_DOCUMENT),
    modules: modules.map((m) => m.id),
    filieres: filieresPostes.map((f) => f.id),
    niveaux: niveaux.map((n) => String(n.code)),
  });
  const parId = new Map(modules.map((m) => [m.id, m]));
  // Le profil d'un document rattaché est celui de son module ; le socle seul y vaut tronc commun.
  const profilDuModule = (id: string) => {
    const m = parId.get(id);
    return m ? { postes: m.postes.filter((f) => f !== "socle"), niveaux: m.niveaux } : undefined;
  };
  const retenus = depots.filter((d) => documentRetenu(d, filtre, profilDuModule));

  return (
    <>
      <section className="panneau-titre">
        <h1>Documents rattachés</h1>
        <p>
          Les documents d&apos;un module, ou généraux, proposés aux profils cochés. Une <strong>fiche de synthèse</strong>{" "}
          s&apos;affiche en fin de test, une fois validée dans la banque du module.
        </p>
      </section>

      {p.ok === "depose" && <p className="encart encart--ok">Document déposé.</p>}
      {p.ok === "fiche-a-verifier" && (
        <p className="encart encart--ok">
          Fiche de synthèse déposée, à vérifier : elle n&apos;est montrée qu&apos;une fois validée, depuis la banque du module,
          par un autre code que le vôtre — ou le vôtre, tracé, s&apos;il est d&apos;administration.
        </p>
      )}
      {p.erreur && MESSAGES[p.erreur] && <p className="encart encart--attention">{MESSAGES[p.erreur]}</p>}
      {!stockageConfigure() && (
        <p className="encart encart--attention">
          Aucun stockage branché : renseignez <code>DATABASE_URL</code> (les fichiers sont alors
          conservés en base) ou <code>BLOB_READ_WRITE_TOKEN</code> (Vercel Blob).
        </p>
      )}

      <section className="carte">
        <form action={actionDeposer}>
          <div className="rangee">
            <label className="champ">
              <span>Fichier</span>
              <input type="file" name="fichier" required />
            </label>
            <label className="champ">
              <span>Titre</span>
              <input type="text" name="titre" placeholder="PHAR-FT160 — …" />
            </label>
          </div>
          <div className="rangee">
            <label className="champ">
              <span>Nature</span>
              <select name="nature" defaultValue="procedure-interne">
                {(Object.keys(NATURES_DOCUMENT) as (keyof typeof NATURES_DOCUMENT)[]).map((n) => (
                  <option key={n} value={n}>
                    {NATURES_DOCUMENT[n]}
                    {n === "synthese" ? " — à valider, puis affichée en fin de test" : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="champ">
              <span>Rattacher au module</span>
              <select name="moduleId" defaultValue={moduleInitial}>
                <option value="">Document général (proposé par profil)</option>
                {modules.map((m) => (
                  <option key={m.id} value={m.id}>
                    {etiquetteModule(m)} — {m.titre.slice(0, 60)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <fieldset className="groupe">
            <legend className="champ-titre">Profils d&apos;un document général — filières (aucune cochée : toutes)</legend>
            <div className="cases">
              {filieres
                .filter((f) => f.id !== "socle")
                .map((f) => (
                  <label key={f.id}>
                    <input type="checkbox" name="filieres" value={f.id} />
                    {f.libelle}
                  </label>
                ))}
            </div>
            <legend className="champ-titre" style={{ marginTop: ".25rem" }}>Niveaux (aucun coché : tous)</legend>
            <div className="cases">
              {niveaux.map((n) => (
                <label key={n.code}>
                  <input type="checkbox" name="niveaux" value={n.code} />
                  {n.code}
                </label>
              ))}
            </div>
            {/* Venu de l'introduction (question 91), sous les cases qu'il concerne. */}
            <p className="legende" style={{ margin: 0 }}>
              Un document général apparaît sur le programme des profils cochés.
            </p>
          </fieldset>
          <div className="actions">
            <button type="submit" className="bouton" disabled={!stockageConfigure()}>
              Déposer
            </button>
          </div>
        </form>
      </section>

      <div className="section-titre">
        <h2>Documents déposés</h2>
        <span className="compte">{depots.length} document(s)</span>
      </div>
      {depots.length > 0 && (
        <BarreFiltres
          adresse="/admin/documents"
          recherche={{ valeur: filtre.q, placeholder: "Rechercher un titre" }}
          champs={[
            {
              nom: "nature",
              libelle: "Nature",
              options: (Object.keys(NATURES_DOCUMENT) as (keyof typeof NATURES_DOCUMENT)[]).map((n) => ({
                valeur: n,
                libelle: NATURES_DOCUMENT[n],
              })),
              valeur: filtre.nature,
              minuscule: true,
            },
            {
              nom: "module",
              libelle: "Rattachement",
              options: [
                { valeur: DOCUMENTS_GENERAUX, libelle: "Documents généraux (proposés par profil)", puce: "documents généraux" },
                ...modules.map((m) => ({ valeur: m.id, libelle: `${etiquetteModule(m)} — ${m.titre.slice(0, 60)}`, puce: m.titre.slice(0, 60) })),
              ],
              valeur: filtre.module,
              large: true,
            },
          ]}
          plus={[
            {
              nom: "filiere",
              libelle: "Filière",
              tous: "Toutes",
              options: filieresPostes.map((f) => ({ valeur: f.id, libelle: f.libelle })),
              valeur: filtre.filiere,
            },
            {
              nom: "niveau",
              libelle: "Niveau",
              options: niveaux.map((n) => ({ valeur: String(n.code), libelle: n.libelle })),
              valeur: filtre.niveau,
            },
          ]}
          retenus={retenus.length}
          total={depots.length}
          unite={["document", "documents"]}
        />
      )}
      <ul className="liste-nue">
        {retenus.map((d) => (
          <li key={d.id} className="carte">
            <span className="etiquette etiquette--neutre">{libelleNature(d.nature)}</span>{" "}
            {d.nature === "synthese" && (
              <>
                <span className={`etiquette ${d.statut === "valide" ? "etiquette--ok" : d.statut === "retire" ? "etiquette--neutre" : "etiquette--attention"}`}>
                  {LIBELLES_STATUT_FICHE[d.statut]}
                </span>{" "}
              </>
            )}
            <a href={d.url} target="_blank" rel="noreferrer">
              {d.titre}
            </a>
            <br />
            <span className="legende">
              {d.module_id ? (
                <LienModule id={moduleOuvrable(modules, d.module_id)}>{titreModule(modules, d.module_id)}</LienModule>
              ) : (
                "document général"
              )}
              {d.filieres.length > 0 || d.niveaux.length > 0
                ? ` · profils : ${[...d.filieres, ...d.niveaux].join(", ")}`
                : d.module_id
                  ? ""
                  : " · tous profils"}
              {" · "}déposé le {new Date(d.depose_le).toLocaleDateString("fr-FR")} par {d.depose_par}
              {d.nature === "synthese" && d.module_id && (
                <>
                  {" · "}
                  <Link href={`/admin/questions?module=${encodeURIComponent(d.module_id)}#fiches`}>
                    {d.statut === "a_verifier" ? "à valider dans la banque du module" : "voir dans la banque du module"}
                  </Link>
                </>
              )}
            </span>
            <div className="actions" style={{ marginTop: ".5rem" }}>
              <form action={actionSupprimerDepot}>
                <input type="hidden" name="id" value={d.id} />
                <button type="submit" className="bouton bouton--compact bouton--secondaire">
                  Supprimer
                </button>
              </form>
            </div>
          </li>
        ))}
        {depots.length === 0 && <li className="legende">Aucun document déposé.</li>}
        {depots.length > 0 && retenus.length === 0 && <li className="legende">Aucun document ne correspond à ces filtres.</li>}
      </ul>
    </>
  );
}
