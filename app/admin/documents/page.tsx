import { listerDepots } from "@/lib/db";
import { modeStockage, stockageConfigure, TAILLE_MAX_FICHIER } from "@/lib/stockage";
import { getTousModules } from "@/content/store";
import { actionDeposer, actionSupprimerDepot } from "@/app/actions";

export const dynamic = "force-dynamic";

const MESSAGES: Record<string, string> = {
  "fichier-manquant": "Aucun fichier sélectionné.",
  "fichier-trop-lourd": `Fichier trop lourd : ${Math.round(TAILLE_MAX_FICHIER / 1024 / 1024)} Mo au plus.`,
  "type-refuse": "Type de fichier refusé : PDF, PNG, JPEG, MP4, WebM, texte, Word, PowerPoint ou Excel.",
  "stockage-absent": "Aucun stockage de fichiers n'est disponible.",
};

export default async function Documents({
  searchParams,
}: {
  searchParams: Promise<{ erreur?: string; ok?: string }>;
}) {
  const p = await searchParams;
  const depots = await listerDepots();
  const modules = getTousModules();
  const mode = modeStockage();

  return (
    <>
      <section className="panneau-titre">
        <h1>Documents rattachés</h1>
        <p>
          Procédures internes, fiches réflexes, référentiels et vidéos, rattachés à un module ou
          généraux. Stockage : {mode === "blob" ? "Vercel Blob" : mode === "base" ? "base de données (portable, sans service supplémentaire)" : "aucun"}.
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
                <option value="procedure-interne">Procédure interne</option>
                <option value="fiche-reflexe">Fiche réflexe</option>
                <option value="reglementaire">Référentiel</option>
                <option value="video">Vidéo</option>
              </select>
            </label>
            <label className="champ">
              <span>Rattacher au module</span>
              <select name="moduleId" defaultValue="">
                <option value="">Document général</option>
                {modules.map((m) => (
                  <option key={m.id} value={m.id}>
                    {typeof m.critereId === "string" ? m.critereId : "—"} — {m.titre.slice(0, 60)}
                  </option>
                ))}
              </select>
            </label>
          </div>
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
            <span className="etiquette etiquette--neutre">{d.nature}</span>{" "}
            <a href={d.url} target="_blank" rel="noreferrer">
              {d.titre}
            </a>
            <br />
            <span className="legende">
              {d.module_id ?? "document général"} · déposé le{" "}
              {new Date(d.depose_le).toLocaleDateString("fr-FR")} par {d.depose_par}
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
