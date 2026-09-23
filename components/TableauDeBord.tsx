"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSessionFormation, type ResultatSession } from "./SessionFormation";
import { telechargerRapport, type EnTeteRapport } from "@/lib/rapport";
import { LIBELLES_COURTS_VERDICT } from "@/lib/decision";
import { normaliserIdentifiant } from "@/lib/identifiant";
import { IDENTIFIANT_ESSAI, LIBELLE_ESSAI, MENTION_ESSAI } from "@/lib/essai";
import { actionEmettreRapport } from "@/app/actions-rapports";
import { libelleNature } from "@/content/types";
import { MENTION_DEGRADE, libelleProgramme } from "@/content/programmes";
import { chronologie, cleProfil, ordreApplicable, requeteProfil } from "@/content/ordres";
import type { TypeParcours } from "@/content/types";
import { BarreBadges } from "./BarreBadges";
import { Badge } from "./Badge";
import {
  AUCUN_FILTRE,
  LIBELLES_AVANCEMENT,
  LIBELLES_ETAT,
  avancementDe,
  etatModule,
  filtrerModules,
  filtresActifs,
  type Avancement,
  type EtatModule,
  type FiltresModules,
} from "@/content/tableau";

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
  /** Illustration effective du module (barre de progression du parcours). */
  badge?: string;
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

/**
 * Programme à la carte ouvert à l'accueil (question 50) : ses modules, dans
 * son ordre, et ce qui le distingue des parcours de la fiche.
 */
export interface ProgrammeALaCarte {
  id: number;
  nom: string;
  destinataire: string;
  motif: string;
  validePar: string | null;
  /** Date de validation, déjà lisible. */
  valideLe: string | null;
  modules: ModuleResume[];
  /** Modules du programme introuvables ou dépubliés : comptés, pas devinés. */
  absents: number;
}

/**
 * Carte d'un module (22/09/2026) : son illustration en vignette, là où elle
 * se lit (72 px, `content/badges.ts`), et son état en tête — terminé, en
 * cours, à venir — pour qu'un coup d'œil sur la grille suffise.
 */
function CarteModule({
  m,
  etat,
  rang,
  requete = "",
}: {
  m: ModuleResume;
  etat: EtatModule;
  rang?: number;
  requete?: string;
}) {
  const { dernierPourModule } = useSessionFormation();
  const resultat = dernierPourModule(m.id);
  const evaluable = m.nbQuestions > 0;

  const corps = (
    <article className={`carte carte--module carte--${avancementDe(etat)}${m.redige ? "" : " est-vide"}`}>
      <div className="carte-module-tete">
        <span className="carte-module-vignette" aria-hidden="true">
          {m.badge ? <Badge nom={m.badge} taille={72} /> : <span className="vignette-vide">{m.critereId === A_PRECISER ? "·" : m.critereId}</span>}
        </span>
        <span className={`etat-module etat-module--${etat}`}>{LIBELLES_ETAT[etat]}</span>
      </div>
      <ul className="meta-module">
        {rang ? <li className="etiquette">n° {rang}</li> : null}
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
        {!m.redige && etat !== "a-rediger" && <li className="etiquette etiquette--attention">Texte à rédiger</li>}
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
    <Link href={`/module/${m.id}${requete}`} className="carte-lien">
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
  etatDe,
}: {
  groupes: GroupeModules[];
  estOuvert: (cle: string, parDefaut: boolean) => boolean;
  basculer: (cle: string, ouvert: boolean) => void;
  etatDe: (m: ModuleResume) => EtatModule;
}) {
  return (
    <div className="groupes-modules">
      {groupes.map((g, i) => {
        // Avancement du grand module : ses critères acquis sur son total.
        const acquis = g.modules.filter((m) => etatDe(m) === "acquis").length;
        return (
          <details
            key={g.cle}
            className="bloc groupe-modules"
            open={estOuvert(g.cle, i === 0)}
            onToggle={(e) => basculer(g.cle, e.currentTarget.open)}
          >
            <summary>
              <span className="groupe-titre">
                Bloc <Marqueur valeur={g.numero} />
                {g.titre ? ` — ${g.titre}` : ""}
              </span>
              <span className="groupe-avancement">
                <span className="groupe-jauge" aria-hidden="true">
                  <span style={{ width: `${Math.round((acquis / g.modules.length) * 100)}%` }} />
                </span>
                <span className="etiquette etiquette--neutre">
                  {acquis} / {g.modules.length} acquis
                </span>
              </span>
            </summary>
            <div className="contenu-bloc">
              <div className="grille">
                {g.modules.map((m) => (
                  <CarteModule key={m.id} m={m} etat={etatDe(m)} />
                ))}
              </div>
            </div>
          </details>
        );
      })}
    </div>
  );
}

