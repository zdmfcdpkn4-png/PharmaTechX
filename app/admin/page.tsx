import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession, peutGererRole } from "@/lib/auth";
import {
  baseConfiguree,
  blobConfigure,
  initSchema,
  listerAcces,
  listerDepots,
} from "@/lib/db";
import { filieres, niveaux } from "@/content/habilitation";
import { getTousModules } from "@/content/store";
import {
  actionBasculerCode,
  actionCreerCode,
  actionDeposer,
  actionOrdonner,
  actionSupprimerCode,
  actionSupprimerDepot,
} from "@/app/actions";

export const dynamic = "force-dynamic";

const MESSAGES: Record<string, string> = {
  "role-interdit": "Votre rôle ne permet pas de créer ce type de code.",
  "libelle-manquant": "Le libellé du profil est obligatoire.",
  "fichier-manquant": "Aucun fichier sélectionné.",
  "blob-absent":
    "Le store Blob n'est pas branché : impossible de déposer un document.",
};

export default async function Admin({
  searchParams,
}: {
  searchParams: Promise<{
    amorce?: string;
    nouveau?: string;
    libelle?: string;
    erreur?: string;
  }>;
}) {
  const p = await searchParams;

  if (!baseConfiguree()) {
    return (
      <article>
        <section className="panneau-titre">
          <h1>Administration</h1>
          <p>Base de données non branchée.</p>
        </section>
        <p className="encart encart--attention">
          Créez un store <strong>Postgres</strong> et un store{" "}
          <strong>Blob</strong> dans l&apos;onglet <em>Storage</em> du projet
          Vercel, connectez-les au projet, puis redéployez. Les variables
          d&apos;environnement se branchent automatiquement.
        </p>
        <Link href="/" className="bouton bouton--secondaire">
          Retour au programme
        </Link>
      </article>
    );
  }

  const session = await getSession();
  if (!session || session.role === "poste") redirect("/connexion");

  await initSchema();
  const [acces, depots] = await Promise.all([listerAcces(), listerDepots()]);
  const modules = getTousModules();
  const estAdmin = session.role === "admin";

  return (
    <article>
      <p className="fil">
        <Link href="/">Programme</Link> › Administration
      </p>

      <section className="panneau-titre">
        <h1>Administration</h1>
        <p>
          Connecté comme <strong>{session.libelle}</strong> — rôle{" "}
          {session.role}.
          {!estAdmin &&
            " Les codes administrateur et tuteur ne vous sont pas accessibles."}
        </p>
      </section>

      {p.amorce && (
        <p className="encart encart--ok">
          <strong>Code administrateur initial : </strong>
          <code style={{ fontSize: "1.15rem" }}>{p.amorce}</code>
          <br />
          Notez-le maintenant : il n&apos;est affiché qu&apos;une fois et la
          base ne permet pas de le relire. Créez ensuite vos propres codes et
          révoquez celui-ci.
        </p>
      )}

      {p.nouveau && (
        <p className="encart encart--ok">
          <strong>Code créé pour « {p.libelle} » : </strong>
          <code style={{ fontSize: "1.15rem" }}>{p.nouveau}</code>
          <br />
          Transmettez-le à l&apos;intéressé maintenant : il n&apos;est affiché
          qu&apos;une fois.
        </p>
      )}

      {p.erreur && MESSAGES[p.erreur] && (
        <p className="encart encart--attention">{MESSAGES[p.erreur]}</p>
      )}

      {/* ─────────────────────────────────────────────── codes d'accès */}
      <div className="section-titre">
        <h2>Codes d&apos;accès</h2>
        <span className="compte">{acces.length} code(s)</span>
      </div>

      <section className="carte">
        <h3>Créer un code</h3>
        <form action={actionCreerCode}>
          <div className="rangee">
            <label className="champ">
              <span>Rôle</span>
              <select name="role" defaultValue="poste">
                <option value="poste">Poste — suivre son programme</option>
                {peutGererRole(session.role, "tuteur") && (
                  <option value="tuteur">
                    Tuteur — dépôts, ordonnancement, codes de poste
                  </option>
                )}
                {peutGererRole(session.role, "admin") && (
                  <option value="admin">Admin — gestion complète</option>
                )}
              </select>
            </label>
            <label className="champ">
              <span>Libellé du profil</span>
              <input
                type="text"
                name="libelle"
                placeholder="Poste isolateur A, Préparatoire, Tuteur chimio…"
                required
              />
            </label>
          </div>
          <div className="rangee">
            <label className="champ">
              <span>Filière (profils de poste)</span>
              <select name="filiere" defaultValue="">
                <option value="">Toutes</option>
                {filieres.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.libelle}
                  </option>
                ))}
              </select>
            </label>
            <label className="champ">
              <span>Niveau visé</span>
              <select name="niveau" defaultValue="">
                <option value="">Tous</option>
                {niveaux.map((n) => (
                  <option key={n.code} value={n.code}>
                    {n.libelle}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="actions">
            <button type="submit" className="bouton">
              Générer le code
            </button>
          </div>
        </form>
      </section>

      <ul className="liste-nue" style={{ marginTop: "1rem" }}>
        {acces.map((a) => (
          <li key={a.id}>
            <span className="etiquette">{a.role}</span>{" "}
            <strong>{a.libelle}</strong>{" "}
            {!a.actif && <span className="etiquette etiquette--attention">révoqué</span>}
            <br />
            <span className="legende">
              {a.filiere ?? "toutes filières"} · {a.niveau ?? "tous niveaux"} ·
              créé le {new Date(a.cree_le).toLocaleDateString("fr-FR")} ·{" "}
              {a.dernier_usage
                ? `dernier usage le ${new Date(a.dernier_usage).toLocaleDateString("fr-FR")}`
                : "jamais utilisé"}
            </span>
            {peutGererRole(session.role, a.role) && (
              <div className="actions" style={{ marginTop: ".5rem" }}>
                <form action={actionBasculerCode}>
                  <input type="hidden" name="id" value={a.id} />
                  <input
                    type="hidden"
                    name="actif"
                    value={a.actif ? "false" : "true"}
                  />
                  <button type="submit" className="bouton bouton--secondaire">
                    {a.actif ? "Révoquer" : "Réactiver"}
                  </button>
                </form>
                {estAdmin && (
                  <form action={actionSupprimerCode}>
                    <input type="hidden" name="id" value={a.id} />
                    <button type="submit" className="bouton bouton--secondaire">
                      Supprimer
                    </button>
                  </form>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>

      {/* ──────────────────────────────────────────────────── dépôts */}
      <div className="section-titre">
        <h2>Dépôts de documents</h2>
        <span className="compte">{depots.length} document(s)</span>
      </div>

      {!blobConfigure() && (
        <p className="encart encart--attention">
          Store <strong>Blob</strong> non branché : le dépôt de fichiers est
          indisponible.
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
                    {typeof m.critereId === "string" ? m.critereId : "—"} —{" "}
                    {m.titre.slice(0, 60)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="actions">
            <button
              type="submit"
              className="bouton"
              disabled={!blobConfigure()}
            >
              Déposer
            </button>
          </div>
        </form>
      </section>

      <ul className="liste-nue" style={{ marginTop: "1rem" }}>
        {depots.map((d) => (
          <li key={d.id}>
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
                <button type="submit" className="bouton bouton--secondaire">
                  Supprimer
                </button>
              </form>
            </div>
          </li>
        ))}
      </ul>

      {/* ───────────────────────────────────────────── ordonnancement */}
      <div className="section-titre">
        <h2>Ordonnancement des modules</h2>
        <span className="compte">{modules.length} modules</span>
      </div>
      <p className="legende">
        Collez les identifiants de critère dans l&apos;ordre souhaité, séparés
        par des virgules. Les modules non listés conservent l&apos;ordre de la
        fiche d&apos;habilitation.
      </p>
      <section className="carte">
        <form action={actionOrdonner}>
          <label className="champ">
            <span>Parcours</span>
            <select name="parcours" defaultValue="integration">
              <option value="integration">Intégration</option>
              <option value="maintien">Maintien d&apos;habilitation</option>
            </select>
          </label>
          <label className="champ">
            <span>Ordre</span>
            <input
              type="text"
              name="ordre"
              placeholder="protection-operateur-cytotoxiques, comportement-zac, critere-b1-02…"
            />
          </label>
          <div className="actions">
            <button type="submit" className="bouton">
              Enregistrer l&apos;ordre
            </button>
          </div>
        </form>
      </section>
    </article>
  );
}
