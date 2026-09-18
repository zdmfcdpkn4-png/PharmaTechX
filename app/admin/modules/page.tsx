import Link from "next/link";
import { getSession } from "@/lib/auth";
import { lireBareme } from "@/lib/bareme-db";
import { getTousModules } from "@/content/store";
import { STATUTS_MODULE, lireReglagesSeuils, listerModulesDeposes } from "@/content/modules-db";
import { FormulaireModule } from "./formulaire";
import { actionEnregistrerModule, actionReglerSeuil, actionStatutModule, actionSupprimerModule } from "./actions";

export const dynamic = "force-dynamic";

const MESSAGES: Record<string, string> = {
  cree: "Module créé au statut brouillon : déposez ses questions et ses documents, puis publiez-le.",
  modifie: "Module enregistré.",
  publie: "Module publié : il figure au programme des profils choisis.",
  brouillon: "Module repassé en brouillon.",
  retire: "Module retiré du programme ; ses questions et documents sont conservés.",
  supprime: "Module supprimé.",
  seuil: "Seuil enregistré.",
};

const ERREURS: Record<string, string> = {
  titre: "Le titre est obligatoire.",
  critere: "Critère inconnu.",
  inconnu: "Module inconnu.",
  suppression: "Suppression refusée.",
  publie: "Un module publié ne se modifie qu'en administration : demandez de le repasser en brouillon.",
};

