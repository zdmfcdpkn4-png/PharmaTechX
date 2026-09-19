"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSessionFormation, type ResultatSession } from "./SessionFormation";
import { telechargerRapport, type EnTeteRapport } from "@/lib/rapport";
import { LIBELLES_COURTS_VERDICT } from "@/lib/decision";
import { normaliserIdentifiant } from "@/lib/identifiant";
import { actionEmettreRapport } from "@/app/actions-rapports";
import { libelleNature } from "@/content/types";

export interface ModuleResume {
  id: string;
  titre: string;
  objectif: string;
  bloc: string;
  critereId: string;
  affectation: "tronc-commun" | "poste";
  postes: string[];
  niveaux: string[];
  dureeMinutes: string;
  redige: boolean;
  nbQuestions: number;
  nbSituations: number;
  periodiciteMois: string;
  /** `base` pour un module déposé depuis l'administration. */
  origine?: "code" | "base";
}

/** Document général, proposé par profil (filières et niveaux ; vides = tous). */
export interface DocumentResume {
  id: number;
  titre: string;
  nature: string;
  url: string;
  filieres: string[];
  niveaux: string[];
}


export interface PosteResume {
  id: string;
  libelle: string;
  niveauxRequis: string[];
}

export interface NiveauResume {
  code: string;
  libelle: string;
  filiere: string;
}

const A_PRECISER = "[à préciser]";

function Marqueur({ valeur }: { valeur: string }) {
  if (valeur === A_PRECISER) {
    return <code className="a-preciser">{A_PRECISER}</code>;
  }
  return <>{valeur}</>;
}

function CarteModule({ m }: { m: ModuleResume }) {
  const { dernierPourModule } = useSessionFormation();
  const resultat = dernierPourModule(m.id);
  const evaluable = m.nbQuestions > 0;

  const corps = (
    <article className={`carte carte--module${m.redige ? "" : " est-vide"}`}>
      <ul className="meta-module">
        {m.origine === "base" && <li className="etiquette etiquette--site">Module déposé</li>}
        {m.origine === "base" && m.critereId === A_PRECISER ? null : (
          <>
            <li className="etiquette etiquette--neutre">
              Bloc <Marqueur valeur={m.bloc} />
            </li>
            <li className="etiquette etiquette--neutre">
              Critère <Marqueur valeur={m.critereId} />
            </li>
          </>
        )}
        {evaluable ? (
          <li className="etiquette">
            {m.nbQuestions} question{m.nbQuestions > 1 ? "s" : ""}
            {m.nbSituations > 0 ? ` · ${m.nbSituations} mise${m.nbSituations > 1 ? "s" : ""} en situation` : ""}
          </li>
        ) : null}
        {!m.redige && <li className="etiquette etiquette--attention">Module à rédiger</li>}
      </ul>

      <h3>{m.titre}</h3>
      <p className="objectif">
        <Marqueur valeur={m.objectif} />
      </p>

      {resultat && (
        <p className={`resultat-ligne ${resultat.reussi ? "ok" : "ko"}`} aria-live="polite">
          <strong>{resultat.score}&nbsp;%</strong> — critère {LIBELLES_COURTS_VERDICT[resultat.verdict]}
          {resultat.echecEliminatoire && " (question éliminatoire manquée)"}
          {resultat.verdict === "indetermine" && " — arbitrage du tuteur au visa"}
        </p>
      )}

      <p className="legende">
        Niveaux&nbsp;: <Marqueur valeur={m.niveaux.join(", ")} /> · Revalidation tous les{" "}
        <Marqueur valeur={m.periodiciteMois} /> mois
        {!m.redige && evaluable ? " · évaluation disponible sans le texte du module" : ""}
      </p>
    </article>
  );

  return m.redige || evaluable ? (
    <Link href={`/module/${m.id}`} className="carte-lien">
      {corps}
    </Link>
  ) : (
    corps
  );
}

