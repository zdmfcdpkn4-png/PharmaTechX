"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { QuestionPublique } from "@/content/types";
import { ORDRE_NIVEAUX, bilanTirage, repartir, tirer, type ContexteTirage, type Difficulte } from "@/content/tirage";
import { annoncePlusieurs, libelleBareme, libelleFormat, type SyntheseDocument } from "@/content/types";
import { questionsRenseignees, type EtatEnCours } from "@/content/en-cours";
import { LIBELLES_PLAFOND, libelleBande, plafondDuNiveau, type Bareme } from "@/content/bareme";
import { libelleCible, libelleEcartees } from "@/content/cible";
import { LIBELLES_NIVEAU_QUESTION } from "@/content/types";
import { MOTIFS_SIGNALEMENT, MOTIFS_SIGNALEMENT_FICHE } from "@/content/signalements";
import { estADecouvrir, type Jugement } from "@/content/jugement";
import { marquesOptions, marquesQim } from "@/content/marques";
import { actionDetacher } from "@/app/actions-progression";
import type { DetailQuestion, ResultatEvaluation } from "@/app/api/evaluation/route";
import { LIBELLES_VERDICT, decider, expliquerVerdict } from "@/lib/decision";
import { useSessionFormation } from "./SessionFormation";
import { SchemaQuestion } from "./SchemaQuestion";
import { OrdreQuestion } from "./OrdreQuestion";
import { TrousQuestion } from "./TrousQuestion";
import { PastillesQuestions } from "./PastillesQuestions";

/**
 * Moteur d'évaluation.
 *
 * Le navigateur ne détient jamais les bonnes réponses : les questions arrivent
 * expurgées et la correction est faite par la route API à la soumission. Le
 * tirage est fait ici, pour que la difficulté soit réglable sans aller-retour.
 *
 * Deux modes, choisis au réglage :
 *  - **évaluation** : toutes les questions, correction à la fin, résultat
 *    enregistré dans la session (c'est lui qui alimente le rapport) ;
 *  - **entraînement** : une question à la fois, correction immédiate après
 *    chaque réponse, rien n'est enregistré ni comptabilisé. C'est le retour
 *    immédiat des outils d'e-learning, sans gamification : une justification
 *    sourcée, pas une récompense.
 *
 * Les QIM sont posées en Vrai/Faux proposition par proposition ; chaque
 * proposition non jugée compte comme une discordance, et c'est annoncé. Le
 * mode cases à cocher reste disponible via `qimEnVraiFaux={false}`.
 *
 * Les schémas à compléter (repris du Lecteur QIM · QCM) affichent l'image avec
 * ses repères numérotés et un champ par légende. Un schéma « à découvrir »
 * (question 52, choix b) n'a pas de champ : chaque cache se lève et se juge,
 * par le tuteur en évaluation — qui confirme par son propre code au
 * récapitulatif — et par l'apprenant en entraînement.
 */

type Mode = "evaluation" | "entrainement";

/** Les trois tirages ; leurs tailles viennent du barème réglé (`/admin/bareme`). */
function difficultes(b: Bareme): Record<Difficulte, { libelle: string; description: string; nb: number | null }> {
  return {
    decouverte: {
      libelle: "Découverte",
      description: "Tirage court, pour se situer avant de reprendre le module.",
      nb: b.tirages.decouverte,
    },
    habilitation: {
      libelle: "Habilitation",
      description: "Tirage de référence, toutes les questions éliminatoires incluses.",
      nb: b.tirages.habilitation,
    },
    complet: {
      libelle: "Complet",
      description: "La totalité de la banque du critère.",
      nb: null,
    },
  };
}

/**
 * Questions éliminatoires ou obligatoires qu'un signalement ouvert écarte, annoncées avant l'épreuve :
 * combien une question du même niveau remplace, combien restent sans remplaçante.
 */
function annonceEcartees(remplacees: number, nonRemplacees: number): string {
  const total = remplacees + nonRemplacees;
  if (total === 0) return "";
  const s = (n: number) => (n > 1 ? "s" : "");
  const tete = ` ${total} question${s(total)} éliminatoire${s(total)} ou obligatoire${s(total)} ${total > 1 ? "sont écartées" : "est écartée"} par un signalement ouvert`;
  if (nonRemplacees === 0) return `${tete} : une question du même niveau en prend la place.`;
  if (remplacees === 0) return `${tete} : aucune autre question de ${total > 1 ? "leur" : "son"} niveau ne peut ${total > 1 ? "les" : "la"} remplacer.`;
  return `${tete} : ${remplacees} remplacée${s(remplacees)} par une question du même niveau, ${nonRemplacees} sans remplaçante faute d'autre question de ce niveau.`;
}

/** QCM à réponse unique : l'énoncé ne mentionne pas « plusieurs », quelle que soit la casse. */
function estUneSeule(q: QuestionPublique): boolean {
  return q.type === "QCM" && !annoncePlusieurs(q.enonce);
}

// Tirage et règle des questions réservées : `content/tirage.ts` (testé à part).

/**
 * Jugement d'une proposition de QIM : vrai, faux, ou « je ne sais pas »
 * (décision du 19/09/2026, question 35). Une proposition jamais touchée vaut
 * « je ne sais pas » : elle ne rapporte ni ne retire rien.
 */
type EtatQim = Record<string, Record<string, boolean | "nsp">>;
type EtatLegendes = Record<string, Record<string, string>>;
/** Séquence à ordonner : rang donné à chaque étape, par question. */
type EtatRangs = Record<string, Record<string, number>>;
/** Texte à trous : vignette choisie par trou, par question. */
type EtatTrous = Record<string, Record<string, string>>;
/** Schéma à découvrir : jugement de chaque cache, et caches levés, par question. */
type EtatJugements = Record<string, Record<string, Jugement>>;
type EtatReveles = Record<string, string[]>;

function nombre(n: number): string {
  return String(Math.round(n * 100) / 100).replace(".", ",");
}

function etatLisible(d: DetailQuestion): string {
  if (d.correct) return d.type === "SCH" ? (d.decouverte ? "Tous les caches jugés justes" : "Toutes les légendes justes") : "Réponse exacte";
  if (d.type === "QIM") {
    return `${d.discordances} discordance${d.discordances > 1 ? "s" : ""}${d.nonJugees > 0 ? ` — dont ${d.nonJugees} proposition${d.nonJugees > 1 ? "s" : ""} sans réponse` : ""}`;
  }
  if (d.type === "SCH") {
    const fausses = d.discordances - d.nonJugees;
    if (d.decouverte) {
      return `${fausses} cache${fausses > 1 ? "s" : ""} jugé${fausses > 1 ? "s" : ""} faux${d.nonJugees > 0 ? `, ${d.nonJugees} non jugé${d.nonJugees > 1 ? "s" : ""}` : ""}`;
    }
    return `${fausses} légende${fausses > 1 ? "s" : ""} fausse${fausses > 1 ? "s" : ""}${d.nonJugees > 0 ? `, ${d.nonJugees} sans réponse` : ""}`;
  }
  return "Réponse erronée";
}

function classeCorrection(d: DetailQuestion): string {
  if (d.correct) return "correction--exacte";
  if (d.note > 0) return "correction--partielle";
  return "correction--erronee";
}

/**
 * Document de synthèse du module, affiché en fin de test : PDF et images en
 * ligne, sinon un lien. Une fiche déposée se signale (question 60, choix a) :
 * le signalement va au tutorat, sans effet sur le rapport.
 */
function Synthese({
  docs,
  moduleId,
  signalementPossible,
}: {
  docs: SyntheseDocument[];
  moduleId: string;
  signalementPossible: boolean;
}) {
  if (docs.length === 0) return null;
  return (
    <section className="carte synthese" aria-labelledby="t-synthese">
      <h2 id="t-synthese" style={{ marginTop: 0 }}>Document de synthèse</h2>
      <p className="legende">À lire après l&apos;épreuve : l&apos;essentiel du module, déposé par les tuteurs.</p>
      {docs.map((d) => (
        <div key={d.id} className="synthese-doc">
          <p style={{ margin: "0 0 .5rem" }}>
            <a href={d.url} target="_blank" rel="noreferrer">
              {d.titre}
            </a>{" "}
            <span className="legende">— ouvrir dans un nouvel onglet</span>
          </p>
          {d.affichage === "pdf" && <iframe src={d.url} title={d.titre} className="synthese-cadre" />}
          {d.affichage === "image" && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={d.url} alt={d.titre} className="synthese-image" />
          )}
          {signalementPossible && d.id.startsWith("depot-") && <Signaler ficheId={d.id} moduleId={moduleId} />}
        </div>
      ))}
    </section>
  );
}

