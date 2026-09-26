import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { citationsDeLaFiliere, getReferentiel, listerNiveauxDeposes, toutesLesFilieres } from "@/content/referentiel-db";
import { metierOuDefaut, niveaux as NIVEAUX_FICHE } from "@/content/habilitation";
import { listeBlocs } from "@/content/blocs-db";
import { plageDesBlocs, type BlocServi } from "@/content/blocs";
import { rangEffectif } from "@/content/ordre-niveaux";
import { getTousModulesAvecDeposes } from "@/content/store";
import { STATUTS_MODULE } from "@/content/modules-db";
import {
  codesDeLaFiliere,
  filieresDePoste,
  programmeParNiveau,
  repartir,
  seuleFiliere,
  SOCLE,
} from "@/content/programme-filiere";
import { A_PRECISER, type Module } from "@/content/types";
import { Badge } from "@/components/Badge";
import { LienModule } from "@/components/LienModule";
import { FormulaireFiliere, FormulaireNouveauNiveau, SupprimerDepotFiliere } from "../../referentiel/formulaires";
import { ERREURS, MESSAGES } from "../../referentiel/messages";
import { actionProgrammeFiliere } from "../actions";

export const dynamic = "force-dynamic";

/** Codes des niveaux de la fiche : leur place fixe le rang par défaut (10, 20…). */
const CODES_FICHE = NIVEAUX_FICHE.map((n) => String(n.code));

/** Pourquoi une ligne du programme a été refusée (`app/admin/filieres/actions.ts`). */
const REFUS: Record<string, string> = {
  "derniere-filiere":
    "c'est sa seule filière : sans elle, un module du code reprendrait les filières de la fiche, et un module déposé passerait au tronc commun. Rattachez-le d'abord à une autre filière.",
  "tronc-commun":
    "il est au tronc commun : le rattacher ici le retirerait de toutes les autres filières. Il se règle depuis Rattachement des modules, ou dans son formulaire s'il est déposé.",
  "aucun-niveau": "il n'aurait plus aucun niveau : gardez-en au moins un coché.",
};

function lireRefus(brut: string | undefined): { raison: string; id: string }[] {
  return (brut ?? "")
    .split(",")
    .map((x) => {
      const i = x.indexOf(":");
      return i > 0 ? { raison: x.slice(0, i), id: x.slice(i + 1) } : null;
    })
    .filter((x): x is { raison: string; id: string } => x !== null && x.raison in REFUS);
}

/** Modules groupés par bloc servi, dans l'ordre des blocs ; ceux sans bloc en dernier. */
function parBloc(modules: readonly Module[], blocs: readonly BlocServi[]): { cle: string; titre: string; modules: Module[] }[] {
  const groupes = blocs
    .map((b) => ({ cle: `bloc-${b.numero}`, titre: `Bloc ${b.numero} — ${b.titre}`, modules: modules.filter((m) => m.bloc === b.numero) }))
    .filter((g) => g.modules.length > 0);
  const connus = new Set(blocs.map((b) => b.numero));
  const sansBloc = modules.filter((m) => typeof m.bloc !== "number" || !connus.has(m.bloc));
  return sansBloc.length > 0 ? [...groupes, { cle: "sans-bloc", titre: "Modules déposés sans bloc", modules: sansBloc }] : groupes;
}

/** Code du critère, ou un tiret pour un module déposé sans critère. */
function codeDuModule(m: Module): string {
  return typeof m.critereId === "string" && m.critereId !== A_PRECISER ? m.critereId : "—";
}

