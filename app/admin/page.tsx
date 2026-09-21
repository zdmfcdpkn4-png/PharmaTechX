import Link from "next/link";
import { getSession, peutGererRole, LIBELLES_ROLE } from "@/lib/auth";
import { listerAcces } from "@/lib/db";
import { modeStockage } from "@/lib/stockage";
import { modeConservation } from "@/lib/config";
import { getReferentiel } from "@/content/referentiel-db";
import { comptesParModule, compterSignalementsOuverts } from "@/content/banque-db";
import { comptesRapports } from "@/lib/rapports";
import { actionBasculerCode, actionCreerCode, actionSupprimerCode } from "@/app/actions";

export const dynamic = "force-dynamic";

const MESSAGES: Record<string, string> = {
  "role-interdit": "Votre rôle ne permet pas de créer ce type de code.",
  "libelle-manquant": "Le libellé du profil est obligatoire.",
  "confirmation-code-invalide":
    "Code d\u2019administration incorrect : rien n\u2019a été supprimé. La tentative est au journal.",
  "confirmation-bloque":
    "Trop de saisies fausses depuis ce poste : la confirmation est bloquée le temps du palier, comme la connexion. Rien n\u2019a été supprimé.",
  "suppression-propre-code":
    "C\u2019est le code de votre session : il ne se supprime pas. Ouvrez une session avec un autre code d\u2019administration pour supprimer celui-ci.",
  "confirmation-indisponible":
    "La confirmation n\u2019a pas pu être vérifiée : votre session n\u2019est plus rattachée à un code en cours de validité. Reconnectez-vous.",
};

const CONFIRMATIONS: Record<string, string> = {
  "code-supprime": "Code supprimé. Les sessions ouvertes avec lui se ferment à la requête suivante.",
};

