import { Badge } from "@/components/Badge";
import { badgeEffectif } from "@/content/badges";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { lireBareme } from "@/lib/bareme-db";
import { STATUTS_MODULE, listerModulesDeposes, versModule } from "@/content/modules-db";
import { listeBlocs } from "@/content/blocs-db";
import { getReferentiel } from "@/content/referentiel-db";
import { BarreFiltres } from "@/components/BarreFiltres";
import { STATUTS_FILTRE_MODULE, lireFiltreModules, moduleDeposeRetenu } from "@/content/filtres-listes";
import { FormulaireModule } from "./formulaire";
import { actionEnregistrerModule, actionStatutModule, actionSupprimerModule } from "./actions";

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
  /** Question 91 (lot 3) : recherche, statut, bloc, filière, niveau. */
  searchParams: Promise<{ ok?: string; erreur?: string; message?: string; [cle: string]: string | string[] | undefined }>;
}) {
  const p = await searchParams;
  const session = (await getSession())!;
  const [deposes, bareme, blocs, { filieres, niveaux }] = await Promise.all([
    listerModulesDeposes(),
    lireBareme(),
    listeBlocs(),
    getReferentiel(),
  ]);
  // Filtres de la liste (question 91, choix a, lot 3). Bloc et profil lus comme le programme les lit : le
  // bloc d'un critère de la fiche prime, et une filière ou un niveau absents ne limitent rien.
  const filieresPostes = filieres.filter((f) => f.id !== "socle");
  const filtre = lireFiltreModules(p, {
    blocs: blocs.map((b) => b.numero),
    filieres: filieresPostes.map((f) => f.id),
    niveaux: niveaux.map((n) => String(n.code)),
  });
  const retenus = deposes.filter((m) => {
    const v = versModule(m);
    return moduleDeposeRetenu(
      { ...m, bloc: typeof v.bloc === "number" ? v.bloc : null, filieres: v.postes, niveaux: v.niveaux },
      filtre,
    );
  });

  return (
    <>
      <section className="panneau-titre">
        <h1>Modules</h1>
        <p>
          Ajoutez un module ici : il n&apos;entre au programme qu&apos;une fois <strong>publié</strong> par
          l&apos;administration. Ses questions se déposent dans la banque, ses documents dans{" "}
          <Link href="/admin/documents">Documents</Link>.
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
      {deposes.length > 0 && (
        <BarreFiltres
          adresse="/admin/modules"
          recherche={{ valeur: filtre.q, placeholder: "Titre, objectif ou critère" }}
          champs={[
            {
              nom: "statut",
              libelle: "Statut",
              options: STATUTS_FILTRE_MODULE.map((x) => ({ valeur: x, libelle: STATUTS_MODULE[x] })),
              valeur: filtre.statut,
              minuscule: true,
            },
            {
              nom: "bloc",
              libelle: "Bloc",
              options: blocs.map((b) => ({ valeur: String(b.numero), libelle: `${b.numero} — ${b.titre.slice(0, 50)}`, puce: String(b.numero) })),
              valeur: filtre.bloc,
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
          total={deposes.length}
          unite={["module", "modules"]}
        />
      )}
      <ul className="liste-nue">
        {deposes.length > 0 && retenus.length === 0 && <li className="legende">Aucun module ne correspond à ces filtres.</li>}
        {retenus.map((m) => (
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
            <div className="titre-vignette">
              <Badge nom={badgeEffectif(m.badge, m.titre, m.objectif)} taille={72} />
              <div>
                <h3 style={{ margin: ".25rem 0" }}>{m.titre}</h3>
                {m.objectif && <p className="legende" style={{ margin: 0 }}>{m.objectif}</p>}
              </div>
            </div>
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
        <p className="legende">
          Le rattachement des 53 critères de la fiche — seuil, filières, niveaux, parcours — se règle
          dans <Link href="/admin/rattachement">Squelette › Rattachement des modules</Link> (question 81).
        </p>
      )}
    </>
  );
}