/** Une ligne du programme : case « au programme », niveaux de la filière, autres filières. */
function LigneProgramme({
  m,
  filiere,
  niveaux,
  dans,
  libelles,
  modifiable,
}: {
  m: Module;
  filiere: string;
  niveaux: string[];
  dans: boolean;
  libelles: Map<string, string>;
  modifiable: boolean;
}) {
  const seule = dans && seuleFiliere(m, filiere);
  const autres = filieresDePoste(m.postes).filter((f) => f !== filiere).map((f) => libelles.get(f) ?? f);
  const niveauxIci = niveaux.filter((n) => m.niveaux.includes(n));
  const autresNiveaux = m.niveaux.map(String).filter((n) => !niveaux.includes(n));
  const sansNiveau = dans && niveaux.length > 0 && niveauxIci.length === 0;
  const statut = m.origine === "base" && m.statut ? `module déposé · ${STATUTS_MODULE[m.statut].toLowerCase()}` : "";
  const infos = [
    statut,
    autres.length > 0 ? `aussi : ${autres.join(", ")}` : "",
    autresNiveaux.length > 0 ? `autres niveaux : ${autresNiveaux.join(", ")}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <li className="ligne-programme" data-module={m.id}>
      <span className="code">
        <LienModule id={m.id}>{codeDuModule(m)}</LienModule>
      </span>
      {modifiable ? (
        <>
          <input type="hidden" name="m" value={m.id} />
          {/* Ce que la ligne montre : seules les cases changées depuis compteront. */}
          <input type="hidden" name={`vu:${m.id}`} value={dans ? "1" : "0"} />
          <input type="hidden" name={`vus:${m.id}`} value={niveauxIci.join(",")} />
          <label className="ligne-programme-choix">
            <input
              type="checkbox"
              name="dans"
              value={m.id}
              defaultChecked={dans}
              disabled={seule}
              aria-describedby={seule ? "aide-seule-filiere" : undefined}
            />
            <span>{m.titre}</span>
          </label>
          {/* Case grisée : elle ne part pas avec le formulaire, le champ caché dit « reste ». */}
          {seule && <input type="hidden" name="dans" value={m.id} />}
        </>
      ) : (
        <span className="ligne-programme-choix">{m.titre}</span>
      )}
      {niveaux.length > 0 &&
        (modifiable ? (
          <span className="cases ligne-programme-niveaux" role="group" aria-label={`Niveaux de la filière pour ${m.titre}`}>
            {niveaux.map((n) => (
              <label key={n}>
                <input type="checkbox" name={`niv:${m.id}`} value={n} defaultChecked={m.niveaux.includes(n)} />
                {n}
              </label>
            ))}
          </span>
        ) : (
          <span className="legende">{niveauxIci.length > 0 ? niveauxIci.join(", ") : "aucun niveau de la filière"}</span>
        ))}
      {(infos || seule || sansNiveau) && (
        <span className="ligne-programme-infos legende">
          {infos}
          {seule && `${infos ? " · " : ""}seule filière`}
          {sansNiveau && (
            <span className="ligne-programme-alerte">
              {infos || seule ? " · " : ""}à aucun des niveaux de la filière
            </span>
          )}
        </span>
      )}
    </li>
  );
}

/**
 * Page d'une filière (question 80, choix a, 25/09/2026) : sa fiche, ses
 * niveaux, son programme de modules et ce qui la cite. Le programme
 * s'enregistre dans le réglage de chaque module, le même que sur l'écran
 * Modules. Tutorat : consultation seule.
 */
export default async function PageFiliere({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; erreur?: string; n?: string; refus?: string }>;
}) {
  const [{ id }, p] = await Promise.all([params, searchParams]);
  // Un identifiant de filière est normalisé à l'enregistrement : minuscules, chiffres, tirets.
  if (!/^[a-z0-9-]{1,40}$/.test(id)) notFound();
  const session = (await getSession())!;
  const estAdmin = session.role === "admin";
  const [liste, { niveaux: servis }, deposes, modulesTous, citations, blocs] = await Promise.all([
    toutesLesFilieres(),
    getReferentiel(),
    listerNiveauxDeposes(true),
    getTousModulesAvecDeposes(),
    citationsDeLaFiliere(id),
    listeBlocs(),
  ]);
  const entree = liste.find((x) => x.filiere.id === id);
  if (!entree) notFound();
  const { filiere: f, depot, fiche, active } = entree;
  const metier = metierOuDefaut(f.metier);
  const libelles = new Map(liste.map((x) => [x.filiere.id, x.filiere.libelle]));

  // Niveaux servis de la filière, puis ses niveaux déposés désactivés.
  const depotN = new Map(deposes.map((n) => [n.code, n]));
  const niveauxF = codesDeLaFiliere(servis, id);
  const niveauxInactifs = deposes.filter((n) => !n.actif && n.filiereId === id && !niveauxF.includes(n.code));
  const niveauxAffiches = [
    ...servis.filter((n) => n.filiere === id).map((n) => ({
      code: String(n.code),
      libelle: n.libelle,
      condition: n.condition,
      prerequis: n.prerequis.map(String),
      origine: n.origine ?? "code",
      actif: true,
    })),
    ...niveauxInactifs.map((n) => ({ code: n.code, libelle: n.libelle, condition: n.condition, prerequis: n.prerequis, origine: "base", actif: false })),
  ];

  const modules = modulesTous.filter((m) => m.statut !== "retire");
  const { dans, autres, troncCommun } = repartir(modules, id);
  const parNiveau = programmeParNiveau(dans, troncCommun, niveauxF);
  const refus = lireRefus(p.refus);
  const titreDe = new Map(modules.map((m) => [m.id, m.titre]));
  const etat = !active ? (fiche ? "Fiche, désactivée" : "Déposée, inactive") : depot ? (fiche ? "Fiche, corrigée" : "Déposée") : "Fiche";
  const ok =
    p.ok === "programme"
      ? Number(p.n) > 0
        ? `Programme enregistré : ${p.n} module${Number(p.n) > 1 ? "s" : ""} modifié${Number(p.n) > 1 ? "s" : ""}.`
        : "Aucune case n'avait changé : rien à enregistrer."
      : p.ok === "filiere-supprimee" && fiche
        ? "Dépôt supprimé : la filière reprend les valeurs de la fiche."
        : p.ok
          ? MESSAGES[p.ok]
          : undefined;

  return (
    <>
      <section className="panneau-titre">
        <p className="legende" style={{ margin: 0 }}>
          Squelette de la formation · <Link href="/admin/filieres">Filières</Link> · <Link href="/admin/niveaux">Niveaux</Link>
        </p>
        <div className="etape-tete">
          <Badge nom={f.badge} />
          <h1 style={{ margin: 0 }}>{f.libelle}</h1>
        </div>
        {f.description && <p>{f.description}</p>}
        <p className="legende">
          <span className={`etiquette ${fiche && !depot ? "etiquette--site" : active ? "etiquette--ok" : "etiquette--neutre"}`}>{etat}</span>{" "}
          {metier.libelle} · <code>{f.id}</code> · <a href="#programme">Programme</a> · <a href="#niveaux">Niveaux</a> ·{" "}
          <a href="#citations">Ce qui la cite</a> ·{" "}
          <Link href={`/admin/ordonnancement?filiere=${encodeURIComponent(f.id)}`}>Ordre des modules</Link>
        </p>
      </section>

      {ok && <p className="encart encart--ok">{ok}</p>}
      {p.erreur === "programme" ? (
        <div className="encart encart--attention" role="alert">
          <p style={{ margin: 0 }}>
            <strong>Rien n&apos;a été enregistré.</strong> Ces modules ne peuvent pas changer ainsi :
          </p>
          <ul className="liste-nue">
            {refus.map((r) => (
              <li key={r.id} className="legende">
                <strong>{titreDe.get(r.id) ?? r.id}</strong> — {REFUS[r.raison]}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        p.erreur && ERREURS[p.erreur] && <p className="encart encart--attention" role="alert">{ERREURS[p.erreur]}</p>
      )}
      {!estAdmin && (
        <p className="encart encart--attention">Consultation seule : une filière se modifie avec un code d&apos;administration.</p>
      )}
      {!active && (
        <p className="encart encart--attention">
          Désactivée : elle ne figure plus dans les listes de rattachement, et ses modules ne sont proposés à aucun profil.
          La case « Proposée dans les listes de rattachement » de sa fiche la rétablit.
        </p>
      )}

      <section className="section" id="fiche">
        <div className="section-titre">
          <h2 style={{ fontSize: "1.15rem" }}>Fiche</h2>
        </div>
        <p className="legende">
          Blocs de compétence : {f.blocs.length > 0 ? f.blocs.join(", ") : "aucun"}, pour mémoire
          {depot && !fiche ? ` · rang ${depot.rang}` : ""}.
        </p>
        {estAdmin && (
          <details>
            <summary className="legende">Modifier</summary>
            <p className="legende">
              Avant de la désactiver ou de supprimer son dépôt, voir <a href="#citations">ce qui la cite</a>.
            </p>
            <FormulaireFiliere filiere={f} rang={depot?.rang ?? 0} actif={active} fiche={fiche} plageBlocs={plageDesBlocs(blocs)} retour="filiere" />
            {depot && <SupprimerDepotFiliere id={f.id} retour="filiere" />}
          </details>
        )}
      </section>

      <section className="section" id="niveaux">
        <div className="section-titre">
          <h2 style={{ fontSize: "1.15rem" }}>Niveaux</h2>
          <span className="compte">{niveauxAffiches.length}</span>
        </div>
        {niveauxAffiches.length === 0 ? (
          <p className="legende">Aucun niveau rattaché à cette filière.</p>
        ) : (
          <ul className="liste-nue">
            {niveauxAffiches.map((n) => {
              const rang = rangEffectif(n.code, depotN.get(n.code)?.rang, CODES_FICHE);
              return (
                <li key={n.code} className="carte">
                  <div className="etape-tete">
                    <span className="etiquette etiquette--neutre">{n.code}</span>
                    <strong>{n.libelle}</strong>
                    <span className="legende niveau-rang">{rang === null ? "sans rang" : `rang ${rang}`}</span>
                    <span className={`etiquette ${n.origine === "base" ? "etiquette--ok" : "etiquette--site"}`}>
                      {n.origine === "base" ? (n.actif ? "Déposé" : "Déposé, inactif") : "Fiche"}
                    </span>
                    {n.actif && (
                      <Link
                        href={`/admin/ordonnancement?parcours=integration&filiere=${encodeURIComponent(f.id)}&niveau=${encodeURIComponent(n.code)}`}
                        className="legende"
                        style={{ marginLeft: "auto" }}
                      >
                        Ordre à ce niveau
                      </Link>
                    )}
                  </div>
                  {n.condition && <p className="legende">{n.condition}</p>}
                  {n.prerequis.length > 0 && <p className="legende">Prérequis : {n.prerequis.join(", ")}</p>}
                </li>
              );
            })}
          </ul>
        )}
        <p className="legende">
          Un niveau se modifie, se range ou se supprime dans <Link href="/admin/niveaux">Niveaux</Link>.
        </p>
        {estAdmin && (
          <FormulaireNouveauNiveau
            filieres={[]}
            prerequis={servis.map((n) => String(n.code))}
            filiereFixe={f.id}
            retour="filiere"
          />
        )}
      </section>

      <section className="section" id="programme">
        <div className="section-titre">
          <h2 style={{ fontSize: "1.15rem" }}>Programme</h2>
          <span className="compte">
            {f.id === SOCLE ? troncCommun.length : dans.length} module{(f.id === SOCLE ? troncCommun.length : dans.length) > 1 ? "s" : ""}
          </span>
        </div>
        {f.id === SOCLE ? (
          <p className="legende">
            Le socle transversal est le tronc commun : un module y figure quand il n&apos;a aucune autre filière, et il est
            alors proposé à toutes. Il se règle module par module, depuis l&apos;écran{" "}
            <Link href="/admin/rattachement">Rattachement des modules</Link>.
          </p>
        ) : (
          <>
            <p className="legende">
              Le programme d&apos;une filière, ce sont les modules qui la cochent. Cochés ici, ils l&apos;enregistrent dans
              leur propre réglage, le même que sur l&apos;écran <Link href="/admin/rattachement">Rattachement des modules</Link> : les deux
              écrans montrent toujours la même chose. Un module du code ainsi réglé s&apos;écarte de la fiche, et
              Rattachement des modules le signale. Les niveaux cochés sur sa ligne disent à quels niveaux cibles de la filière
              il est proposé ; retiré de la filière, un module perd aussi ces niveaux, sauf s&apos;il n&apos;en a pas
              d&apos;autre.
            </p>
            {dans.some((m) => seuleFiliere(m, f.id)) && (
              <p id="aide-seule-filiere" className="legende">
                Case grisée, « seule filière » : c&apos;est la seule filière du module. Il ne la quitte qu&apos;une fois
                rattaché à une autre, depuis la page de celle-ci — sans filière, un module du code reprendrait celles de
                la fiche, et un module déposé passerait au tronc commun.
              </p>
            )}
            {niveauxF.length === 0 ? (
              <p className="encart encart--attention">
                Cette filière n&apos;a pas encore de niveau : ses modules ne sont proposés à aucun niveau cible. Ajoutez-en
                un dans <a href="#niveaux">Niveaux</a>.
              </p>
            ) : (
              <p className="legende">
                Proposés à chaque niveau cible :{" "}
                {parNiveau.map((x) => `${x.niveau} — ${x.filiere} de la filière et ${x.troncCommun} du tronc commun`).join(" ; ")}.
              </p>
            )}
            {estAdmin ? (
              <form action={actionProgrammeFiliere} className="programme-filiere">
                <input type="hidden" name="filiere" value={f.id} />
                {dans.length === 0 ? (
                  <p className="legende">Aucun module au programme pour l&apos;instant.</p>
                ) : (
                  parBloc(dans, blocs).map((g) => (
                    <fieldset key={g.cle} className="groupe">
                      <legend className="champ-titre">{g.titre}</legend>
                      <ul className="liste-programme">
                        {g.modules.map((m) => (
                          <LigneProgramme key={m.id} m={m} filiere={f.id} niveaux={niveauxF} dans libelles={libelles} modifiable />
                        ))}
                      </ul>
                    </fieldset>
                  ))
                )}
                {autres.length > 0 && (
                  <details className="bloc">
                    <summary>Ajouter des modules d&apos;autres filières ({autres.length})</summary>
                    <div className="contenu-bloc">
                      {parBloc(autres, blocs).map((g) => (
                        <fieldset key={g.cle} className="groupe">
                          <legend className="champ-titre">{g.titre}</legend>
                          <ul className="liste-programme">
                            {g.modules.map((m) => (
                              <LigneProgramme key={m.id} m={m} filiere={f.id} niveaux={niveauxF} dans={false} libelles={libelles} modifiable />
                            ))}
                          </ul>
                        </fieldset>
                      ))}
                    </div>
                  </details>
                )}
                <div className="actions">
                  <button type="submit" className="bouton">Enregistrer le programme</button>
                </div>
              </form>
            ) : (
              parBloc(dans, blocs).map((g) => (
                <fieldset key={g.cle} className="groupe">
                  <legend className="champ-titre">{g.titre}</legend>
                  <ul className="liste-programme">
                    {g.modules.map((m) => (
                      <LigneProgramme key={m.id} m={m} filiere={f.id} niveaux={niveauxF} dans libelles={libelles} modifiable={false} />
                    ))}
                  </ul>
                </fieldset>
              ))
            )}
          </>
        )}
        {troncCommun.length > 0 && (
          <details className="bloc" open={f.id === SOCLE}>
            <summary>Tronc commun, proposé à toutes les filières ({troncCommun.length})</summary>
            <div className="contenu-bloc">
              {parBloc(troncCommun, blocs).map((g) => (
                <fieldset key={g.cle} className="groupe">
                  <legend className="champ-titre">{g.titre}</legend>
                  <ul className="liste-programme">
                    {g.modules.map((m) => (
                      <LigneProgramme key={m.id} m={m} filiere={f.id} niveaux={niveauxF} dans={false} libelles={libelles} modifiable={false} />
                    ))}
                  </ul>
                </fieldset>
              ))}
            </div>
          </details>
        )}
      </section>

      <section className="section" id="citations">
        <div className="section-titre">
          <h2 style={{ fontSize: "1.15rem" }}>Ce qui la cite</h2>
        </div>
        <p className="legende">
          À lire avant de la désactiver ou de supprimer son dépôt. Désactivée, elle quitte les listes de rattachement sans
          rien effacer, et ses modules ne sont plus proposés à aucun profil.{" "}
          {fiche
            ? "Supprimer le dépôt d'une filière de la fiche lui rend ses valeurs d'origine."
            : "Supprimer le dépôt d'une filière ajoutée laisse ces lignes citer un identifiant inconnu."}
        </p>
        <ul className="liste-nue citations-filiere">
          <li>
            <strong>{f.id === SOCLE ? troncCommun.length : dans.length}</strong> module
            {(f.id === SOCLE ? troncCommun.length : dans.length) > 1 ? "s" : ""} au programme
          </li>
          <li>
            <strong>{niveauxAffiches.length}</strong> niveau{niveauxAffiches.length > 1 ? "x" : ""}
            {niveauxAffiches.length > 0 ? ` : ${niveauxAffiches.map((n) => n.code).join(", ")}` : ""}
          </li>
          <li>
            <strong>{citations.documents.length}</strong> document{citations.documents.length > 1 ? "s" : ""} déposé
            {citations.documents.length > 1 ? "s" : ""}
            {citations.documents.length > 0 ? ` : ${citations.documents.join(", ")}` : ""}
          </li>
          <li>
            <strong>{citations.codes.length}</strong> code{citations.codes.length > 1 ? "s" : ""} d&apos;accès actif
            {citations.codes.length > 1 ? "s" : ""}
            {citations.codes.length > 0 ? ` : ${citations.codes.join(", ")}` : ""}
          </li>
          <li>
            <strong>{citations.ordres.length}</strong> ordre{citations.ordres.length > 1 ? "s" : ""} de profil
            {citations.ordres.length > 0
              ? ` : ${citations.ordres.map((o) => `${o.niveau} · ${o.parcours === "maintien" ? "maintien" : "intégration"}`).join(", ")}`
              : ""}
            {citations.ordresApprenants > 0 ? `, et ${citations.ordresApprenants} ordre${citations.ordresApprenants > 1 ? "s" : ""} propre${citations.ordresApprenants > 1 ? "s" : ""} à des apprenants` : ""}
          </li>
          <li>
            <strong>{citations.questions}</strong> question{citations.questions > 1 ? "s" : ""} étiquetée
            {citations.questions > 1 ? "s" : ""} de ce profil
          </li>
        </ul>
      </section>
    </>
  );
}
