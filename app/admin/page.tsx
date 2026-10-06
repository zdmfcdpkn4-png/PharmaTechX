import Link from "next/link";
import { getSession, peutGererRole, LIBELLES_ROLE } from "@/lib/auth";
import { listerAcces } from "@/lib/db";
import { getReferentiel } from "@/content/referentiel-db";
import { actionBasculerCode, actionCreerCode, actionReinitialiserCode, actionRelierCode, actionSupprimerCode } from "@/app/actions";
import { listerIdentifiants } from "@/lib/agents";
import { conservationActive } from "@/lib/config";
import { CREER_ET_RELIER } from "@/lib/liaison";
import { listerProgrammes } from "@/content/programmes-db";
import { MENTION_DEGRADE } from "@/content/programmes";
import { BoutonEnvoi } from "@/components/BoutonEnvoi";
import { BarreFiltres } from "@/components/BarreFiltres";
import { ETATS_CODE, ROLES_CODE, SANS_PROGRAMME, codeRetenu, lireFiltreCodes } from "@/content/filtres-listes";
import { adresseDuFiltre } from "@/content/filtres";
import { METIER_DU_TYPE, TYPES_CODE } from "@/lib/codes";
import { metiers, parMetier } from "@/content/habilitation";

export const dynamic = "force-dynamic";

const MESSAGES: Record<string, string> = {
  "role-interdit": "Votre rôle ne permet pas de créer ce type de code.",
  "type-inconnu": "Choisissez le type de profil dans la liste. Rien n\u2019a été créé.",
  "type-metier":
    "Un code de poste prend la filière et le niveau du métier de son type. Rien n\u2019a été créé.",
  "type-role":
    "Un code d\u2019administration est de type Pharmacien : il porte le visa et la signature du pharmacien responsable. Rien n\u2019a été créé.",
  "role-interdit-bascule": "Votre rôle ne permet pas d\u2019agir sur ce code.",
  "confirmation-code-invalide":
    "Code incorrect : rien n\u2019a été modifié. La tentative est au journal.",
  "confirmation-bloque":
    "Trop de saisies fausses depuis ce poste : la confirmation est bloquée le temps du palier, comme la connexion. Rien n\u2019a été modifié.",
  "suppression-propre-code":
    "C\u2019est le code de votre session : il ne se supprime pas. Ouvrez une session avec un autre code d\u2019administration pour supprimer celui-ci.",
  "reinitialisation-propre-code":
    "C\u2019est le code de votre session : il ne se réinitialise pas d\u2019ici, la session se fermerait avant d\u2019afficher le nouveau code. Ouvrez une session avec un autre code d\u2019administration.",
  "programme-non-valide":
    "Ce programme à la carte n\u2019est pas validé : un code de poste ne s\u2019ouvre que sur un programme validé. Rien n\u2019a été créé.",
  "confirmation-indisponible":
    "La confirmation n\u2019a pas pu être vérifiée : votre session n\u2019est plus rattachée à un code en cours de validité. Reconnectez-vous.",
  "agent-role":
    "Seul un code de poste se relie à un identifiant d\u2019agent : un code de tutorat ou d\u2019administration n\u2019ouvre pas de progression. Rien n\u2019a été créé.",
  "agent-indisponible":
    "Les identifiants d\u2019agents ne servent pas sur ce site : la conservation des rapports n\u2019est pas activée. Rien n\u2019a été créé.",
  "liaison-role": "Seul un code de poste se relie à un identifiant d\u2019agent. Rien n\u2019a changé.",
  "liaison-agent": "Identifiant inconnu ou clos : le code n\u2019a pas été relié.",
};

const CONFIRMATIONS: Record<string, string> = {
  "code-supprime": "Code supprimé. Les sessions ouvertes avec lui se ferment à la requête suivante.",
};