/** Signalement d'une question — motif fermé, note libre, rien de nominatif. */
/**
 * Récapitulatif avant la validation d'une évaluation.
 *
 * La barre de passation dit déjà **combien** de questions sont renseignées ;
 * elle ne dit pas **lesquelles** manquent, et « Valider l'évaluation »
 * partait au premier clic. Avec des gants, sur une tablette, c'est le geste
 * qu'on fait sans le vouloir, et il clôt une passation dont le résultat peut
 * être porté au rapport.
 *
 * Le récapitulatif nomme les questions sans réponse, permet d'y retourner, et
 * demande un second geste — distinct du premier par sa place et par son
 * libellé. Échap et « Revenir aux questions » sortent toujours : la
 * tabulation ne quitte pas le panneau, ce n'est donc pas un piège au clavier
 * (WCAG 2.1.2).
 */
function RecapitulatifValidation({
  total,
  renseignees,
  manquantes,
  surQuestion,
  surValider,
  surFermer,
  jugement = null,
  codeTuteur = "",
  surCodeTuteur,
  envoi = false,
  erreur = null,
  identifiant = null,
}: {
  total: number;
  renseignees: number;
  manquantes: number[];
  surQuestion: (numero: number) => void;
  surValider: () => void;
  surFermer: () => void;
  /** Schémas à découvrir du tirage (question 52) : caches jugés, sur combien. */
  jugement?: { questions: number; juges: number; total: number } | null;
  codeTuteur?: string;
  surCodeTuteur?: (v: string) => void;
  envoi?: boolean;
  /** Refus du serveur (code du tuteur) : dit dans le panneau, qui reste ouvert. */
  erreur?: string | null;
  /** Identifiant sous lequel le résultat s'enregistre (Z1) : dernier moment pour s'en apercevoir. */
  identifiant?: string | null;
}) {
  // Des caches jugés ne valent qu'avec le code du tuteur ; aucun cache jugé,
  // rien à confirmer — ils comptent alors comme sans réponse.
  const codeRequis = Boolean(jugement && jugement.juges > 0);
  const panneau = useRef<HTMLDivElement>(null);
  // Le panneau prend le focus à l'ouverture, et à l'ouverture seulement : la
  // saisie du code du tuteur fait rendre la page à chaque touche, et un effet
  // relancé à chaque rendu lui reprendrait le focus au premier caractère.
  const fermer = useRef(surFermer);
  useEffect(() => {
    fermer.current = surFermer;
  }, [surFermer]);
  useEffect(() => {
    panneau.current?.focus();
    document.body.classList.add("recap-ouvert");
    const auClavier = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        fermer.current();
        return;
      }
      if (e.key !== "Tab" || !panneau.current) return;
      const focusables = panneau.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) return;
      const premier = focusables[0];
      const dernier = focusables[focusables.length - 1];
      const actif = document.activeElement;
      if (e.shiftKey && (actif === premier || actif === panneau.current)) {
        e.preventDefault();
        dernier.focus();
      } else if (!e.shiftKey && actif === dernier) {
        e.preventDefault();
        premier.focus();
      }
    };
    document.addEventListener("keydown", auClavier);
    return () => {
      document.removeEventListener("keydown", auClavier);
      document.body.classList.remove("recap-ouvert");
    };
  }, []);

  return (
    <>
      <div className="recap-voile" onClick={surFermer} aria-hidden />
      <div
        className="recap"
        role="dialog"
        aria-modal="true"
        aria-labelledby="t-recap"
        tabIndex={-1}
        ref={panneau}
      >
        <h2 id="t-recap" style={{ marginTop: 0 }}>
          Avant de valider
        </h2>
        <p style={{ marginBottom: ".5rem" }}>
          <strong>
            {renseignees} sur {total}
          </strong>{" "}
          question{total > 1 ? "s" : ""} renseignée{renseignees > 1 ? "s" : ""}.
        </p>
        {manquantes.length > 0 ? (
          <div className="encart encart--attention">
            <p style={{ margin: "0 0 .5rem" }}>
              {manquantes.length === 1
                ? "Une question est sans réponse"
                : `${manquantes.length} questions sont sans réponse`} : elle
              {manquantes.length > 1 ? "s seront comptées" : " sera comptée"} comme telle
              {manquantes.length > 1 ? "s" : ""} par le barème.
            </p>
            <div className="recap-manquantes">
              {manquantes.map((n) => (
                <button
                  key={n}
                  type="button"
                  className="bouton bouton--compact bouton--secondaire"
                  onClick={() => surQuestion(n)}
                >
                  Question {n}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <p className="encart encart--ok" style={{ margin: 0 }}>
            Toutes les questions sont renseignées.
          </p>
        )}
        {jugement && (
          <div className={`encart${codeRequis ? "" : " encart--attention"} recap-tuteur`}>
            {codeRequis ? (
              <>
                <p style={{ margin: "0 0 .5rem" }}>
                  <strong>Confirmation du tuteur.</strong> {jugement.juges} cache
                  {jugement.juges > 1 ? "s" : ""} jugé{jugement.juges > 1 ? "s" : ""} sur {jugement.total}
                  {jugement.questions > 1 ? `, dans ${jugement.questions} schémas à découvrir` : ""}. Le tuteur
                  qui les a jugés tape ici son propre code : le serveur le vérifie, ne le conserve pas, et
                  scelle le résultat avec la mention de ce code.
                  {jugement.juges < jugement.total
                    ? ` ${jugement.total - jugement.juges} cache${jugement.total - jugement.juges > 1 ? "s" : ""} non jugé${jugement.total - jugement.juges > 1 ? "s" : ""} compte${jugement.total - jugement.juges > 1 ? "nt" : ""} comme sans réponse.`
                    : ""}
                </p>
                <label className="champ" style={{ margin: 0 }}>
                  <span>Code du tuteur</span>
                  <input
                    type="password"
                    name="codeTuteur"
                    value={codeTuteur}
                    onChange={(e) => surCodeTuteur?.(e.target.value)}
                    autoComplete="off"
                    spellCheck={false}
                    autoCapitalize="characters"
                  />
                </label>
              </>
            ) : (
              <p style={{ margin: 0 }}>
                Aucun cache n&apos;a été jugé : {jugement.questions > 1 ? "les schémas à découvrir comptent" : "le schéma à découvrir compte"}{" "}
                comme sans réponse. Pour qu&apos;ils soient notés, revenez aux questions et passez-les avec votre tuteur.
              </p>
            )}
          </div>
        )}
        {erreur && (
          <p className="encart encart--attention" role="alert" style={{ marginTop: ".75rem" }}>
            {erreur}
          </p>
        )}
        {identifiant && (
          <p style={{ margin: ".75rem 0 0" }}>
            Résultat enregistré sous l&apos;identifiant <strong>{identifiant}</strong>. Ce n&apos;est pas
            le vôtre ? Ne validez pas : revenez aux questions et prévenez votre tuteur.
          </p>
        )}
        <p className="legende" style={{ margin: ".75rem 0 0" }}>
          La correction est faite par le serveur. Le résultat entre dans la session et peut être
          porté au rapport d&apos;habilitation (étape 2 sur 6).
        </p>
        <div className="actions" style={{ marginTop: ".75rem" }}>
          <button type="button" className="bouton bouton--secondaire" onClick={surFermer}>
            Revenir aux questions
          </button>
          <button
            type="button"
            className="bouton"
            onClick={surValider}
            disabled={envoi || (codeRequis && codeTuteur.trim() === "")}
          >
            {envoi ? "Correction…" : "Valider définitivement"}
          </button>
        </div>
      </div>
    </>
  );
}

/** Signalement d'une question, ou d'une fiche de synthèse (question 60) : motifs propres à chacune. */
function Signaler({ questionId, ficheId, moduleId }: { questionId?: string; ficheId?: string; moduleId: string }) {
  const surFiche = Boolean(ficheId);
  const motifs: readonly string[] = surFiche ? MOTIFS_SIGNALEMENT_FICHE : MOTIFS_SIGNALEMENT;
  const [motif, setMotif] = useState<string>(motifs[0]);
  const [note, setNote] = useState("");
  const [etat, setEtat] = useState<"repos" | "envoi" | "fait" | "erreur" | "essai">("repos");

  if (etat === "fait") {
    return <p className="legende">Signalement transmis au tutorat. Merci.</p>;
  }
  if (etat === "essai") {
    return (
      <p className="encart encart--attention">
        {surFiche
          ? "Mode test : le signalement n'est pas transmis. Notez la fiche, et signalez-la en dehors du mode test."
          : "Mode test : le signalement n'est pas transmis — il bloquerait les visas des rapports réels qui contiennent cette question. Notez-la, et signalez-la en dehors du mode test."}
      </p>
    );
  }
  return (
    <details className="signaler">
      <summary>{surFiche ? "Signaler un problème sur cette fiche" : "Signaler un problème sur cette question"}</summary>
      <div className="signaler-corps">
        <label className="champ">
          <span>Motif</span>
          <select value={motif} onChange={(e) => setMotif(e.target.value)}>
            {motifs.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </label>
        <label className="champ">
          <span>Précision (facultative, ne mentionnez personne)</span>
          <textarea rows={3} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        {etat === "erreur" && <p className="encart encart--attention">Le signalement n&apos;a pas pu être transmis.</p>}
        <div className="actions">
          <button
            type="button"
            className="bouton bouton--compact"
            disabled={etat === "envoi"}
            onClick={async () => {
              setEtat("envoi");
              try {
                const r = await fetch("/api/signalement", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ ...(surFiche ? { ficheId } : { questionId }), moduleId, motif, note }),
                });
                const corps = (await r.json().catch(() => ({}))) as { essai?: boolean };
                setEtat(corps.essai ? "essai" : r.ok ? "fait" : "erreur");
              } catch {
                setEtat("erreur");
              }
            }}
          >
            {etat === "envoi" ? "Envoi…" : "Transmettre"}
          </button>
        </div>
      </div>
    </details>
  );
}