export default async function Admin({
  searchParams,
}: {
  searchParams: Promise<{ nouveau?: string; libelle?: string; erreur?: string; ok?: string }>;
}) {
  const p = await searchParams;
  const { filieres, niveaux } = await getReferentiel();
  const session = (await getSession())!;
  const estAdmin = session.role === "admin";
  const [acces, comptes, ouverts] = await Promise.all([
    listerAcces(),
    comptesParModule(),
    compterSignalementsOuverts(),
  ]);
  const aVerifier = Object.values(comptes).reduce((s, c) => s + c.aVerifier, 0);
  const validees = Object.values(comptes).reduce((s, c) => s + c.valides, 0);
  const conservation = modeConservation();
  const rapports = conservation === "pseudonyme" ? await comptesRapports() : null;

  return (
    <>
      <section className="panneau-titre">
        <h1>Administration</h1>
        <p>
          Connecté comme <strong>{session.libelle}</strong> — profil {LIBELLES_ROLE[session.role].toLowerCase()}.
          {!estAdmin && " Les codes administrateur et tuteur ne vous sont pas accessibles."}
        </p>
      </section>

      {p.nouveau && (
        <p className="encart encart--ok">
          <strong>Code créé pour « {p.libelle} » : </strong>
          <code style={{ fontSize: "1.15rem" }}>{p.nouveau}</code>
          <br />
          Transmettez-le à l&apos;intéressé maintenant : il n&apos;est affiché qu&apos;une fois.
        </p>
      )}

      {p.ok && CONFIRMATIONS[p.ok] && (
        <p className="encart encart--ok" role="status">
          {CONFIRMATIONS[p.ok]}
        </p>
      )}
      {p.erreur && MESSAGES[p.erreur] && (
        <p className="encart encart--attention" role="alert">{MESSAGES[p.erreur]}</p>
      )}

      <div className="tuiles">
        <Link href="/admin/questions?statut=a_verifier" className="tuile tuile--lien">
          <span className="valeur">{aVerifier}</span>
          <span className="libelle">questions à vérifier</span>
        </Link>
        <Link href="/admin/questions" className="tuile tuile--lien">
          <span className="valeur">{validees}</span>
          <span className="libelle">questions validées en base</span>
        </Link>
        <Link href="/admin/signalements" className="tuile tuile--lien">
          <span className="valeur">{ouverts}</span>
          <span className="libelle">signalements ouverts</span>
        </Link>
        {rapports && (
          <Link href="/admin/rapports" className="tuile tuile--lien">
            <span className="valeur">{rapports.emis + rapports.vise_tuteur}</span>
            <span className="libelle">rapports en attente de visa</span>
          </Link>
        )}
      </div>

      <p className="legende">
        Stockage des documents : {modeStockage() === "blob" ? "Vercel Blob" : modeStockage() === "base" ? "base de données" : "aucun"} ·
        conservation des rapports : {conservation === "pseudonyme" ? "pseudonyme (rapports enregistrés sous identifiant d'agent, sans nom, circuit de visas)" : "aucune (rapport téléchargé, signature papier)"}.
      </p>

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
                  <option value="tuteur">Tuteur — banque de questions, dépôts, visas</option>
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

      <p className="legende" style={{ marginTop: "1rem" }}>
        Révoquer ou supprimer un code ferme, à la requête suivante, les sessions ouvertes avec lui ;
        réactiver ne les rouvre pas.
      </p>
      <ul className="liste-nue" style={{ marginTop: ".5rem" }}>
        {acces.map((a) => (
          <li key={a.id} className="carte">
            <span className="etiquette">{a.role}</span> <strong>{a.libelle}</strong>{" "}
            {!a.actif && <span className="etiquette etiquette--attention">révoqué</span>}
            <br />
            <span className="legende">
              {a.filiere ?? "toutes filières"} · {a.niveau ?? "tous niveaux"} · créé le{" "}
              {new Date(a.cree_le).toLocaleDateString("fr-FR")} ·{" "}
              {a.dernier_usage
                ? `dernier usage le ${new Date(a.dernier_usage).toLocaleDateString("fr-FR")}`
                : "jamais utilisé"}
            </span>
            {peutGererRole(session.role, a.role) && (
              <div className="actions" style={{ marginTop: ".5rem" }}>
                <form action={actionBasculerCode}>
                  <input type="hidden" name="id" value={a.id} />
                  <input type="hidden" name="actif" value={a.actif ? "false" : "true"} />
                  <button type="submit" className="bouton bouton--compact bouton--secondaire">
                    {a.actif ? "Révoquer" : "Réactiver"}
                  </button>
                </form>
                {estAdmin && (
                  <details className="suppression">
                    <summary className="bouton bouton--compact bouton--secondaire">
                      Supprimer…
                    </summary>
                    <form action={actionSupprimerCode} className="suppression-corps">
                      <input type="hidden" name="id" value={a.id} />
                      {a.id === session.acces ? (
                        <p style={{ margin: 0 }}>
                          C&apos;est le code de votre session : il ne se supprime pas. Vous vous
                          fermeriez la porte, et s&apos;il était le dernier code
                          d&apos;administration actif, la remise en service passerait par
                          l&apos;hébergeur. Ouvrez une session avec un autre code
                          d&apos;administration pour supprimer celui-ci.
                        </p>
                      ) : (
                        <>
                          <label className="champ">
                            <span>
                              Supprimer « {a.libelle} » : entrez votre code d&apos;administration
                            </span>
                            <input
                              type="password"
                              name="confirmation"
                              autoComplete="off"
                              spellCheck={false}
                              required
                            />
                          </label>
                          <span className="legende">
                            Irréversible, et journalisé. Le code supprimé ne se retrouve pas : il
                            est haché en base. Les sessions ouvertes avec lui se ferment à la
                            requête suivante.
                          </span>
                        </>
                      )}
                      <div className="actions">
                        <button
                          type="submit"
                          className="bouton bouton--compact"
                          disabled={a.id === session.acces}
                        >
                          Supprimer définitivement
                        </button>
                      </div>
                    </form>
                  </details>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