export default async function Admin({
  searchParams,
}: {
  /** Question 91 (lot 3) : recherche, profil, état, filière, niveau, programme à la carte. */
  searchParams: Promise<{
    nouveau?: string;
    libelle?: string;
    erreur?: string;
    ok?: string;
    reinitialise?: string;
    /** Identifiant d'agent relié à la création ou par « Relier » (question 99, choix a). */
    agent?: string;
    [cle: string]: string | string[] | undefined;
  }>;
}) {
  const p = await searchParams;
  const { filieres, niveaux } = await getReferentiel();
  const session = (await getSession())!;
  const estAdmin = session.role === "admin";
  // Identifiants d'agents, pour relier un code de poste (question 99, choix a) : sans conservation des
  // rapports, il n'y en a pas, et la case comme la liste disparaissent.
  const conservation = conservationActive();
  const [acces, programmes, agents] = await Promise.all([
    listerAcces(),
    listerProgrammes().catch(() => []),
    conservation ? listerIdentifiants().catch(() => []) : Promise.resolve([]),
  ]);
  const programmesValides = programmes.filter((x) => x.statut === "valide");
  // Filtres de la liste (question 91, choix a, lot 3) : la barre de la banque.
  const filieresPostes = filieres.filter((f) => f.id !== "socle");
  const filtre = lireFiltreCodes(p, {
    filieres: filieresPostes.map((f) => f.id),
    niveaux: niveaux.map((n) => String(n.code)),
    programmes: programmes.map((x) => x.id),
  });
  const retenus = acces.filter((a) => codeRetenu(a, filtre));
  // Une action sur un code revient à cette liste, filtre compris (question 92, choix a).
  const liste = adresseDuFiltre("/admin", filtre);
  // Question 98 (choix a) : le métier de chaque type, dit sous la filière et le niveau.
  const typesParMetier = metiers
    .map((m) => ({ m, types: TYPES_CODE.filter((t) => METIER_DU_TYPE[t.id] === m.id) }))
    .filter((x) => x.types.length > 0)
    .map(({ m, types }) => `${types.map((t) => t.libelle).join(", ")} : ${m.libelle.toLowerCase()}`)
    .join(" ; ");

  return (
    <>
      {/* Codes d'accès (question 91, choix a) : la page « Accès », sous Équipe ; ses tuiles et l'état du
          stockage sont passés à l'accueil, le test de l'apprenant sur sa propre page. */}
      <section className="panneau-titre">
        <h1>Codes d&apos;accès</h1>
        <p>Un code ouvre un profil, pas un compte ; il n&apos;est montré qu&apos;une fois, à sa création.</p>
      </section>

      {p.nouveau && (
        <p className="encart encart--ok">
          <strong>
            {p.reinitialise ? `Code réinitialisé pour « ${p.libelle} » : ` : `Code créé pour « ${p.libelle} » : `}
          </strong>
          <code style={{ fontSize: "1.15rem" }}>{p.nouveau}</code>
          <br />
          Transmettez-le à l&apos;intéressé maintenant : il n&apos;est affiché qu&apos;une fois.
          {p.reinitialise ? " L'ancien code ne vaut plus, et les sessions ouvertes avec lui se ferment." : ""}
          {p.agent && !p.reinitialise && (
            <>
              <br />
              Relié à l&apos;identifiant <code>{p.agent}</code> : connecté par ce code, l&apos;agent ne saisit que son
              code personnel, qu&apos;il choisit à sa première connexion. Notez la correspondance avec l&apos;agent dans
              la liste tenue hors du site.
            </>
          )}
        </p>
      )}
      {(p.ok === "relie" || p.ok === "delie") && p.libelle && (
        <p className="encart encart--ok" role="status">
          {p.ok === "relie" && p.agent ? (
            <>
              Code « {p.libelle} » relié à <code>{p.agent}</code> : connecté par ce code, l&apos;agent ne saisit plus que
              son code personnel.
            </>
          ) : (
            <>Code « {p.libelle} » délié : il redevient partagé, chaque agent y saisit son identifiant.</>
          )}
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

      {/* ─────────────────────────────────────────────── codes d'accès */}
      <div className="section-titre">
        <h2>Les codes</h2>
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
              {/* Venu de l'introduction (question 91), sous le choix qu'il concerne. */}
              {!estAdmin && (
                <span className="legende">Les codes d&apos;administration et de tutorat ne vous sont pas accessibles.</span>
              )}
            </label>
            {/* Question 95 (choix a) : plus de libellé saisi, le site nomme le code d'après son type. */}
            <label className="champ">
              <span>Type de profil</span>
              <select name="type" defaultValue="" required>
                <option value="" disabled>
                  Choisir le type
                </option>
                {TYPES_CODE.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.libelle}
                  </option>
                ))}
              </select>
              {/* Pas un `span` : `.champ > span` en ferait un intitulé, en gras. */}
              <small className="legende" style={{ display: "block", marginTop: ".375rem" }}>
                Le site nomme le code : PHARMACIEN-0, PHARMACIEN-1… Un numéro n&apos;est jamais redonné, même
                après suppression du code.
                {estAdmin && " Un code d\u2019administration est de type Pharmacien."}
              </small>
            </label>
          </div>
          <div className="rangee">
            <label className="champ">
              <span>Filière (profils de poste)</span>
              <select name="filiere" defaultValue="">
                <option value="">Toutes</option>
                {parMetier(filieres, (f) => f.metier).map(({ metier, liste }) => (
                  <optgroup key={metier.id} label={metier.libelle}>
                    {liste.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.libelle}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
            <label className="champ">
              <span>Niveau visé</span>
              <select name="niveau" defaultValue="">
                <option value="">Tous</option>
                {parMetier(niveaux, (n) => n.metier).map(({ metier, liste }) => (
                  <optgroup key={metier.id} label={metier.libelle}>
                    {liste.map((n) => (
                      <option key={n.code} value={n.code}>
                        {n.libelle}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
          </div>
          <p className="legende" style={{ margin: ".375rem 0 0" }}>
            Un code de poste prend la filière et le niveau du métier de son type — {typesParMetier}.
          </p>
          <div className="rangee">
            <label className="champ">
              <span>Profil dégradé : programme à la carte (codes de poste)</span>
              <select name="programme" defaultValue="">
                <option value="">Aucun — le programme suit la fiche</option>
                {programmesValides.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.nom} — {MENTION_DEGRADE}
                  </option>
                ))}
              </select>
            </label>
            <p className="legende" style={{ alignSelf: "end", margin: 0 }}>
              Le poste s&apos;ouvre alors sur ce programme, marqué « {MENTION_DEGRADE} ».{" "}
              <Link href="/admin/programmes">Composer ou valider un programme</Link>.
            </p>
          </div>
          {/* Question 99 (choix a) : un code de poste personnel, relié à l'identifiant suivant. */}
          {conservation && (
            <div className="cases" style={{ marginTop: ".75rem" }}>
              <label>
                <input type="checkbox" name="agent" value={CREER_ET_RELIER} />
                Créer l&apos;identifiant d&apos;agent suivant et le relier à ce code (codes de poste)
              </label>
              <small className="legende" style={{ display: "block" }}>
                L&apos;agent ne saisira que son code personnel. Un code relié ne doit servir qu&apos;à cette personne ;
                laissé vide, le code reste partagé.
              </small>
            </div>
          )}
          <div className="actions">
            <BoutonEnvoi>Générer le code</BoutonEnvoi>
          </div>
        </form>
      </section>

      <p className="legende" style={{ marginTop: "1rem" }}>
        Révoquer ou supprimer un code ferme, à la requête suivante, les sessions ouvertes avec lui ;
        réactiver ne les rouvre pas.
      </p>
      <BarreFiltres
        adresse="/admin"
        recherche={{ valeur: filtre.q, placeholder: "Rechercher un libellé" }}
        champs={[
          {
            nom: "profil",
            libelle: "Profil",
            options: ROLES_CODE.map((r) => ({ valeur: r, libelle: LIBELLES_ROLE[r] })),
            valeur: filtre.profil,
          },
          { nom: "etat", libelle: "État", options: ETATS_CODE, valeur: filtre.etat, minuscule: true },
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
          {
            nom: "programme",
            libelle: "Programme à la carte",
            options: [
              { valeur: SANS_PROGRAMME, libelle: "Sans programme à la carte" },
              ...programmes.map((x) => ({ valeur: String(x.id), libelle: x.nom })),
            ],
            valeur: filtre.programme,
            large: true,
          },
        ]}
        retenus={retenus.length}
        total={acces.length}
        unite={["code", "codes"]}
      />
      <ul className="liste-nue" style={{ marginTop: ".5rem" }}>
        {retenus.length === 0 && <li className="legende">Aucun code ne correspond à ces filtres.</li>}
        {retenus.map((a) => (
          <li key={a.id} className="carte">
            <span className="etiquette">{a.role}</span> <strong>{a.libelle}</strong>{" "}
            {!a.actif && <span className="etiquette etiquette--attention">révoqué</span>}
            <br />
            <span className="legende">
              {a.programme_id
                ? `programme à la carte « ${programmes.find((x) => x.id === a.programme_id)?.nom ?? a.programme_id} » — ${MENTION_DEGRADE}${programmes.find((x) => x.id === a.programme_id)?.statut === "valide" ? "" : " (non validé : le poste suit la fiche)"} · `
                : ""}
              {a.filiere ?? "toutes filières"} · {a.niveau ?? "tous niveaux"}
              {a.agent_identifiant ? (
                <>
                  {" "}· relié à{" "}
                  <Link href={`/admin/personnel/${a.agent_id}#t-parcours-agent`} title={`Fiche et parcours de ${a.agent_identifiant}`}>
                    <code>{a.agent_identifiant}</code>
                  </Link>
                </>
              ) : null}{" "}
              · créé le{" "}
              {new Date(a.cree_le).toLocaleDateString("fr-FR")} ·{" "}
              {a.dernier_usage
                ? `dernier usage le ${new Date(a.dernier_usage).toLocaleDateString("fr-FR")}`
                : "jamais utilisé"}
            </span>
            {peutGererRole(session.role, a.role) && (
              <div className="actions" style={{ marginTop: ".5rem" }}>
                {a.id === session.acces && a.actif ? (
                  <details className="suppression">
                    <summary className="bouton bouton--compact bouton--secondaire">
                      Révoquer…
                    </summary>
                    <form action={actionBasculerCode} className="suppression-corps">
                      <input type="hidden" name="id" value={a.id} />
                      <input type="hidden" name="actif" value="false" />
                      <input type="hidden" name="liste" value={liste} />
                      <label className="champ">
                        <span>Révoquer le code de votre session : retapez-le pour confirmer</span>
                        <input
                          type="password"
                          name="confirmation"
                          autoComplete="off"
                          spellCheck={false}
                          required
                        />
                      </label>
                      <div className="actions">
                        <button type="submit" className="bouton bouton--compact">
                          Révoquer mon code
                        </button>
                      </div>
                      <span className="legende">
                        Votre session se ferme à la requête suivante, et ce code ne permet plus de
                        se reconnecter : seul un autre code pourra le réactiver.
                      </span>
                    </form>
                  </details>
                ) : (
                  <form action={actionBasculerCode}>
                    <input type="hidden" name="id" value={a.id} />
                    <input type="hidden" name="actif" value={a.actif ? "false" : "true"} />
                    <input type="hidden" name="liste" value={liste} />
                    <button type="submit" className="bouton bouton--compact bouton--secondaire">
                      {a.actif ? "Révoquer" : "Réactiver"}
                    </button>
                  </form>
                )}
                {estAdmin && a.id !== session.acces && (
                  <details className="suppression">
                    <summary className="bouton bouton--compact bouton--secondaire">
                      Réinitialiser…
                    </summary>
                    <form action={actionReinitialiserCode} className="suppression-corps">
                      <input type="hidden" name="id" value={a.id} />
                      <input type="hidden" name="liste" value={liste} />
                      <label className="champ">
                        <span>
                          Code perdu ou corrompu : nouveau code pour « {a.libelle} ». Entrez votre code
                          d&apos;administration
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
                        Le profil reste le même — signature, programme, identité pour les quatre yeux.
                        L&apos;ancien code cesse de valoir, les sessions ouvertes avec lui se ferment, et
                        le nouveau code s&apos;affiche une fois. Journalisé.
                      </span>
                      <div className="actions">
                        <button type="submit" className="bouton bouton--compact">
                          Réinitialiser le code
                        </button>
                      </div>
                    </form>
                  </details>
                )}
                {/* Question 99 (choix a) : un code de poste se relie à un identifiant actif, ou se délie. */}
                {a.role === "poste" && conservation && (
                  <details className="suppression liaison-agent">
                    <summary className="bouton bouton--compact bouton--secondaire">
                      {a.agent_identifiant ? "Agent relié…" : "Relier à un agent…"}
                    </summary>
                    <form action={actionRelierCode} className="suppression-corps">
                      <input type="hidden" name="id" value={a.id} />
                      <input type="hidden" name="liste" value={liste} />
                      <label className="champ">
                        <span>Identifiant d&apos;agent relié à « {a.libelle} »</span>
                        <select name="agent" defaultValue={a.agent_identifiant ?? ""}>
                          <option value="">Aucun — code partagé</option>
                          {agents
                            .filter((g) => g.actif || g.identifiant === a.agent_identifiant)
                            .map((g) => (
                              <option key={g.id} value={g.identifiant} disabled={!g.actif}>
                                {g.identifiant}
                                {g.actif ? "" : " (clos)"}
                              </option>
                            ))}
                        </select>
                      </label>
                      <span className="legende">
                        Relié, ce code ne doit servir qu&apos;à cet agent : il n&apos;y saisit que son code personnel, et
                        aucun autre identifiant ne s&apos;y rattache. Créer un identifiant :{" "}
                        <Link href="/admin/personnel">Personnel</Link>.
                      </span>
                      <div className="actions">
                        <button type="submit" className="bouton bouton--compact">
                          Enregistrer
                        </button>
                      </div>
                    </form>
                  </details>
                )}
                {estAdmin && (
                  <details className="suppression">
                    <summary className="bouton bouton--compact bouton--secondaire">
                      Supprimer…
                    </summary>
                    <form action={actionSupprimerCode} className="suppression-corps">
                      <input type="hidden" name="id" value={a.id} />
                      <input type="hidden" name="liste" value={liste} />
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