/** Un grand module de la fiche : son numéro de bloc et son intitulé. */
export interface BlocResume {
  numero: string;
  titre: string;
}

interface GroupeModules {
  cle: string;
  numero: string;
  titre: string;
  modules: ModuleResume[];
}

/**
 * Regroupe les critères par grand module (question 37, choix c) : la liste
 * plate faisait à elle seule près de la moitié du défilement de l'accueil sur
 * téléphone. L'ordre est celui de la fiche ; un bloc inconnu — module déposé
 * sans rattachement — passe en fin de liste.
 */
function grouperParBloc(
  liste: ModuleResume[],
  blocs: BlocResume[],
  prefixe: string,
): GroupeModules[] {
  const rang = new Map(blocs.map((b, i) => [b.numero, i]));
  const par = new Map<string, ModuleResume[]>();
  for (const m of liste) {
    const deja = par.get(m.bloc);
    if (deja) deja.push(m);
    else par.set(m.bloc, [m]);
  }
  return [...par.entries()]
    .sort((a, b) => (rang.get(a[0]) ?? 999) - (rang.get(b[0]) ?? 999))
    .map(([numero, modules]) => ({
      cle: `${prefixe}:${numero}`,
      numero,
      titre: blocs.find((b) => b.numero === numero)?.titre ?? "",
      modules,
    }));
}

function GroupesModules({
  groupes,
  estOuvert,
  basculer,
}: {
  groupes: GroupeModules[];
  estOuvert: (cle: string, parDefaut: boolean) => boolean;
  basculer: (cle: string, ouvert: boolean) => void;
}) {
  return (
    <div className="groupes-modules">
      {groupes.map((g, i) => (
        <details
          key={g.cle}
          className="bloc groupe-modules"
          open={estOuvert(g.cle, i === 0)}
          onToggle={(e) => basculer(g.cle, e.currentTarget.open)}
        >
          <summary>
            Bloc <Marqueur valeur={g.numero} />
            {g.titre ? ` — ${g.titre}` : ""}
            <span className="etiquette etiquette--neutre">
              {g.modules.length} critère{g.modules.length > 1 ? "s" : ""}
            </span>
          </summary>
          <div className="contenu-bloc">
            <div className="grille">
              {g.modules.map((m) => (
                <CarteModule key={m.id} m={m} />
              ))}
            </div>
          </div>
        </details>
      ))}
    </div>
  );
}

/** Repli des grands modules, gardé le temps de la session, sur ce poste. */
const CLE_GROUPES = "fp-groupes-ouverts";

function nombre(n: number): string {
  return String(Math.round(n * 100) / 100).replace(".", ",");
}