/** Repli des grands modules, gardé le temps de la session, sur ce poste. */
const CLE_GROUPES = "fp-groupes-ouverts";

/** « A, B ou C » : les filières proposées, dites dans une phrase. */
function enumerer(libelles: string[]): string {
  return libelles.length <= 1
    ? (libelles[0] ?? "")
    : `${libelles.slice(0, -1).join(", ")} ou ${libelles[libelles.length - 1]}`;
}

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
  aLaCarte = null,
  essai = false,
  parcours = "integration",
  ordresProfil = {},
  ordresApprenant = {},
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
  /** Programme à la carte ouvert (question 50) : il remplace la composition par filière et niveau. */
  aLaCarte?: ProgrammeALaCarte | null;
  /**
   * Mode test (23/09/2026) : émission sous « Utilisateur test », numéro
   * ESSAI-…, sans enregistrement ; chaque rapport porte le filigrane d'essai.
   */
  essai?: boolean;
  /** Parcours affiché : il entre dans l'adresse des modules d'un profil qui a son ordre. */
  parcours?: TypeParcours;
  /**
   * Ordres des profils de ce parcours (question 55, choix a), par clé
   * « filière|niveau » : le profil choisi qui a le sien voit ses modules
   * numérotés dans cet ordre, socle et filière mêlés.
   */
  ordresProfil?: Record<string, string[]>;
  /**
   * Ordres propres à l'apprenant rattaché (question 56, choix a), par la même
   * clé : ils passent avant ceux des profils.
   */
  ordresApprenant?: Record<string, string[]>;
}) {
  const [posteId, setPosteId] = useState<string>(filiereInitiale);
  const [niveauCode, setNiveauCode] = useState<string>(niveauInitial);
  const { resultats, emissions, marquerEmis, cleEmission, dernierPourModule } = useSessionFormation();
  const pseudonyme = conservation === "pseudonyme";
  // Mode « aucune » : nom et qualité restent sur le poste, pour l'en-tête du
  // fichier téléchargé. Mode pseudonyme : seul l'identifiant d'agent est saisi
  // et transmis ; aucun nom, ni ici ni en base (décision du 18/09/2026).
  const [nom, setNom] = useState("");
  const [qualite, setQualite] = useState("");
  const [identifiant, setIdentifiant] = useState(essai ? IDENTIFIANT_ESSAI : (identifiantRattache ?? ""));
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

  // Repères de lecture posés sur ce poste (`LectureModule`) : un module dont
  // la lecture est entamée est « en cours ». Lus après le montage seulement.
  const [lectures, setLectures] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    try {
      const ids = new Set<string>();
      for (let i = 0; i < localStorage.length; i++) {
        const cle = localStorage.key(i) ?? "";
        if (cle.startsWith("fp-lecture-") && cle !== "fp-lecture-dernier") ids.add(cle.slice("fp-lecture-".length));
      }
      setLectures(ids);
    } catch {
      /* stockage refusé : l'état se lit sur les seules évaluations */
    }
  }, []);
  const etatDe = (m: ModuleResume): EtatModule => etatModule(m, dernierPourModule(m.id), lectures.has(m.id));

  // Recherche et filtres (22/09/2026) : dans le programme affiché.
  const [filtres, setFiltres] = useState<FiltresModules>(AUCUN_FILTRE);
  const actifs = filtresActifs(filtres);

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

  const cleChoisie = !aLaCarte && posteId && niveauCode ? cleProfil(posteId, niveauCode) : "";
  const ordreChoisi = cleChoisie ? ordreApplicable(ordresApprenant[cleChoisie], ordresProfil[cleChoisie]) : null;
  const ordreProfil = ordreChoisi?.ordre;
  const programme = useMemo(
    () =>
      aLaCarte
        ? aLaCarte.modules
        : ordreProfil
          ? chronologie([...socle, ...modulesPoste], ordreProfil)
          : [...socle, ...modulesPoste],
    [aLaCarte, socle, modulesPoste, ordreProfil],
  );
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

  const titreBloc = (numero: string) => blocs.find((b) => b.numero === numero)?.titre ?? "";
  const blocsPresents = blocs.filter((b) => programme.some((m) => m.bloc === b.numero));
  const trouves = actifs ? filtrerModules(programme, filtres, etatDe, titreBloc) : [];
  const requeteCarte = aLaCarte
    ? `?programme=${aLaCarte.id}`
    : ordreProfil
      ? requeteProfil({ parcours, filiere: posteId, niveau: niveauCode })
      : "";

  const evaluables = programme.filter((m) => m.nbQuestions > 0);
  const acquis = resultats.filter((r) => r.reussi).length;

  // Porté sur le rapport téléchargé : un programme à la carte y paraît avec
  // sa mention de parcours dégradé et sa validation.
  const parcoursLibelle = aLaCarte
    ? `${libelleProgramme(aLaCarte)}${aLaCarte.validePar ? `, validé par ${aLaCarte.validePar}${aLaCarte.valideLe ? ` le ${aLaCarte.valideLe}` : ""}` : ""}`
    : `${parcoursTitre}${posteId ? ` — ${postes.find((p) => p.id === posteId)?.libelle}` : " — tronc commun"}`;

  const entete = (): EnTeteRapport =>
    essai
      ? { identifiant: IDENTIFIANT_ESSAI, nom: LIBELLE_ESSAI, qualite: "", parcours: parcoursLibelle }
      : pseudonyme
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
          essai,
          visas: [{ qualite: "apprenant" as const, signataire: e.identifiant, date: e.emisLe }],
        }
      : { conservation, procedure, miseEnService, essai };
  };

  const emettre = async (r: ResultatSession) => {
    setErreur(null);
    if (!essai && !normaliserIdentifiant(identifiant)) {
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
      {aLaCarte ? (
        <section className="carte bandeau-degrade" id="composer" aria-labelledby="t-carte">
          <p className="sur-titre" style={{ marginTop: 0 }}>
            <span className="etiquette etiquette--attention">{MENTION_DEGRADE}</span>
          </p>
          <h2 id="t-carte">Programme à la carte « {aLaCarte.nom} »</h2>
          {aLaCarte.destinataire && <p style={{ margin: "0 0 .5rem" }}>Pour : {aLaCarte.destinataire}.</p>}
          {aLaCarte.motif && (
            <p className="legende" style={{ margin: "0 0 .5rem", maxWidth: "66ch" }}>
              Écart à la fiche : {aLaCarte.motif}
            </p>
          )}
          <p className="encart encart--attention" style={{ margin: 0 }}>
            Programme composé à la main, hors des deux parcours de la fiche d&apos;habilitation
            {aLaCarte.validePar ? `, validé par ${aLaCarte.validePar}${aLaCarte.valideLe ? ` le ${aLaCarte.valideLe}` : ""}` : ""}. Il ne
            conduit pas, à lui seul, à un niveau de la fiche : le pharmacien responsable en tient compte au
            dossier d&apos;habilitation.
          </p>
        </section>
      ) : (
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
      )}

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

      {/* Barre de progression du parcours (22/09/2026) : les badges des
          modules, en couleur quand le critère est acquis, grisés sinon. */}
      <BarreBadges
        etapes={programme.map((m) => ({
          id: m.id,
          titre: m.titre,
          critereId: m.critereId,
          badge: m.badge,
          evaluable: m.nbQuestions > 0,
        }))}
        requete={requeteCarte}
      />

      {/* Recherche et filtres (22/09/2026) : texte, bloc, avancement, dans le
          programme affiché. Aucun filtre de durée : deux modules sur
          cinquante et un en portent une, les autres sont [à préciser]. */}
      <section className="carte recherche-modules" aria-labelledby="t-recherche">
        <h2 id="t-recherche" className="lecture-seule">Rechercher un module</h2>
        <div className="recherche-rangee">
          <label className="champ recherche-texte">
            <span>Rechercher un module</span>
            <input
              type="search"
              value={filtres.texte}
              onChange={(e) => setFiltres((f) => ({ ...f, texte: e.target.value }))}
              placeholder="Titre, critère (B1-02), mot-clé…"
              autoComplete="off"
              enterKeyHint="search"
            />
          </label>
          <label className="champ">
            <span>Bloc</span>
            <select value={filtres.bloc} onChange={(e) => setFiltres((f) => ({ ...f, bloc: e.target.value }))}>
              <option value="">Tous</option>
              {blocsPresents.map((b) => (
                <option key={b.numero} value={b.numero}>
                  Bloc {b.numero}
                  {b.titre ? ` — ${b.titre}` : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="champ">
            <span>Avancement</span>
            <select
              value={filtres.avancement}
              onChange={(e) => setFiltres((f) => ({ ...f, avancement: e.target.value as "" | Avancement }))}
            >
              <option value="">Tous</option>
              {(["en-cours", "a-venir", "termine"] as const).map((a) => (
                <option key={a} value={a}>
                  {LIBELLES_AVANCEMENT[a]}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {actifs ? (
        <>
          <div className="section-titre">
            <h2>Résultats</h2>
            <span className="compte" role="status">
              {trouves.length} module{trouves.length > 1 ? "s" : ""} sur {programme.length}
            </span>
            <button type="button" className="bouton bouton--compact bouton--discret" onClick={() => setFiltres(AUCUN_FILTRE)}>
              Effacer la recherche
            </button>
          </div>
          {trouves.length > 0 ? (
            <div className="grille">
              {trouves.map((m) => (
                <CarteModule key={m.id} m={m} etat={etatDe(m)} requete={requeteCarte} />
              ))}
            </div>
          ) : (
            <p className="encart">
              Aucun module du programme affiché ne correspond.
              {aLaCarte ? "" : " Changez la filière ou le niveau ci-dessus pour chercher ailleurs."}
            </p>
          )}
        </>
      ) : aLaCarte ? (
        <>
          <div className="section-titre">
            <h2>Modules du programme</h2>
            <span className="compte">
              {aLaCarte.modules.length} module{aLaCarte.modules.length > 1 ? "s" : ""}, dans l&apos;ordre du programme
            </span>
          </div>
          {aLaCarte.absents > 0 && (
            <p className="encart">
              {aLaCarte.absents} module{aLaCarte.absents > 1 ? "s" : ""} de ce programme {aLaCarte.absents > 1 ? "ne sont" : "n'est"} plus
              publié{aLaCarte.absents > 1 ? "s" : ""} : signalez-le à votre tuteur.
            </p>
          )}
          <div className="grille">
            {aLaCarte.modules.map((m, i) => (
              <CarteModule key={m.id} m={m} etat={etatDe(m)} rang={i + 1} requete={`?programme=${aLaCarte.id}`} />
            ))}
          </div>
        </>
      ) : ordreProfil ? (
        <>
          {/* Profil qui a son ordre (question 55, choix a) : une seule
              chronologie, socle et filière mêlés, numérotée comme un
              programme à la carte ; le regroupement par bloc reste aux
              profils sans ordre propre. */}
          <div className="section-titre">
            <h2>Modules du profil</h2>
            <span className="compte">
              {programme.length} module{programme.length > 1 ? "s" : ""},{" "}
              {ordreChoisi?.propre ? "dans votre ordre, fixé par le tutorat" : "dans l'ordre fixé par le tutorat"}
            </span>
          </div>
          <div className="grille">
            {programme.map((m, i) => (
              <CarteModule key={m.id} m={m} etat={etatDe(m)} rang={i + 1} requete={requeteCarte} />
            ))}
          </div>
        </>
      ) : (
      <>
      <div className="section-titre">
        <h2>Socle transversal</h2>
        <span className="compte">
          {socle.length} critère{socle.length > 1 ? "s" : ""} — blocs 1 et 3, prérequis aux deux
          parcours
        </span>
        <BoutonReplis groupes={groupesSocle} />
      </div>
      <GroupesModules groupes={groupesSocle} estOuvert={estOuvert} basculer={basculer} etatDe={etatDe} />

      <div className="section-titre">
        <h2>Critères de la filière</h2>
        <span className="compte">
          {posteId ? `${modulesPoste.length} critère(s)` : "aucune filière choisie"}
        </span>
        {posteId ? <BoutonReplis groupes={groupesPoste} /> : null}
      </div>
      {posteId ? (
        <GroupesModules groupes={groupesPoste} estOuvert={estOuvert} basculer={basculer} etatDe={etatDe} />
      ) : (
        <p className="encart">
          {/* Liste lue au référentiel : une filière déposée y figure aussi. */}
          Choisir une filière ci-dessus — {enumerer(postes.map((p) => p.libelle))} — pour
          afficher les critères qui s&apos;y rattachent.
        </p>
      )}
      </>
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
        {/* Mention d'essai retirée des écrans le 19/09/2026 : le rapport
            continue de la porter, lui, en toutes lettres. */}
        {miseEnService ? (
          <p className="legende">
            Le rapport est un <strong>document qualité</strong> : preuve de l&apos;étape 2 au dossier
            d&apos;habilitation, opposable en audit (décision du 18/09/2026). Il ne vaut pas habilitation.
          </p>
        ) : null}
        {pseudonyme ? (
          <p>
            <strong>Télécharger</strong> le rapport sur ce poste, ou <strong>l&apos;émettre</strong> : il est
            alors enregistré sous votre identifiant, numéroté et soumis aux visas du tuteur puis du
            pharmacien. Les entraînements n&apos;apparaissent pas ici.
          </p>
        ) : (
          <p>
            Le rapport reprend chaque critère évalué et le détail des questions. Les entraînements
            n&apos;apparaissent pas ici.
          </p>
        )}

        {pseudonyme && essai ? (
          <p className="encart encart--attention">
            Mode test : les rapports s&apos;émettent sous « {LIBELLE_ESSAI} », numérotés ESSAI-…, sans enregistrement :
            aucun visa de tuteur ni de pharmacien ne suivra. Chaque fichier porte en filigrane « {MENTION_ESSAI} ».
          </p>
        ) : pseudonyme ? (
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
                        {enCours === cleEmission(r) ? "Émission…" : essai ? "Émettre (test)" : "Émettre et enregistrer"}
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
            onClick={() => void telechargerRapport(entete(), resultats, { conservation, procedure, miseEnService, essai })}
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
