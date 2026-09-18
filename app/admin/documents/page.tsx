import { listerDepots } from "@/lib/db";
import { modeStockage, stockageConfigure, TAILLE_MAX_FICHIER } from "@/lib/stockage";
import { getTousModulesAvecDeposes } from "@/content/store";
import { filieres, niveaux } from "@/content/habilitation";
import { NATURES_DOCUMENT, libelleNature } from "@/content/types";
import { actionDeposer, actionSupprimerDepot } from "@/app/actions";
import { etiquetteModule, titreModule } from "../questions/commun";

export const dynamic = "force-dynamic";

const MESSAGES: Record<string, string> = {
  "fichier-manquant": "Aucun fichier sélectionné.",
  "fichier-trop-lourd": `Fichier trop lourd : ${Math.round(TAILLE_MAX_FICHIER / 1024 / 1024)} Mo au plus.`,
  "type-refuse": "Type de fichier refusé : PDF, PNG, JPEG, MP4, WebM, texte, Word, PowerPoint ou Excel.",
  "stockage-absent": "Aucun stockage de fichiers n'est disponible.",
  "module-inconnu": "Module de rattachement inconnu.",
};

export default async function Documents({
  searchParams,
}: {
  searchParams: Promise<{ erreur?: string; ok?: string; module?: string }>;
}) {
  const p = await searchParams;
  const [depots, modules] = await Promise.all([listerDepots(), getTousModulesAvecDeposes()]);
  const mode = modeStockage();
  const moduleInitial = modules.some((m) => m.id === p.module) ? p.module : "";

  return (
    <>
      <section className="panneau-titre">
        <h1>Documents rattachés</h1>
        <p>
          Procédures internes, fiches réflexes, référentiels, vidéos et fiches de synthèse,
          rattachés à un module (du code ou déposé) ou généraux. Une <strong>fiche de synthèse</strong>{" "}
          rattachée à un module s&apos;affiche en fin de test, après la correction (PDF et images en
          ligne). Un document général se propose à tous les profils, ou aux filières et niveaux
          cochés : il apparaît alors sur le programme de ces profils. Stockage :{" "}
          {mode === "blob" ? "Vercel Blob" : mode === "base" ? "base de données (portable, sans service supplémentaire)" : "aucun"}.
        </p>
      </section>

      {p.ok === "depose" && <p className="encart encart--ok">Document déposé.</p>}
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
                    {n === "synthese" ? " — affichée en fin de test" : ""}
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
      <ul className="liste-nue">
        {depots.map((d) => (
          <li key={d.id} className="carte">
            <span className="etiquette etiquette--neutre">{libelleNature(d.nature)}</span>{" "}
            <a href={d.url} target="_blank" rel="noreferrer">
              {d.titre}
            </a>
            <br />
            <span className="legende">
              {d.module_id ? titreModule(modules, d.module_id) : "document général"}
              {d.filieres.length > 0 || d.niveaux.length > 0
                ? ` · profils : ${[...d.filieres, ...d.niveaux].join(", ")}`
                : d.module_id
                  ? ""
                  : " · tous profils"}
              {" · "}déposé le {new Date(d.depose_le).toLocaleDateString("fr-FR")} par {d.depose_par}
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
      </ul>
    </>
  );
}