export function TableauDeBord({
  troncCommun,
  parPoste,
  postes,
  niveaux,
  blocs,
  parcoursTitre,
  conservation,
  procedure,
  miseEnService,
  documents = [],
  filiereInitiale = "",
  niveauInitial = "",
  identifiantRattache = null,
  documentsReserves = 0,
}: {
  troncCommun: ModuleResume[];
  parPoste: Record<string, ModuleResume[]>;
  postes: PosteResume[];
  niveaux: NiveauResume[];
  /** Grands modules de la fiche, pour le regroupement des critères. */
  blocs: BlocResume[];
  parcoursTitre: string;
  conservation: "aucune" | "pseudonyme";
  /** Référence de la procédure interne, portée sur les rapports téléchargés. */
  procedure: string | null;
  /** Date de mise en service ; absente, les rapports portent « phase d'essai ». */
  miseEnService: string | null;
  /** Documents généraux déposés, proposés selon la filière et le niveau choisis. */
  documents?: DocumentResume[];
  /** Filière et niveau du code de poste de la session, présélectionnés. */
  filiereInitiale?: string;
  niveauInitial?: string;
  /** Progression rattachée (question 11) : l'émission se fait sous cet identifiant, sans le ressaisir. */
  identifiantRattache?: string | null;
  /** Documents généraux existants mais réservés aux sessions par code (question 13) : leur nombre, sans session. */
  documentsReserves?: number;
}) {
  const [posteId, setPosteId] = useState<string>(filiereInitiale);
  const [niveauCode, setNiveauCode] = useState<string>(niveauInitial);
  const { resultats, emissions, marquerEmis, cleEmission } = useSessionFormation();
  const pseudonyme = conservation === "pseudonyme";
  // Mode « aucune » : nom et qualité restent sur le poste, pour l'en-tête du
  // fichier téléchargé. Mode pseudonyme : seul l'identifiant d'agent est saisi
  // et transmis ; aucun nom, ni ici ni en base (décision du 18/09/2026).
  const [nom, setNom] = useState("");
  const [qualite, setQualite] = useState("");
  const [identifiant, setIdentifiant] = useState(identifiantRattache ?? "");
  const [enCours, setEnCours] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  // Replis des grands modules : premier groupe ouvert par défaut, choix de
  // l'agent gardé le temps de la session (jamais nominatif, jamais transmis).
  const [ouverts, setOuverts] = useState<Record<string, boolean>>({});
  const [replisLus, setReplisLus] = useState(false);

  useEffect(() => {
    try {
      const brut = sessionStorage.getItem(CLE_GROUPES);
      if (brut) setOuverts(JSON.parse(brut) as Record<string, boolean>);
    } catch {
      /* stockage refusé : les replis par défaut suffisent */
    }
    setReplisLus(true);
  }, []);

  useEffect(() => {
    if (!replisLus) return;
    try {
      sessionStorage.setItem(CLE_GROUPES, JSON.stringify(ouverts));
    } catch {
      /* stockage refusé : le repli reste valable pour la page en cours */
    }
  }, [ouverts, replisLus]);

  const estOuvert = (cle: string, parDefaut: boolean) => ouverts[cle] ?? parDefaut;
  const basculer = (cle: string, ouvert: boolean) =>
    setOuverts((o) => (o[cle] === ouvert ? o : { ...o, [cle]: ouvert }));
  const deplierTout = (groupes: GroupeModules[], valeur: boolean) =>
    setOuverts((o) => {
      const suite = { ...o };
      for (const g of groupes) suite[g.cle] = valeur;
      return suite;
    });
  const tousOuverts = (groupes: GroupeModules[]) =>
    groupes.length > 0 && groupes.every((g, i) => estOuvert(g.cle, i === 0));
  const BoutonReplis = ({ groupes }: { groupes: GroupeModules[] }) =>
    groupes.length > 1 ? (
      <button
        type="button"
        className="bouton bouton--compact bouton--discret"
        onClick={() => deplierTout(groupes, !tousOuverts(groupes))}
      >
        {tousOuverts(groupes) ? "Tout replier" : "Tout déplier"}
      </button>
    ) : null;

  const parNiveau = (liste: ModuleResume[]) =>
    niveauCode ? liste.filter((m) => m.niveaux.includes(niveauCode)) : liste;

  const socle = parNiveau(troncCommun);
  const modulesPoste = parNiveau(posteId ? (parPoste[posteId] ?? []) : []);

  const programme = useMemo(() => [...socle, ...modulesPoste], [socle, modulesPoste]);
  const groupesSocle = useMemo(() => grouperParBloc(socle, blocs, "socle"), [socle, blocs]);
  const groupesPoste = useMemo(
    () => grouperParBloc(modulesPoste, blocs, "poste"),
    [modulesPoste, blocs],
  );
  // Un document sans profil est proposé à tous ; sinon il suit la filière et le niveau choisis.
  const documentsVisibles = documents.filter(
    (d) =>
      (d.filieres.length === 0 || (posteId !== "" && d.filieres.includes(posteId))) &&
      (d.niveaux.length === 0 || niveauCode === "" || d.niveaux.includes(niveauCode)),
  );

  const evaluables = programme.filter((m) => m.nbQuestions > 0);
  const evalues = new Set(resultats.map((r) => r.moduleId));
  const acquis = resultats.filter((r) => r.reussi).length;
  const avancement =
    evaluables.length === 0
      ? 0
      : Math.round((evaluables.filter((m) => evalues.has(m.id)).length / evaluables.length) * 100);

  const parcoursLibelle = `${parcoursTitre}${
    posteId ? ` — ${postes.find((p) => p.id === posteId)?.libelle}` : " — tronc commun"
  }`;

  const entete = (): EnTeteRapport =>
    pseudonyme
      ? { identifiant: normaliserIdentifiant(identifiant) ?? undefined, nom: "", qualite: "", parcours: parcoursLibelle }
      : { nom, qualite, parcours: parcoursLibelle };

  const optionsDe = (r: ResultatSession) => {
    const e = emissions[cleEmission(r)];
    return e
      ? {
          numero: e.numero,
          empreinte: e.empreinte,
          conservation,
          procedure,
          miseEnService,
          visas: [{ qualite: "apprenant" as const, signataire: e.identifiant, date: e.emisLe }],
        }
      : { conservation, procedure, miseEnService };
  };

  const emettre = async (r: ResultatSession) => {
    setErreur(null);
    if (!normaliserIdentifiant(identifiant)) {
      setErreur("Saisissez votre identifiant d'agent (AG-001, AG-002…), remis par votre tuteur, pour émettre un rapport enregistré.");
      return;
    }
    setEnCours(cleEmission(r));
    try {
      const { tentative: _t, ...resultat } = r;
      const rep = await actionEmettreRapport({ resultat, identifiant });
      if (!rep.ok) {
        setErreur(rep.erreur);
        return;
      }
      marquerEmis(r, { id: rep.id, numero: rep.numero, empreinte: rep.empreinte, emisLe: rep.emisLe, identifiant: rep.identifiant });
    } catch {
      setErreur("L'émission a échoué. Réessayez, ou téléchargez le rapport sans l'enregistrer.");
    } finally {
      setEnCours(null);
    }
  };

  return (
    <>
      <section className="carte" id="composer" aria-labelledby="t-filtres">
        <h2 id="t-filtres">Composer le programme</h2>
        <p className="legende">
          Le programme d&apos;un agent se compose du socle transversal (blocs 1 et 3), exigé de
          tous, puis des critères de sa filière et de son niveau — conformément au chapitre III de
          la fiche d&apos;habilitation.
        </p>

        <div className="rangee">
          <label className="champ">
            <span>Filière</span>
            <select value={posteId} onChange={(e) => setPosteId(e.target.value)}>
              <option value="">Socle transversal seul</option>
              {postes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.libelle}
                </option>
              ))}
            </select>
          </label>

          <label className="champ">
            <span>Niveau visé</span>
            <select value={niveauCode} onChange={(e) => setNiveauCode(e.target.value)}>
              <option value="">Tous niveaux</option>
              {niveaux.map((n) => (
                <option key={n.code} value={n.code}>
                  {n.libelle}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <div className="tuiles">
        <div className="tuile">
          <span className="valeur">{programme.length}</span>
          <span className="libelle">critères au programme</span>
        </div>
        <div className="tuile">
          <span className="valeur">{evaluables.length}</span>
          <span className="libelle">évaluations disponibles</span>
        </div>
        <div className="tuile">
          <span className="valeur">{resultats.length}</span>
          <span className="libelle">évaluations passées</span>
        </div>
        <div className="tuile">
          <span className="valeur">{acquis}</span>
          <span className="libelle">critères acquis</span>
        </div>
      </div>

      <div className="avancement" aria-hidden="true">
        <span style={{ width: `${avancement}%` }} />
      </div>
      <p className="legende">
        {avancement}&nbsp;% des évaluations disponibles ont été passées dans cette session —{" "}
        {parcoursTitre.toLowerCase()}. Ce n&apos;est pas un avancement d&apos;habilitation.
      </p>

      <div className="section-titre">
        <h2>Socle transversal</h2>
        <span className="compte">
          {socle.length} critère{socle.length > 1 ? "s" : ""} — blocs 1 et 3, prérequis aux deux
          parcours
        </span>
        <BoutonReplis groupes={groupesSocle} />
      </div>
      <GroupesModules groupes={groupesSocle} estOuvert={estOuvert} basculer={basculer} />

      <div className="section-titre">
        <h2>Critères de la filière</h2>
        <span className="compte">
          {posteId ? `${modulesPoste.length} critère(s)` : "aucune filière choisie"}
        </span>
        {posteId ? <BoutonReplis groupes={groupesPoste} /> : null}
      </div>
      {posteId ? (
        <GroupesModules groupes={groupesPoste} estOuvert={estOuvert} basculer={basculer} />
      ) : (
        <p className="encart">
          Choisir une filière ci-dessus — Chimiothérapie, Préparatoire ou Encadrement — pour
          afficher les critères qui s&apos;y rattachent.
        </p>
      )}

      {documentsReserves > 0 && documents.length === 0 && (
        <>
          <div className="section-titre">
            <h2>Documents du profil</h2>
            <span className="compte">{documentsReserves} document{documentsReserves > 1 ? "s" : ""}</span>
          </div>
          <p className="encart">
            Les documents déposés sont réservés aux sessions ouvertes par un code :{" "}
            <Link href="/connexion">connectez-vous</Link> avec votre code de poste pour les lire.
          </p>
        </>
      )}

      {documents.length > 0 && (
        <>
          <div className="section-titre">
            <h2>Documents du profil</h2>
            <span className="compte">
              {documentsVisibles.length} document{documentsVisibles.length > 1 ? "s" : ""}
            </span>
          </div>
          {documentsVisibles.length > 0 ? (
            <ul className="liste-nue documents-profil">
              {documentsVisibles.map((d) => (
                <li key={d.id} className="carte">
                  <span className="etiquette etiquette--neutre">{libelleNature(d.nature)}</span>{" "}
                  <a href={d.url} target="_blank" rel="noreferrer">
                    {d.titre}
                  </a>
                  {d.filieres.length > 0 || d.niveaux.length > 0 ? (
                    <span className="legende"> — {[...d.filieres, ...d.niveaux].join(", ")}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="encart">Aucun document général pour cette filière et ce niveau.</p>
          )}
        </>
      )}

      <div className="section-titre" id="rapport">
        <h2>{identifiantRattache ? "Mes évaluations" : "Rapport de session"}</h2>
        <span className="compte">
          {resultats.length} évaluation(s){identifiantRattache ? ` · conservées sous ${identifiantRattache}` : ""}
        </span>
      </div>
      <section className="carte">
        {miseEnService ? (
          <p className="legende">
            Le rapport est un <strong>document qualité</strong> : preuve de l&apos;étape 2 au dossier
            d&apos;habilitation, opposable en audit (décision du 18/09/2026). Il ne vaut pas habilitation.
          </p>
        ) : (
          <p className="encart encart--attention">
            <strong>Phase d&apos;essai :</strong> aucun rapport ne vaut preuve tant que la mise en service
            n&apos;est pas prononcée. Les rapports portent la mention en clair.
          </p>
        )}
        {pseudonyme ? (
          <p>
            Deux issues pour chaque évaluation : <strong>télécharger</strong> le rapport sur ce
            poste, ou <strong>l&apos;émettre</strong> — il est alors enregistré sous votre
            identifiant d&apos;agent, numéroté, scellé et soumis au visa du tuteur puis du
            pharmacien responsable. <strong>Aucun nom n&apos;est enregistré</strong> : la
            correspondance entre l&apos;identifiant et vous est tenue par le pharmacien
            responsable, hors du site, et votre nom n&apos;est porté qu&apos;à l&apos;impression du
            rapport. <Link href="/donnees-personnelles">Vos données et vos droits</Link>. Les
            entraînements n&apos;apparaissent pas ici.
          </p>
        ) : (
          <p>
            Le rapport reprend chaque critère évalué, sa note et le détail question par question.
            Il est écrit sur le poste de l&apos;apprenant : le nom saisi ci-dessous n&apos;est
            envoyé nulle part, il ne sert qu&apos;à renseigner l&apos;en-tête du fichier. Les
            entraînements n&apos;apparaissent pas ici.
          </p>
        )}

        {pseudonyme ? (
          <div className="rangee">
            <label className="champ">
              <span>Identifiant d&apos;agent</span>
              <input
                type="text"
                name="identifiant"
                value={identifiant}
                onChange={(e) => setIdentifiant(e.target.value)}
                placeholder="AG-001"
                autoComplete="off"
                inputMode="text"
                readOnly={Boolean(identifiantRattache)}
              />
            </label>
            <p className="legende" style={{ alignSelf: "end", margin: 0 }}>
              {identifiantRattache ? (
                <>
                  Progression rattachée : les rapports s&apos;émettent sous cet identifiant.{" "}
                  <Link href="/#progression">Se détacher</Link>.
                </>
              ) : (
                <>
                  Remis par votre tuteur. Vérifiez-le avant d&apos;émettre : le tuteur contrôle la
                  correspondance à son visa, et un rapport mal rattaché s&apos;annule.
                </>
              )}
            </p>
          </div>
        ) : (
          <div className="rangee">
            <label className="champ">
              <span>Nom de l&apos;apprenant</span>
              <input
                type="text"
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                placeholder="Nom Prénom"
                autoComplete="off"
              />
            </label>
            <label className="champ">
              <span>Qualité</span>
              <input
                type="text"
                value={qualite}
                onChange={(e) => setQualite(e.target.value)}
                placeholder="Préparateur, interne, niveau visé…"
                autoComplete="off"
              />
            </label>
          </div>
        )}

        {erreur && (
          <p className="encart encart--attention" role="alert">
            {erreur}
          </p>
        )}

        {resultats.length > 0 && (
          <ul className="liste-nue" style={{ margin: "1rem 0" }}>
            {resultats.map((r) => {
              const e = emissions[cleEmission(r)];
              return (
                <li key={cleEmission(r)} className="ligne-rapport">
                  <div>
                    <strong>{r.moduleTitre}</strong>
                    <br />
                    <span className="legende">
                      {r.critereId ? `${r.critereId} · ` : ""}
                      {r.tirage} · tentative {r.tentative} · {r.score} % ({nombre(r.pointsObtenus)} /{" "}
                      {r.pointsTotal}) · {LIBELLES_COURTS_VERDICT[r.verdict]} · {r.horodatage}
                      {e ? ` · émis sous le n° ${e.numero}` : ""}
                      {pseudonyme && r.verdict === "non_concluant"
                        ? ` · tirage non concluant : pas d'émission (${r.minQuestions} questions requises)`
                        : ""}
                    </span>
                  </div>
                  <div className="actions" style={{ marginTop: ".5rem" }}>
                    <button
                      type="button"
                      className="bouton bouton--compact bouton--secondaire"
                      onClick={() => void telechargerRapport(entete(), [r], optionsDe(r))}
                    >
                      Télécharger
                    </button>
                    {pseudonyme && !e && r.verdict !== "non_concluant" && (
                      <button
                        type="button"
                        className="bouton bouton--compact"
                        disabled={enCours === cleEmission(r)}
                        onClick={() => void emettre(r)}
                      >
                        {enCours === cleEmission(r) ? "Émission…" : "Émettre et enregistrer"}
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <div className="actions">
          <button
            type="button"
            className="bouton"
            disabled={resultats.length === 0}
            onClick={() => void telechargerRapport(entete(), resultats, { conservation, procedure, miseEnService })}
          >
            Télécharger le rapport de session
          </button>
          {resultats.length === 0 && (
            <span className="legende">Aucune évaluation passée dans cette session.</span>
          )}
        </div>
      </section>
    </>
  );
}