export default async function Modules({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; erreur?: string; message?: string }>;
}) {
  const p = await searchParams;
  const session = (await getSession())!;
  const [deposes, bareme, reglages] = await Promise.all([listerModulesDeposes(), lireBareme(), lireReglagesSeuils()]);
  const modulesCode = getTousModules();

  return (
    <>
      <section className="panneau-titre">
        <h1>Modules</h1>
        <p>
          Le texte des 58 critères de la fiche reste versionné avec le site (décision du 18/09/2026).
          Un <strong>module déposé</strong> s&apos;ajoute depuis cet écran, à la manière d&apos;un dépôt
          du Lecteur QIM · QCM : titre, objectif, présentation courte, rattachement facultatif à un
          critère, profils (filières, niveaux, parcours), seuil de réussite. Ses questions se déposent
          depuis la banque, ses documents depuis Documents. Il n&apos;entre au programme
          qu&apos;une fois <strong>publié</strong>. Publier, retirer ou repasser en brouillon est{" "}
          <strong>réservé à l&apos;administration</strong>, et un module publié ne se modifie
          qu&apos;en administration (règle des quatre yeux, décision du 18/09/2026).
        </p>
      </section>

      {p.ok && MESSAGES[p.ok] && <p className="encart encart--ok">{MESSAGES[p.ok]}</p>}
      {p.erreur && (
        <p className="encart encart--attention">
          {ERREURS[p.erreur] ?? "Erreur."}
          {p.message ? ` ${p.message}` : ""}
        </p>
      )}

      <div className="section-titre">
        <h2>Modules déposés</h2>
        <span className="compte">{deposes.length} module(s)</span>
      </div>
      {deposes.length === 0 && <p className="encart">Aucun module déposé. Créez-en un ci-dessous.</p>}
      <ul className="liste-nue">
        {deposes.map((m) => (
          <li key={m.id} className="carte">
            <div className="etape-tete">
              <span
                className={`etiquette ${m.statut === "publie" ? "etiquette--ok" : m.statut === "retire" ? "etiquette--neutre" : "etiquette--attention"}`}
              >
                {STATUTS_MODULE[m.statut]}
              </span>
              {m.critere_id && <span className="etiquette etiquette--code">{m.critere_id}</span>}
              <span className="legende" style={{ marginLeft: "auto" }}>
                v{m.version} · créé par {m.cree_par} · <code>{m.id}</code>
              </span>
            </div>
            <h3 style={{ margin: ".25rem 0" }}>{m.titre}</h3>
            {m.objectif && <p className="legende" style={{ margin: 0 }}>{m.objectif}</p>}
            <p className="legende" style={{ margin: ".25rem 0 0" }}>
              {m.filieres.length > 0 ? `Filières : ${m.filieres.join(", ")}` : "Tronc commun (tous postes)"}
              {" · "}
              {m.niveaux.length > 0 ? `niveaux ${m.niveaux.join(", ")}` : "tous niveaux"}
              {" · "}parcours {m.parcours.join(", ")}
              {" · "}seuil {m.seuil} %{" · "}
              {m.nb_valides} question{m.nb_valides > 1 ? "s" : ""} validée{m.nb_valides > 1 ? "s" : ""} sur {m.nb_questions}
              {" · "}
              {m.nb_documents} document{m.nb_documents > 1 ? "s" : ""}
            </p>
            <div className="actions" style={{ marginTop: ".5rem" }}>
              {(session.role === "admin" || m.statut !== "publie") && (
                <Link href={`/admin/modules/${m.id}`} className="bouton bouton--compact bouton--secondaire">
                  Modifier
                </Link>
              )}
              <Link href={`/module/${m.id}`} className="bouton bouton--compact bouton--secondaire">
                Voir
              </Link>
              <Link href={`/admin/questions/import?module=${encodeURIComponent(m.id)}`} className="bouton bouton--compact bouton--secondaire">
                Déposer des questions
              </Link>
              <Link href={`/admin/questions?module=${encodeURIComponent(m.id)}`} className="bouton bouton--compact bouton--secondaire">
                Questions
              </Link>
              <Link href={`/admin/documents?module=${encodeURIComponent(m.id)}`} className="bouton bouton--compact bouton--secondaire">
                Documents
              </Link>
              {session.role === "admin" && m.statut !== "publie" && (
                <form action={actionStatutModule}>
                  <input type="hidden" name="id" value={m.id} />
                  <input type="hidden" name="statut" value="publie" />
                  <button type="submit" className="bouton bouton--compact">Publier</button>
                </form>
              )}
              {session.role === "admin" && m.statut === "publie" && (
                <form action={actionStatutModule}>
                  <input type="hidden" name="id" value={m.id} />
                  <input type="hidden" name="statut" value="brouillon" />
                  <button type="submit" className="bouton bouton--compact bouton--secondaire">Repasser en brouillon</button>
                </form>
              )}
              {session.role === "admin" && m.statut !== "retire" && (
                <form action={actionStatutModule}>
                  <input type="hidden" name="id" value={m.id} />
                  <input type="hidden" name="statut" value="retire" />
                  <button type="submit" className="bouton bouton--compact bouton--secondaire">Retirer</button>
                </form>
              )}
              {session.role !== "admin" && m.statut === "brouillon" && (
                <span className="legende" style={{ alignSelf: "center" }}>publication réservée à l&apos;administration</span>
              )}
              {session.role === "admin" && (
                <form action={actionSupprimerModule}>
                  <input type="hidden" name="id" value={m.id} />
                  <button type="submit" className="bouton bouton--compact bouton--discret">Supprimer</button>
                </form>
              )}
            </div>
          </li>
        ))}
      </ul>

      <div className="section-titre">
        <h2>Nouveau module</h2>
      </div>
      <FormulaireModule action={actionEnregistrerModule} seuilDefaut={bareme.seuilDefaut} />

      {session.role === "admin" && (
        <section className="section" id="seuils">
          <div className="section-titre">
            <h2>Seuil de réussite des modules du code</h2>
            <span className="compte">défaut du barème : {bareme.seuilDefaut} %</span>
          </div>
          <p className="legende">
            Chaque module du code suit le seuil par défaut du barème (<Link href="/admin/bareme">Barème</Link>),
            sauf seuil réglé ici pour lui. Le seuil d&apos;un module déposé se règle dans son formulaire.
          </p>
          <details className="bloc">
            <summary>
              {modulesCode.length} modules · {Object.keys(reglages).length} seuil(s) réglé(s)
            </summary>
            <div className="contenu-bloc">
              {modulesCode.map((m) => {
                const regle = reglages[m.id];
                return (
                  <form key={m.id} action={actionReglerSeuil} className="ligne-critere" style={{ alignItems: "center" }}>
                    <span className="code">{typeof m.critereId === "string" ? m.critereId : "—"}</span>
                    <span className="libelle">
                      {m.titre.slice(0, 70)}{" "}
                      <span className="legende">— {regle !== undefined ? `réglé à ${regle} %` : `défaut, ${bareme.seuilDefaut} %`}</span>
                    </span>
                    <input type="hidden" name="moduleId" value={m.id} />
                    <input type="number" name="seuil" min={50} max={100} step={1} defaultValue={regle ?? bareme.seuilDefaut} style={{ width: "5rem" }} aria-label={`Seuil de ${m.titre}`} />
                    <button type="submit" className="bouton bouton--compact bouton--secondaire">Régler</button>
                    {regle !== undefined && (
                      <button type="submit" name="mode" value="defaut" className="bouton bouton--compact bouton--discret">
                        Défaut
                      </button>
                    )}
                  </form>
                );
              })}
            </div>
          </details>
        </section>
      )}
    </>
  );
}