export function Evaluation({
  moduleId,
  moduleTitre,
  banque,
  seuil,
  bareme,
  qimEnVraiFaux = true,
  signalementPossible = false,
  syntheses = [],
  suivant = null,
  rattache = false,
  identifiant = null,
  enCoursInitial = null,
  requete = "",
  niveaux = [],
  niveauInitial = null,
  signalees = [],
}: {
  moduleId: string;
  moduleTitre: string;
  banque: QuestionPublique[];
  seuil: number;
  /** Barème en vigueur : tailles des tirages, minimum concluant, règles annoncées. */
  bareme: Bareme;
  qimEnVraiFaux?: boolean;
  signalementPossible?: boolean;
  /** Documents de synthèse du module, affichés en fin de test. */
  syntheses?: SyntheseDocument[];
  /** Module suivant dans le parcours, proposé en fin de test. */
  suivant?: { id: string; titre: string } | null;
  /** Apprenant rattaché à son identifiant : l'évaluation en cours est sauvegardée, la fin d'un entraînement notée. */
  rattache?: boolean;
  /**
   * Identifiant de l'agent rattaché, rappelé là où le résultat s'enregistre
   * (audit du 24/09/2026, Z1) : sur un poste partagé, le rattachement du
   * précédent peut courir encore.
   */
  identifiant?: string | null;
  /** Évaluation interrompue, conservée sous l'identifiant, proposée à la reprise. */
  enCoursInitial?: EtatEnCours | null;
  /** Programme à la carte (`?programme=…`) : gardé sur les liens vers les modules. */
  requete?: string;
  /** Niveaux d'habilitation proposés comme niveau cible (questions 62 et 63). */
  niveaux?: { code: string; libelle: string }[];
  /** Niveau cible du profil de la page, ou du code de session ; `null` : non précisé. */
  niveauInitial?: string | null;
  /** Questions au signalement ouvert : écartées de tout tirage (question 62). */
  signalees?: string[];
}) {
  const DIFFICULTES = difficultes(bareme);
  const MIN_QUESTIONS_HABILITATION = bareme.minQuestions;
  // Niveau cible (questions 62 et 63) : il fixe le plafond de niveau des
  // questions tirées et la répartition du tirage, réglés au barème.
  const [niveauCible, setNiveauCible] = useState<string>(niveauInitial ?? "");
  const plafond = plafondDuNiveau(bareme, niveauCible || null);
  const contexte = (d: Difficulte, m: Mode): ContexteTirage => ({
    mode: m,
    difficulte: d,
    nb: DIFFICULTES[d].nb,
    plafond,
    repartition: bareme.repartitions[plafond],
    signalees,
  });
  // Tirage d'habilitation par défaut ; Découverte seule si la banque admise
  // au niveau cible ne peut pas réunir un tirage concluant.
  const suffisante = (niveau: string) =>
    bilanTirage(banque, { ...contexte("habilitation", "evaluation"), plafond: plafondDuNiveau(bareme, niveau || null) }).admises >=
    MIN_QUESTIONS_HABILITATION;
  const banqueSuffisante = suffisante(niveauCible);
  const [difficulte, setDifficulte] = useState<Difficulte>(banqueSuffisante ? "habilitation" : "decouverte");
  const [mode, setMode] = useState<Mode>("evaluation");
  const [demarre, setDemarre] = useState(false);
  const [graine, setGraine] = useState(0);
  const [reponses, setReponses] = useState<Record<string, string[]>>({});
  const [qim, setQim] = useState<EtatQim>({});
  const [legendes, setLegendes] = useState<EtatLegendes>({});
  const [rangs, setRangs] = useState<EtatRangs>({});
  const [trous, setTrous] = useState<EtatTrous>({});
  const [jugements, setJugements] = useState<EtatJugements>({});
  const [reveles, setReveles] = useState<EtatReveles>({});
  // Code du tuteur (schémas à découvrir) : en mémoire le temps de la
  // validation, jamais sauvegardé, effacé après chaque tentative.
  const [codeTuteur, setCodeTuteur] = useState("");
  const [erreurRecap, setErreurRecap] = useState<string | null>(null);
  const [resultat, setResultat] = useState<ResultatEvaluation | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [recap, setRecap] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  // Entraînement : une question à la fois, correction immédiate.
  const [indexCourant, setIndexCourant] = useState(0);
  const [corrections, setCorrections] = useState<Record<string, DetailQuestion>>({});
  const [entrainementFini, setEntrainementFini] = useState(false);
  // Questions fixées d'avance : rejeu des ratées (transposé du « Rejouer les
  // ratées » du Lecteur QIM · QCM, entraînement seulement) ou reprise d'une
  // évaluation interrompue (mêmes questions, réponses conservées).
  const [sousEnsemble, setSousEnsemble] = useState<{ ids: string[]; libelle: string; revoir: boolean } | null>(null);
  const [enCours, setEnCours] = useState<EtatEnCours | null>(enCoursInitial);
  const { enregistrer } = useSessionFormation();

  // Tirage dans le navigateur (content/tirage.ts) : niveau cible, questions
  // signalées écartées, éliminatoires et obligatoires, réservées, répartition
  // par niveau ; le serveur vérifie la conformité à la correction.
  const posees = useMemo(
    () =>
      sousEnsemble
        ? banque.filter((q) => sousEnsemble.ids.includes(q.id))
        : tirer(banque, contexte(difficulte, mode)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [banque, difficulte, mode, graine, sousEnsemble, niveauCible],
  );
  const bilanEvaluation = bilanTirage(banque, contexte("habilitation", "evaluation"));
  const nbReservees = banque.filter((q) => q.reservee).length;
  const nbADecouvrir = banque.filter(estADecouvrir).length;

  const libelleTirage = sousEnsemble
    ? sousEnsemble.libelle
    : `${DIFFICULTES[difficulte].libelle} · ${posees.length} question${posees.length > 1 ? "s" : ""}${mode === "entrainement" ? " · entraînement" : ""}`;

  /**
   * Trace de progression envoyée au serveur ; ignorée sans rattachement.
   *
   * Les envois d'une même session sont mis à la file (21/09/2026). Sans cela,
   * une sauvegarde automatique partie juste avant l'effacement de la session
   * en cours peut être traitée après lui et la ressusciter : l'apprenant se
   * voit alors proposer de « reprendre » une évaluation qu'il vient de
   * valider. Deux requêtes concurrentes n'ont pas d'ordre garanti ; une file
   * en donne un.
   */
  const fileTraces = useRef<Promise<unknown>>(Promise.resolve());
  /**
   * Écritures de progression sérialisées : sans cette file, la sauvegarde
   * regroupée (700 ms) et son effacement après correction partaient en
   * parallèle, et l'effacement pouvait être traité le premier — l'apprenant
   * se voyait alors proposer de « reprendre » l'évaluation qu'il venait de
   * valider.
   *
   * `persistant` (`keepalive`) fait survivre une requête **déjà émise** au
   * déchargement de la page : utile pour l'effacement déclenché par
   * « Recommencer », seul chemin où le client est le seul à effacer. Il ne
   * protège pas une requête encore en file d'attente, qui n'est jamais
   * émise. Réservé aux corps courts : la limite est de 64 Kio, et un état
   * d'évaluation complet la dépasserait.
   */
  const tracer = (corps: Record<string, unknown>, persistant = false) => {
    fileTraces.current = fileTraces.current.then(() =>
      fetch("/api/progression", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moduleId, ...corps }),
        keepalive: persistant,
      }).catch(() => undefined),
    );
    return fileTraces.current;
  };

  // Sauvegarde de l'évaluation en cours, regroupée (700 ms), tant qu'elle n'est
  // ni corrigée ni terminée ; jamais pour un rejeu des ratées.
  const minuteurSauvegarde = useRef<number | null>(null);
  useEffect(() => {
    if (!rattache || !demarre || resultat || entrainementFini || sousEnsemble?.revoir) return;
    if (minuteurSauvegarde.current) window.clearTimeout(minuteurSauvegarde.current);
    minuteurSauvegarde.current = window.setTimeout(() => {
      const etat: EtatEnCours = {
        questionIds: posees.map((q) => q.id),
        mode,
        difficulte,
        libelle: libelleTirage,
        niveauCible: niveauCible || null,
        reponses,
        qim,
        legendes,
        rangs,
        trous,
        jugements,
        reveles,
        indexCourant,
        corrections,
        maj: new Date().toISOString(),
      };
      void tracer({ nature: "en_cours", etat });
    }, 700);
    return () => {
      if (minuteurSauvegarde.current) window.clearTimeout(minuteurSauvegarde.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rattache, demarre, resultat, entrainementFini, sousEnsemble, posees, mode, difficulte, niveauCible, reponses, qim, legendes, rangs, trous, jugements, reveles, indexCourant, corrections]);

  // Cibles du défilement : le cadre des questions et la correction d'entraînement.
  const refPassation = useRef<HTMLDivElement | null>(null);
  const refCorrection = useRef<HTMLDivElement | null>(null);

  /*
   * La question arrive sous l'en-tête au démarrage et à chaque question
   * suivante (audit du 24/09/2026, E2). Le défilement se fait après le rendu :
   * lancé dans le gestionnaire du clic, avant que la question suivante ne
   * s'affiche, il était interrompu par la mise à jour de la page. Au
   * démarrage, la page raccourcie restait calée en bas, le numéro et le
   * format de la question sous l'en-tête fixe. La marge sous l'en-tête est
   * celle des ancres (`--decalage`). Saut immédiat, comme en mouvement
   * réduit : un défilement doux peut encore être interrompu par la page qui
   * se recompose, et la question resterait alors sous l'en-tête.
   */
  useEffect(() => {
    if (!demarre || resultat) return;
    if (entrainementFini) {
      window.scrollTo({ top: 0, behavior: "instant" });
      return;
    }
    refPassation.current
      ?.querySelector<HTMLElement>(".encart, .vignette, fieldset.question")
      ?.scrollIntoView({ behavior: "instant", block: "start" });
  }, [demarre, resultat, entrainementFini, indexCourant]);

  /*
   * Correction d'entraînement amenée à l'écran (audit du 24/09/2026, E1) :
   * ajoutée sous la question, elle pouvait rester entière sous la barre de
   * passation (QIM et schémas, sur PC comme sur iPad) pendant que le bouton
   * devenait « Question suivante ». Défilement au plus court : son bas
   * au-dessus de la barre, sans que son haut passe sous l'en-tête — le haut
   * l'emporte si elle est plus haute que l'écran. `scrollIntoView` « au plus
   * près » ne suffit pas : pour lui, une correction cachée par la barre fixe
   * est déjà dans la fenêtre. Saut immédiat, puis le focus : un lecteur
   * d'écran la lit.
   *
   * Le navigateur peut encore recaler la page au rendu suivant, après ce
   * calcul : mesuré sur un schéma « à découvrir », dont la figure raccourcit
   * en se révélant — la correction retombait sous la barre deux fois sur
   * trois. La position est donc réajustée à chaque défilement pendant
   * 400 ms, sauf si l'apprenant fait défiler lui-même entre-temps.
   */
  const correctionCourante = mode === "entrainement" ? corrections[posees[indexCourant]?.id ?? ""] : undefined;
  useEffect(() => {
    const el = refCorrection.current;
    if (!correctionCourante || !el) return;
    const ajuster = () => {
      const barre = document.querySelector<HTMLElement>(".barre-passation")?.getBoundingClientRect().height ?? 0;
      const entete = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--decalage")) || 0;
      const r = el.getBoundingClientRect();
      let decalage = Math.max(0, r.bottom - (window.innerHeight - barre - 12));
      if (r.top - decalage < entete + 12) decalage = r.top - (entete + 12);
      if (Math.abs(decalage) > 1) window.scrollBy({ top: decalage, behavior: "instant" });
    };
    ajuster();
    el.focus({ preventScroll: true });
    const gestes = ["pointerdown", "wheel", "touchstart", "keydown"] as const;
    const arreter = () => {
      window.removeEventListener("scroll", ajuster);
      for (const g of gestes) window.removeEventListener(g, arreter);
    };
    window.addEventListener("scroll", ajuster, { passive: true });
    for (const g of gestes) window.addEventListener(g, arreter, { passive: true });
    const minuteur = window.setTimeout(arreter, 400);
    return () => {
      window.clearTimeout(minuteur);
      arreter();
    };
  }, [correctionCourante]);

  const effacerEnCours = () => {
    if (minuteurSauvegarde.current) window.clearTimeout(minuteurSauvegarde.current);
    setEnCours(null);
    if (rattache) void tracer({ nature: "en_cours", etat: null }, true);
  };

  const reprendre = (e: EtatEnCours) => {
    setMode(e.mode);
    setDifficulte(e.difficulte);
    // Le serveur juge la reprise sous le plafond de son tirage : le niveau cible est celui de la sauvegarde.
    setNiveauCible(e.niveauCible ?? "");
    setReponses(e.reponses);
    setQim(e.qim);
    setLegendes(e.legendes);
    setRangs(e.rangs ?? {});
    setTrous(e.trous ?? {});
    setJugements(e.jugements ?? {});
    setReveles(e.reveles ?? {});
    setIndexCourant(e.indexCourant);
    setCorrections(e.corrections as Record<string, DetailQuestion>);
    setEntrainementFini(false);
    setResultat(null);
    setSousEnsemble({ ids: e.questionIds, libelle: e.libelle || "Reprise", revoir: false });
    setEnCours(null);
    setDemarre(true);
  };

  const basculer = (q: QuestionPublique, optionId: string) => {
    setReponses((prec) => {
      const actuel = prec[q.id] ?? [];
      if (estUneSeule(q)) return { ...prec, [q.id]: [optionId] };
      return {
        ...prec,
        [q.id]: actuel.includes(optionId) ? actuel.filter((x) => x !== optionId) : [...actuel, optionId],
      };
    });
  };

  const jugerQim = (qid: string, optId: string, valeur: boolean | "nsp") => {
    setQim((prec) => ({ ...prec, [qid]: { ...(prec[qid] ?? {}), [optId]: valeur } }));
  };

  const ecrireLegende = (qid: string, lid: string, valeur: string) => {
    setLegendes((prec) => ({ ...prec, [qid]: { ...(prec[qid] ?? {}), [lid]: valeur } }));
  };

  /**
   * Séquence : donner un rang à une étape. Le rang est unique — s'il était
   * pris, l'étape qui le portait le perd, et son menu revient à « — ».
   */
  const placerRang = (qid: string, optId: string, rang: number) => {
    setRangs((prec) => {
      const courant = { ...(prec[qid] ?? {}) };
      if (!rang) delete courant[optId];
      else {
        for (const [k, v] of Object.entries(courant)) if (v === rang && k !== optId) delete courant[k];
        courant[optId] = rang;
      }
      return { ...prec, [qid]: courant };
    });
  };

  const remplirTrou = (qid: string, trou: string, optId: string) => {
    setTrous((prec) => ({ ...prec, [qid]: { ...(prec[qid] ?? {}), [trou]: optId } }));
  };

  const leverCache = (qid: string, lid: string) => {
    setReveles((prec) => ((prec[qid] ?? []).includes(lid) ? prec : { ...prec, [qid]: [...(prec[qid] ?? []), lid] }));
  };

  const jugerCache = (qid: string, lid: string, j: Jugement) => {
    setJugements((prec) => ({ ...prec, [qid]: { ...(prec[qid] ?? {}), [lid]: j } }));
  };

  /** Une question est « renseignée » dès qu'elle a reçu au moins une réponse. */
  const estRenseignee = (q: QuestionPublique): boolean => {
    if (estADecouvrir(q)) return Object.keys(jugements[q.id] ?? {}).length > 0;
    if (q.type === "SCH") return Object.values(legendes[q.id] ?? {}).some((v) => v.trim() !== "");
    if (q.type === "ORD") return Object.keys(rangs[q.id] ?? {}).length > 0;
    if (q.type === "TAT") return Object.values(trous[q.id] ?? {}).some((v) => v !== "");
    if (q.type === "QIM" && qimEnVraiFaux) return Object.keys(qim[q.id] ?? {}).length > 0;
    return (reponses[q.id] ?? []).length > 0;
  };

  const chargeUtile = (questions: QuestionPublique[]) => {
    const rep: Record<string, string[]> = {};
    const juges: Record<string, string[]> = {};
    const legs: EtatLegendes = {};
    const rgs: EtatRangs = {};
    const trs: EtatTrous = {};
    const jgs: EtatJugements = {};
    for (const q of questions) {
      if (estADecouvrir(q)) {
        jgs[q.id] = jugements[q.id] ?? {};
      } else if (q.type === "SCH") {
        legs[q.id] = legendes[q.id] ?? {};
      } else if (q.type === "ORD") {
        rgs[q.id] = rangs[q.id] ?? {};
      } else if (q.type === "TAT") {
        trs[q.id] = trous[q.id] ?? {};
      } else if (q.type === "QIM" && qimEnVraiFaux) {
        const verdicts = qim[q.id] ?? {};
        // « je ne sais pas » n'est pas un jugement : la proposition reste non
        // jugée, et le barème lui applique sa part « sans réponse ».
        juges[q.id] = Object.entries(verdicts).filter(([, v]) => v !== "nsp").map(([k]) => k);
        rep[q.id] = Object.entries(verdicts).filter(([, v]) => v === true).map(([k]) => k);
      } else {
        rep[q.id] = reponses[q.id] ?? [];
      }
    }
    return {
      moduleId,
      questionIds: questions.map((q) => q.id),
      reponses: rep,
      juges,
      legendes: legs,
      rangs: rgs,
      trous: trs,
      jugements: jgs,
      tirage: libelleTirage,
      mode,
      difficulte,
      niveauCible: niveauCible || null,
    };
  };

  const corriger = async (questions: QuestionPublique[], code = ""): Promise<ResultatEvaluation> => {
    const reponse = await fetch("/api/evaluation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...chargeUtile(questions), ...(code ? { codeTuteur: code } : {}) }),
    });
    if (!reponse.ok) {
      const j = await reponse.json().catch(() => ({}));
      throw new Error(j.erreur ?? "La correction a échoué.");
    }
    return (await reponse.json()) as ResultatEvaluation;
  };

  const soumettre = async () => {
    setEnvoi(true);
    setErreur(null);
    setErreurRecap(null);
    // Le code du tuteur part avec cette tentative et quitte aussitôt la
    // mémoire de la page : refusé, il se retape.
    const code = codeTuteur;
    setCodeTuteur("");
    try {
      // La correction efface `en_cours` côté serveur (`enregistrerEvaluation`,
      // `lib/progression.ts`). Une sauvegarde encore en attente ou en vol
      // arriverait après elle et ressusciterait la ligne : l'apprenant se
      // verrait proposer de reprendre l'évaluation qu'il vient de valider.
      // La file de traces n'ordonne que les écritures du client entre elles,
      // pas vis-à-vis de la correction, qui passe par une autre route : on
      // annule donc le minuteur et on vide la file avant d'envoyer.
      if (minuteurSauvegarde.current) window.clearTimeout(minuteurSauvegarde.current);
      await fileTraces.current;
      const r = await corriger(posees, code);
      setRecap(false);
      setResultat(r);
      enregistrer(r);
      const doux = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      window.scrollTo({ top: 0, behavior: doux ? "smooth" : "auto" });
    } catch (e) {
      // Le refus reste dans le récapitulatif, ouvert : les réponses et les
      // jugements sont toujours à l'écran, le tuteur n'a qu'à retaper son code.
      setErreurRecap(e instanceof Error ? e.message : "Erreur inconnue.");
    } finally {
      setEnvoi(false);
    }
  };

  const verifierCourante = async () => {
    const q = posees[indexCourant];
    if (!q) return;
    setEnvoi(true);
    setErreur(null);
    try {
      const r = await corriger([q]);
      const d = r.detail[0];
      if (d) setCorrections((prec) => ({ ...prec, [q.id]: d }));
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Erreur inconnue.");
    } finally {
      setEnvoi(false);
    }
  };

  const recommencer = () => {
    setResultat(null);
    setReponses({});
    setQim({});
    setLegendes({});
    setRangs({});
    setTrous({});
    setJugements({});
    setReveles({});
    setCodeTuteur("");
    setErreurRecap(null);
    setCorrections({});
    setIndexCourant(0);
    setEntrainementFini(false);
    setSousEnsemble(null);
    setGraine((g) => g + 1);
    setDemarre(false);
    effacerEnCours();
  };

  /** Jamais de question réservée en entraînement, même ratée à l'évaluation ; ni de question signalée depuis. */
  const rateesRejouables = (ids: string[]) =>
    ids.filter((id) => !banque.find((q) => q.id === id)?.reservee && !signalees.includes(id));

  /** Repasse les questions ratées, une à la fois, en entraînement : rien n'est enregistré. */
  const rejouerRatees = (idsRatees: string[]) => {
    const ids = rateesRejouables(idsRatees);
    if (ids.length === 0) return;
    setResultat(null);
    setReponses({});
    setQim({});
    setLegendes({});
    setRangs({});
    setTrous({});
    setJugements({});
    setReveles({});
    setCodeTuteur("");
    setErreurRecap(null);
    setCorrections({});
    setIndexCourant(0);
    setEntrainementFini(false);
    setMode("entrainement");
    setSousEnsemble({ ids, libelle: `À revoir · ${ids.length} question${ids.length > 1 ? "s" : ""} · entraînement`, revoir: true });
    setGraine((g) => g + 1);
    setDemarre(true);
    window.scrollTo({ top: 0 });
  };

  /** Fin d'un entraînement : la trace est notée si l'apprenant est rattaché (jamais pour un rejeu des ratées). */
  const terminerEntrainement = () => {
    setEntrainementFini(true);
    if (!rattache || sousEnsemble?.revoir) return;
    const justes = posees.filter((q) => corrections[q.id]?.correct).length;
    const points = posees.reduce((s, q) => s + (corrections[q.id]?.note ?? 0), 0);
    void tracer({ nature: "entrainement", justes, total: posees.length, points, tirage: libelleTirage });
  };

  const boutonRatees = (idsRatees: string[]) => {
    const ids = rateesRejouables(idsRatees);
    return ids.length > 0 ? (
      <button type="button" className="bouton bouton--secondaire" onClick={() => rejouerRatees(ids)}>
        Retravailler {ids.length === 1 ? "la question ratée" : `les ${ids.length} questions ratées`} (entraînement)
      </button>
    ) : null;
  };

  const lienSuivant = suivant ? (
    <Link href={`/module/${suivant.id}${requete}`} className="bouton bouton--secondaire">
      Module suivant : {suivant.titre.length > 48 ? `${suivant.titre.slice(0, 48)}…` : suivant.titre}
    </Link>
  ) : null;

  // ───────────────────────────────────────────────────── réglage du tirage
  if (!demarre && !resultat) {
    return (
      <section className="carte">
        <h2>Régler l&apos;évaluation</h2>
        <p>
          Les questions sont tirées au sort dans la banque du critère : {bilanEvaluation.admises} admise
          {bilanEvaluation.admises > 1 ? "s" : ""} au niveau cible sur {banque.length}
          {bilanEvaluation.auDessus > 0 ? `, ${bilanEvaluation.auDessus} au-dessus du niveau cible` : ""}
          {bilanEvaluation.signalees > 0
            ? `, ${bilanEvaluation.signalees} écartée${bilanEvaluation.signalees > 1 ? "s" : ""} par un signalement ouvert jusqu'à sa clôture`
            : ""}
          . Les questions éliminatoires et obligatoires sont toujours posées, et les mises en situation sont
          tirées avec leur vignette entière.
        </p>
        <p className="encart">
          Seuil de réussite <strong>{seuil}&nbsp;%</strong>. Une erreur sur une question éliminatoire
          rend le critère non acquis, quel que soit le score. Bande de garde : {libelleBande(bareme)} ;
          dans cette bande, le verdict est <strong>indéterminé</strong> et le tuteur l&apos;arbitre au
          visa du rapport. Un tirage de moins de {MIN_QUESTIONS_HABILITATION} questions est{" "}
          <strong>non concluant</strong> : il ne peut pas être porté au rapport d&apos;habilitation.
        </p>
        {!banqueSuffisante && (
          <p className="encart encart--attention">
            Au niveau cible, la banque de ce critère admet {bilanEvaluation.admises} question
            {bilanEvaluation.admises > 1 ? "s" : ""} validée{bilanEvaluation.admises > 1 ? "s" : ""} sur les{" "}
            {MIN_QUESTIONS_HABILITATION} requises : seul le tirage Découverte est ouvert, non concluant, pour se situer.
          </p>
        )}
        {enCours && rattache && (
          <div className="encart encart--attention" role="status">
            <p style={{ margin: "0 0 .5rem" }}>
              <strong>Une {enCours.mode === "entrainement" ? "séance d'entraînement" : "évaluation"} interrompue</strong> a été
              conservée sous votre identifiant le{" "}
              {new Date(enCours.maj).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Paris" })} :{" "}
              {enCours.libelle || `${enCours.questionIds.length} questions`}, {questionsRenseignees(enCours)} question
              {questionsRenseignees(enCours) > 1 ? "s" : ""} renseignée{questionsRenseignees(enCours) > 1 ? "s" : ""}.
            </p>
            <div className="actions" style={{ marginTop: 0 }}>
              <button type="button" className="bouton bouton--compact" onClick={() => reprendre(enCours)}>
                Reprendre
              </button>
              <button type="button" className="bouton bouton--compact bouton--secondaire" onClick={effacerEnCours}>
                Abandonner
              </button>
            </div>
          </div>
        )}
        <div className="choix-niveau">
          <label className="champ">
            <span className="champ-titre">Niveau cible</span>
            <select
              name="niveauCible"
              value={niveauCible}
              onChange={(e) => {
                const v = e.target.value;
                setNiveauCible(v);
                if (!suffisante(v)) setDifficulte("decouverte");
              }}
            >
              <option value="">Non précisé — questions de tous niveaux</option>
              {niveaux.map((n) => (
                <option key={n.code} value={n.code}>
                  {n.libelle}
                </option>
              ))}
            </select>
          </label>
          <p className="legende" style={{ margin: ".25rem 0 0" }}>
            {LIBELLES_PLAFOND[plafond][0].toUpperCase() + LIBELLES_PLAFOND[plafond].slice(1)}, selon le barème ; tirage
            Habilitation :{" "}
            {ORDRE_NIVEAUX.map((n) => ({ n, k: repartir(bareme.tirages.habilitation, bareme.repartitions[plafond], plafond)[n] }))
              .filter(({ k }) => k > 0)
              .map(({ n, k }) => `${LIBELLES_NIVEAU_QUESTION[n].toLowerCase()} ${k}`)
              .join(", ")}
            . Les questions sans niveau complètent les places qu&apos;un niveau ne peut pas remplir.
          </p>
        </div>
        <fieldset className="choix-difficulte">
          <legend className="champ-titre">Tirage</legend>
          {(Object.keys(DIFFICULTES) as Difficulte[]).map((d) => {
            // Taille exacte du tirage : elle ne dépend pas du hasard, seulement de la banque et du réglage.
            const reel = tirer(banque, contexte(d, mode), () => 0).length;
            const concluant = reel >= MIN_QUESTIONS_HABILITATION;
            const ferme = d !== "decouverte" && !banqueSuffisante;
            return (
              <label key={d} className={`option${difficulte === d ? " est-choisie" : ""}${ferme ? " est-fermee" : ""}`}>
                <input
                  type="radio"
                  name="difficulte"
                  checked={difficulte === d}
                  disabled={ferme}
                  onChange={() => setDifficulte(d)}
                />
                <span>
                  <strong>{DIFFICULTES[d].libelle}</strong> — {reel} question{reel > 1 ? "s" : ""}
                  {concluant ? "" : " · non concluant"}
                  <br />
                  <span className="legende">
                    {DIFFICULTES[d].description}
                    {ferme ? ` Fermé : ${MIN_QUESTIONS_HABILITATION} questions validées sont nécessaires.` : ""}
                  </span>
                </span>
              </label>
            );
          })}
        </fieldset>
        <fieldset className="choix-difficulte">
          <legend className="champ-titre">Mode</legend>
          <label className={`option${mode === "evaluation" ? " est-choisie" : ""}`}>
            <input type="radio" name="mode" checked={mode === "evaluation"} onChange={() => setMode("evaluation")} />
            <span>
              <strong>Évaluation</strong> — correction à la fin
              <br />
              <span className="legende">
                Le résultat entre dans la session et peut être porté au rapport (étape 2 sur 6).
                {nbReservees > 0
                  ? ` En Habilitation et Complet, ${nbReservees} question${nbReservees > 1 ? "s" : ""} réservée${nbReservees > 1 ? "s" : ""} à l'évaluation, jamais vue${nbReservees > 1 ? "s" : ""} en entraînement, ${nbReservees > 1 ? "sont tirées" : "est tirée"} en priorité.`
                  : ""}
                {bilanEvaluation.obligatoires > 0
                  ? ` ${bilanEvaluation.obligatoires} question${bilanEvaluation.obligatoires > 1 ? "s" : ""} obligatoire${bilanEvaluation.obligatoires > 1 ? "s" : ""} ${bilanEvaluation.obligatoires > 1 ? "sont posées" : "est posée"} à chaque évaluation Habilitation et Complet.`
                  : ""}
                {annonceEcartees(bilanEvaluation.remplacees, bilanEvaluation.nonRemplacees)}
                {nbADecouvrir > 0
                  ? ` La banque compte ${nbADecouvrir > 1 ? `${nbADecouvrir} schémas` : "un schéma"} à découvrir : s'il est tiré, votre tuteur, assis à côté de vous, juge chaque cache et confirme par son propre code à la validation.`
                  : ""}
              </span>
            </span>
          </label>
          <label className={`option${mode === "entrainement" ? " est-choisie" : ""}`}>
            <input type="radio" name="mode" checked={mode === "entrainement"} onChange={() => setMode("entrainement")} />
            <span>
              <strong>Entraînement</strong> — correction immédiate, question par question
              <br />
              <span className="legende">
                Rien n&apos;est enregistré ni comptabilisé : la justification et la source s&apos;affichent après chaque réponse.
                {nbReservees > 0 ? " Les questions réservées à l'évaluation n'y sont jamais posées." : ""}
              </span>
            </span>
          </label>
        </fieldset>
        {identifiant && (
          <form action={actionDetacher} className="encart">
            Rattaché à l&apos;identifiant <strong>{identifiant}</strong> : vos évaluations sont conservées sous
            cet identifiant.{" "}
            <button type="submit" className="bouton bouton--compact bouton--secondaire">
              Ce n&apos;est pas moi : me détacher
            </button>
          </form>
        )}
        <div className="actions">
          <button type="button" className="bouton" onClick={() => setDemarre(true)}>
            Commencer
          </button>
          <Link href={`/module/${moduleId}${requete}`} className="bouton bouton--secondaire">
            Revoir le module
          </Link>
        </div>
      </section>
    );
  }

  // ──────────────────────────────────────────────────── blocs partagés
  /**
   * Correction reportée sur les propositions (audit du 24/09/2026, E1) : QIM
   * jugée ligne à ligne, ou QCM (et QIM en cases). `null` pour les autres
   * formats, ou quand deux propositions ont le même texte (`content/marques.ts`).
   */
  const marquesDe = (q: QuestionPublique, d: DetailQuestion) =>
    q.type === "QIM" && qimEnVraiFaux
      ? { qim: marquesQim(q.options, qim[q.id] ?? {}, d.reponsesAttendues), options: null }
      : q.type === "QCM" || q.type === "QIM"
        ? { qim: null, options: marquesOptions(q.options, reponses[q.id] ?? [], d.reponsesAttendues) }
        : { qim: null, options: null };

  /**
   * Sous la question qu'elle corrige (entraînement, `sousLaQuestion`), la
   * correction ne répète ni l'énoncé ni l'image, et laisse aux propositions
   * marquées, ou au schéma révélé, ce qu'ils disent déjà. Ailleurs — fin
   * d'entraînement, résultat d'évaluation — elle reste complète : la question
   * n'y est pas affichée.
   */
  const rendreCorrection = (d: DetailQuestion, i: number, q: QuestionPublique | undefined, sousLaQuestion = false) => {
    const marques = sousLaQuestion && q ? marquesDe(q, d) : null;
    const reportee = Boolean(marques?.qim ?? marques?.options) || (sousLaQuestion && d.type === "SCH" && Boolean(d.legendes));
    return (
    <div
      key={d.questionId}
      ref={sousLaQuestion ? refCorrection : undefined}
      tabIndex={sousLaQuestion ? -1 : undefined}
      role={sousLaQuestion ? "group" : undefined}
      aria-labelledby={sousLaQuestion ? `correction-${d.questionId}` : undefined}
      className={`correction ${classeCorrection(d)}`}
    >
      <div className="etape-tete" id={sousLaQuestion ? `correction-${d.questionId}` : undefined}>
        <strong>Question {i + 1}</strong>
        <span className="etiquette etiquette--neutre">{etatLisible(d)}</span>
        {d.eliminatoire && <span className="etiquette etiquette--obligatoire">Éliminatoire</span>}
        {d.reservee && <span className="etiquette etiquette--neutre">Réservée à l&apos;évaluation</span>}
        {d.obligatoire && <span className="etiquette etiquette--neutre">Obligatoire</span>}
        <span style={{ marginLeft: "auto", fontWeight: 650 }}>{nombre(d.note)} pt</span>
      </div>
      {!sousLaQuestion && (
        <p>
          <strong>{d.enonce}</strong>
        </p>
      )}
      {!sousLaQuestion && d.type !== "SCH" && q?.image && (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={q.image.url} alt={q.image.alt} className="illustration-question" />
      )}
      {reportee ? null : d.type === "SCH" && q && d.legendes ? (
        <SchemaQuestion question={q} valeurs={{}} verrouille revelation={d.legendes} />
      ) : (
        <p className="legende">
          Votre réponse&nbsp;: {d.choixApprenant.length > 0 ? d.choixApprenant.join(" · ") : "aucune"}
          <br />
          Attendu&nbsp;: {d.reponsesAttendues.join(" · ")}
        </p>
      )}
      {d.justification && <p style={{ maxWidth: "66ch" }}>{d.justification}</p>}
      {d.sources.length > 0 && (
        <p className="source">Source&nbsp;: {d.sources.join(" ; ")}</p>
      )}
      {signalementPossible && <Signaler questionId={d.questionId} moduleId={moduleId} />}
    </div>
    );
  };

  const rendreVignette = (q: QuestionPublique, nbQuestions: number) =>
    q.situation ? (
      <section className="vignette">
        <p className="sur-titre">Mise en situation — lisez posément</p>
        <h3>{q.situation.titre}</h3>
        {q.situation.contexte.split(/\n{2,}/).map((p, j) => (
          <p key={j}>{p}</p>
        ))}
        <p className="legende" style={{ marginBottom: 0 }}>
          {nbQuestions > 1 ? `${nbQuestions} questions portent` : "Une question porte"} sur cette situation.
        </p>
      </section>
    ) : null;

  const rendreQuestion = (q: QuestionPublique, i: number, total: number, verrouille: boolean) => {
    const enVraiFaux = q.type === "QIM" && qimEnVraiFaux;
    // Question corrigée (entraînement) : la correction se lit sur les propositions (E1).
    const corrigee = verrouille ? corrections[q.id] : undefined;
    const marques = corrigee ? marquesDe(q, corrigee) : null;
    return (
      <fieldset className="question" id={`question-${i + 1}`} disabled={verrouille}>
        <legend>
          <span className="legende">
            Question {i + 1} / {total}
          </span>
        </legend>

        <div className="etape-tete">
          <span className="etiquette etiquette--site">{libelleFormat(q)}</span>
          {q.eliminatoire && <span className="etiquette etiquette--obligatoire">Éliminatoire</span>}
          {q.reservee && <span className="etiquette etiquette--neutre">Réservée à l&apos;évaluation</span>}
          {q.obligatoire && <span className="etiquette etiquette--neutre">Obligatoire</span>}
        </div>

        {q.type === "TAT" ? (
          <TrousQuestion
            question={q}
            valeurs={trous[q.id] ?? {}}
            onChange={(trou, optId) => remplirTrou(q.id, trou, optId)}
            verrouille={verrouille}
          />
        ) : (
          <p className="question-enonce">{q.enonce}</p>
        )}
        {q.type !== "SCH" && q.image && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={q.image.url} alt={q.image.alt} className="illustration-question" />
        )}
        <p className="question-bareme">{libelleBareme(q, bareme)}</p>

        {q.type === "SCH" ? (
          <SchemaQuestion
            question={q}
            valeurs={legendes[q.id] ?? {}}
            onChange={(lid, v) => ecrireLegende(q.id, lid, v)}
            verrouille={verrouille}
            reveles={reveles[q.id] ?? []}
            onReveler={(lid) => leverCache(q.id, lid)}
            jugements={jugements[q.id] ?? {}}
            onJuger={(lid, j) => jugerCache(q.id, lid, j)}
            juge={mode === "evaluation" ? "tuteur" : "apprenant"}
            revelation={corrigee?.legendes}
          />
        ) : q.type === "ORD" ? (
          <OrdreQuestion
            question={q}
            valeurs={rangs[q.id] ?? {}}
            onChange={(optId, rang) => placerRang(q.id, optId, rang)}
            verrouille={verrouille}
          />
        ) : q.type === "TAT" ? null : enVraiFaux ? (
          <>
            <p className="question-avertissement">
              Chaque proposition se juge séparément. « Je ne sais pas » ne rapporte ni ne retire
              rien ; une proposition laissée de côté compte de la même façon.
            </p>
            {q.options.map((o) => {
              const v = qim[q.id]?.[o.id];
              const m = marques?.qim?.[o.id];
              return (
                <div key={o.id} className={`proposition${m ? ` proposition--${m.verdict}` : ""}`}>
                  <span className="libelle">{o.texte}</span>
                  <span className="jugement">
                    <label>
                      <input
                        type="radio"
                        name={`${q.id}-${o.id}`}
                        checked={v === true}
                        onChange={() => jugerQim(q.id, o.id, true)}
                      />
                      <span>Vrai</span>
                    </label>
                    <label>
                      <input
                        type="radio"
                        name={`${q.id}-${o.id}`}
                        checked={v === false}
                        onChange={() => jugerQim(q.id, o.id, false)}
                      />
                      <span>Faux</span>
                    </label>
                    <label>
                      <input
                        type="radio"
                        name={`${q.id}-${o.id}`}
                        checked={v === "nsp"}
                        onChange={() => jugerQim(q.id, o.id, "nsp")}
                      />
                      <span>Je ne sais pas</span>
                    </label>
                  </span>
                  {m && (
                    <span className="marque">
                      <span aria-hidden="true">{m.verdict === "juste" ? "✓ " : m.verdict === "faux" ? "✗ " : "– "}</span>
                      Vous&nbsp;: {m.vous === true ? "Vrai" : m.vous === false ? "Faux" : m.vous === "nsp" ? "Je ne sais pas" : "sans réponse"}
                      {" · "}Attendu&nbsp;: {m.attendu ? "Vrai" : "Faux"}
                    </span>
                  )}
                </div>
              );
            })}
          </>
        ) : (
          q.options.map((o) => {
            const m = marques?.options?.[o.id] ?? null;
            return (
              <label key={o.id} className={`option${m ? ` option--${m}` : ""}`}>
                <input
                  type={estUneSeule(q) ? "radio" : "checkbox"}
                  name={q.id}
                  checked={(reponses[q.id] ?? []).includes(o.id)}
                  onChange={() => basculer(q, o.id)}
                />
                <span>{o.texte}</span>
                {m && (
                  <span className="marque">
                    <span aria-hidden="true">{m === "attendue" ? "✓ " : "✗ "}</span>
                    {m === "attendue" ? "attendue" : "non attendue"}
                  </span>
                )}
              </label>
            );
          })
        )}
      </fieldset>
    );
  };

  // ────────────────────────────────────────────────────────────── correction
  if (resultat) {
    const decision = decider(resultat.detail, resultat.seuilReussite, { minQuestions: resultat.minQuestions, bande: resultat.bareme?.bande });
    const classeVerdict =
      decision.verdictBrut === "acquis"
        ? "resultat-entete--acquis"
        : decision.verdictBrut === "non_acquis"
          ? "resultat-entete--refuse"
          : decision.verdictBrut === "indetermine"
            ? "resultat-entete--indetermine"
            : "resultat-entete--non-concluant";
    return (
      <>
        <div className={`resultat-entete ${classeVerdict}`} role="status">
          <span className="score">{resultat.score}&nbsp;%</span>
          <div>
            <h2 style={{ margin: 0 }}>{LIBELLES_VERDICT[decision.verdictBrut]}</h2>
            <p style={{ margin: ".25rem 0 0" }}>
              {nombre(resultat.pointsObtenus)} / {resultat.pointsTotal} points — seuil de réussite {seuil}&nbsp;%
              — bande de garde {decision.bandeBasse} à {decision.bandeHaute}&nbsp;% — {resultat.tirage}
              {resultat.reservees && resultat.reservees.posees > 0
                ? ` — dont ${resultat.reservees.posees} réservée${resultat.reservees.posees > 1 ? "s" : ""} à l'évaluation`
                : ""}
            </p>
          </div>
        </div>

        <p className={`encart${decision.verdictBrut === "acquis" ? "" : " encart--attention"}`}>
          {expliquerVerdict(decision)}
        </p>

        {resultat.cible && (
          <p className="legende">
            {libelleCible(resultat.cible)}
            {libelleEcartees(resultat.cible) ? ` ${libelleEcartees(resultat.cible)}` : ""}
          </p>
        )}

        {resultat.jugement && resultat.jugement.role !== "apprenant" && (
          <p className="encart">
            Caches des schémas à découvrir jugés par <strong>{resultat.jugement.par}</strong>, qui l&apos;a
            confirmé par son propre code d&apos;accès. La mention est scellée dans le résultat.
          </p>
        )}

        {resultat.detail.map((d, i) => rendreCorrection(d, i, posees.find((q) => q.id === d.questionId)))}

        {/* La fiche montrée est celle que le résultat scelle et que le rapport cite (question 59). */}
        <Synthese docs={resultat.fiches ?? syntheses} moduleId={moduleId} signalementPossible={signalementPossible} />

        <p className="encart">
          <strong>Ce résultat ne vaut pas habilitation.</strong> Il constitue la preuve de
          l&apos;étape 2 sur 6 : exportez le rapport depuis l&apos;accueil et remettez-le pour votre
          dossier. Le compagnonnage et l&apos;évaluation pratique au poste restent à faire.
        </p>

        <div className="actions">
          <button type="button" className="bouton" onClick={recommencer}>
            Nouveau tirage
          </button>
          {boutonRatees(resultat.detail.filter((d) => !d.correct).map((d) => d.questionId))}
          {lienSuivant}
          <Link href="/#rapport" className="bouton bouton--secondaire">
            Rapport de session
          </Link>
          <Link href={`/module/${moduleId}${requete}`} className="bouton bouton--secondaire">
            Revoir le module
          </Link>
        </div>
      </>
    );
  }

  // ───────────────────────────────────────────── entraînement, une à la fois
  if (mode === "entrainement") {
    if (entrainementFini || posees.length === 0) {
      const justes = posees.filter((q) => corrections[q.id]?.correct).length;
      const points = posees.reduce((s, q) => s + (corrections[q.id]?.note ?? 0), 0);
      return (
        <>
          <div className="resultat-entete" role="status">
            <span className="score">{justes} / {posees.length}</span>
            <div>
              <h2 style={{ margin: 0 }}>Entraînement terminé</h2>
              <p style={{ margin: ".25rem 0 0" }}>
                {nombre(points)} point{points > 1 ? "s" : ""} sur {posees.length} — non enregistré, non comptabilisé.
                Pour produire une preuve, relancez en mode évaluation.
              </p>
            </div>
          </div>
          {posees.map((q, i) => corrections[q.id] && rendreCorrection(corrections[q.id], i, q))}
          <Synthese docs={syntheses} moduleId={moduleId} signalementPossible={signalementPossible} />
          <div className="actions">
            <button type="button" className="bouton" onClick={recommencer}>
              Nouveau tirage
            </button>
            {boutonRatees(posees.filter((q) => corrections[q.id] && !corrections[q.id].correct).map((q) => q.id))}
            {lienSuivant}
            <Link href={`/module/${moduleId}${requete}`} className="bouton bouton--secondaire">
              Revoir le module
            </Link>
          </div>
        </>
      );
    }
    const q = posees[indexCourant];
    const correction = corrections[q.id];
    const nbSituation = q.situation ? posees.filter((x) => x.situation?.id === q.situation!.id).length : 0;
    return (
      <div className="passation" ref={refPassation} style={{ paddingBottom: "120px" }}>
        {sousEnsemble?.revoir && (
          <p className="encart">
            À revoir · {posees.length} question{posees.length > 1 ? "s" : ""} ratée{posees.length > 1 ? "s" : ""} : entraînement sur ces
            questions seulement, rien n&apos;est enregistré.
          </p>
        )}
        {rendreVignette(q, nbSituation)}
        {rendreQuestion(q, indexCourant, posees.length, Boolean(correction))}
        {erreur && <p className="encart encart--attention">{erreur}</p>}
        {correction && rendreCorrection(correction, indexCourant, q, true)}
        <div className="barre-passation">
          <div className="barre-passation-interne">
            <div style={{ flex: "1 1 14rem", minWidth: 0 }}>
              <p className="legende" style={{ margin: "0 0 .25rem" }}>
                {identifiant ? `${identifiant} · ` : ""}Question {indexCourant + 1} / {posees.length} — {moduleTitre} — entraînement
              </p>
              <PastillesQuestions
                faites={posees.map((x) => Boolean(corrections[x.id]))}
                courante={indexCourant}
                libelle="Questions corrigées"
              />
              <p className="legende" style={{ margin: ".25rem 0 0" }}>
                Avancement de cet entraînement — rien n&apos;est enregistré.
              </p>
            </div>
            {correction ? (
              <button
                type="button"
                className="bouton"
                onClick={() => {
                  // Le défilement vers la question suivante suit le rendu (E2, effet plus haut).
                  if (indexCourant + 1 >= posees.length) terminerEntrainement();
                  else setIndexCourant(indexCourant + 1);
                }}
              >
                {indexCourant + 1 >= posees.length ? "Terminer" : "Question suivante"}
              </button>
            ) : (
              <button
                type="button"
                className="bouton"
                disabled={envoi || !estRenseignee(q)}
                onClick={() => void verifierCourante()}
              >
                {envoi ? "Correction…" : "Vérifier"}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ───────────────────────────────────────────────────── passation complète
  const repondues = posees.filter(estRenseignee).length;
  const manquantes = posees.map((q, i) => (estRenseignee(q) ? 0 : i + 1)).filter((n) => n > 0);
  const aDecouvrir = posees.filter(estADecouvrir);
  const jugementRecap =
    aDecouvrir.length > 0
      ? {
          questions: aDecouvrir.length,
          juges: aDecouvrir.reduce((s, q) => s + Object.keys(jugements[q.id] ?? {}).length, 0),
          total: aDecouvrir.reduce((s, q) => s + (q.legendes?.length ?? 0), 0),
        }
      : null;
  let situationCourante: string | null = null;

  // Retour à une question depuis le récapitulatif : le panneau se ferme, la
  // question revient à l'écran et prend le focus — sans quoi le clavier reste
  // là où le panneau était.
  const allerALaQuestion = (numero: number) => {
    setRecap(false);
    const el = document.getElementById(`question-${numero}`);
    if (!el) return;
    const doux = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: doux ? "smooth" : "auto", block: "start" });
    el.querySelector<HTMLElement>("input, textarea, select, button")?.focus({
      preventScroll: true,
    });
  };

  return (
    <div className="passation" ref={refPassation} style={{ paddingBottom: "120px" }}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setRecap(true);
        }}
      >
        {posees.map((q, i) => {
          const nouvelleSituation = q.situation && q.situation.id !== situationCourante;
          if (q.situation) situationCourante = q.situation.id;
          const nbSituation = q.situation ? posees.filter((x) => x.situation?.id === q.situation!.id).length : 0;
          return (
            <div key={q.id}>
              {nouvelleSituation && rendreVignette(q, nbSituation)}
              {rendreQuestion(q, i, posees.length, false)}
            </div>
          );
        })}

        {erreur && <p className="encart encart--attention">{erreur}</p>}

        <div className="barre-passation">
          <div className="barre-passation-interne">
            <div style={{ flex: "1 1 14rem", minWidth: 0 }}>
              <p className="legende" style={{ margin: "0 0 .25rem" }}>
                {identifiant ? `${identifiant} · ` : ""}{repondues} / {posees.length} questions renseignées — {moduleTitre}
              </p>
              <PastillesQuestions faites={posees.map(estRenseignee)} libelle="Questions renseignées" />
              <p className="legende" style={{ margin: ".25rem 0 0" }}>
                Avancement de cette session — ce n&apos;est pas un avancement d&apos;habilitation.
              </p>
            </div>
            <button type="submit" className="bouton" disabled={envoi || repondues === 0}>
              {envoi ? "Correction…" : "Valider l'évaluation"}
            </button>
          </div>
        </div>
      </form>
      {recap && (
        <RecapitulatifValidation
          total={posees.length}
          renseignees={repondues}
          manquantes={manquantes}
          surQuestion={allerALaQuestion}
          surValider={() => void soumettre()}
          surFermer={() => {
            setRecap(false);
            setErreurRecap(null);
          }}
          jugement={jugementRecap}
          codeTuteur={codeTuteur}
          surCodeTuteur={setCodeTuteur}
          envoi={envoi}
          erreur={erreurRecap}
          identifiant={identifiant}
        />
      )}
    </div>
  );
}
