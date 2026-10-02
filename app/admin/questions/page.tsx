import Link from "next/link";
import { getSession } from "@/lib/auth";
import {
  comptesParModule,
  depotsEnBanque,
  listerQuestions,
  questionsAuCompte,
  signalementsOuvertsParQuestion,
  type LigneQuestion,
  type StatutQuestion,
} from "@/content/banque-db";
import { getTousModulesAvecDeposes } from "@/content/store";
import { LIBELLES_STATUT, etiquetteModule, moduleOuvrable, titreModule as titreDe } from "./commun";
import { getReferentiel } from "@/content/referentiel-db";
import { ArbreBanque } from "@/components/ArbreBanque";
import { NIVEAUX_QUESTION, type NiveauQuestion } from "@/content/types";
import { lireNomsNiveaux } from "@/lib/niveaux-questions-db";
import { libellesDe } from "@/content/niveaux-questions";
import { compterFichesAVerifier, listerFiches } from "@/lib/fiches-db";
import { ancreDe, construireArbre, cumulDistinct, elaguer, lireChemin, lirePlis } from "@/content/arbre-banque";
import { listeBlocs } from "@/content/blocs-db";
import {
  blocsDeLaQuestion,
  etiquettesProfil,
  libelleProfils,
  modulesDeLaQuestion,
  poseeAuProfil,
  type ModuleDeRattachement,
} from "@/content/rattachement-question";
import { RetourBranche } from "@/components/RetourBranche";
import { conservationActive } from "@/lib/config";
import { questionARevoir, reperes, tauxAgents } from "@/lib/statistiques";
import { reperesBanque } from "@/lib/statistiques-db";
import { SectionFiches } from "./fiches";
import { ArborescenceBanque } from "./arborescence";
import { SelectionBanque } from "@/components/SelectionBanque";
import { ERREURS_LOT, bilanLot, lireGeste, lireStatutLot } from "@/content/lot-questions";
import { RECHERCHE_MAX, TRIS_BANQUE, lireTri, motsRecherche, questionCorrespond, trierQuestions } from "@/content/filtres-banque";
import {
  ActionsQuestion,
  CaseModule,
  CaseQuestion,
  ContenuQuestion,
  EtiquettesQuestion,
  RattachementQuestion,
  StatistiqueQuestion,
  TraceQuestion,
  type LecturesRattachement,
  type StatQuestion,
} from "./question-banque";

export const dynamic = "force-dynamic";

const MESSAGES: Record<string, string> = {
  creee: "Question créée.",
  modifiee: "Question enregistrée.",
  "fiche-deposee": "Fiche de synthèse déposée, à vérifier : elle n'est montrée qu'une fois validée.",
  "fiche-validee": "Fiche de synthèse validée : elle est montrée en fin de test et citée par le rapport.",
  "fiche-retiree": "Fiche de synthèse retirée : elle n'est plus montrée.",
  "fiche-remise": "Fiche de synthèse remise à vérifier : elle n'est plus montrée jusqu'à sa validation.",
  "fiche-corrigee": "Version corrigée déposée : la fiche repart à vérifier.",
};

/** Refus d'un geste sur une fiche de synthèse (questions 59 et 60). */
const ERREURS_FICHE: Record<string, string> = {
  "fiche-quatre-yeux":
    "Règle des quatre yeux : une fiche se valide par un autre code que celui qui l'a déposée ou corrigée — ou par lui, s'il est d'administration.",
  "fiche-inconnue": "Fiche inconnue, ou déjà traitée.",
  "fiche-module": "Choisissez d'abord le module de la fiche.",
  "fiche-fichier-manquant": "Aucun fichier sélectionné.",
  "fiche-trop-lourde": "Fichier trop lourd.",
  "fiche-type-refuse": "Type de fichier refusé : PDF, image, vidéo, texte, Word, PowerPoint ou Excel.",
  "fiche-stockage": "Aucun stockage de fichiers n'est disponible.",
};

const LOUPE = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
);

function minusculeInitiale(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

/** Date d'un dépôt, au jour de Paris. */
function jourDe(texte: string): string {
  const d = new Date(texte);
  return Number.isNaN(d.getTime()) ? texte.slice(0, 10) : d.toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" });
}

export default async function Questions({
  searchParams,
}: {
  searchParams: Promise<{
    module?: string;
    statut?: string;
    niveau?: string;
    obligatoires?: string;
    /** Question 74 : bloc de compétence, filière et niveau d'habilitation. */
    bloc?: string;
    filiere?: string;
    habilitation?: string;
    /** Question 78 : « a-revoir », les questions que leurs statistiques signalent. */
    stat?: string;
    /** Question 89, lot 2 : recherche, dépôt (« aucun » : écrites à la main), signalées, tri. */
    q?: string;
    depot?: string;
    signalees?: string;
    tri?: string;
    vue?: string;
    plis?: string;
    ouvrir?: string;
    ok?: string;
    erreur?: string;
    /** Bilan d'un geste en lot (questions 88 et 89) : geste, questions changées, validées revenues à vérifier… */
    geste?: string;
    nb?: string;
    revues?: string;
    vers?: string;
    mods?: string;
    ajouts?: string;
    cible?: string;
    auteur?: string;
    refus?: string;
  }>;
}) {
  const p = await searchParams;
  // Vue « Arborescence » (question 64, choix b), par défaut depuis le 24/09/2026, et
  // depuis le 01/10/2026 pour toutes les entrées, validation comprise : la liste ne
  // s'ouvre que par la bascule (`vue=liste`), puis se garde après chaque geste.
  const vueArbre = p.vue !== "liste";
  const session = (await getSession())!;
  const modules = await getTousModulesAvecDeposes();
  const statut = (["a_verifier", "valide", "retire"] as const).includes(p.statut as StatutQuestion)
    ? (p.statut as StatutQuestion)
    : undefined;
  const moduleId = modules.some((m) => m.id === p.module) ? p.module : undefined;
  // Filtre par niveau : « a_preciser » retient les questions sans niveau.
  const filtreNiveau: NiveauQuestion | "a_preciser" | undefined =
    p.niveau === "a_preciser"
      ? "a_preciser"
      : (NIVEAUX_QUESTION as readonly string[]).includes(p.niveau ?? "")
        ? (p.niveau as NiveauQuestion)
        : undefined;
  const [toutes, comptes, referentiel, signales, fiches, fichesAVerifier, auCompte, brutStats, blocsServis, nomsNiveaux, depots] =
    await Promise.all([
      listerQuestions({ moduleId, statut }),
      comptesParModule(),
      getReferentiel(),
      signalementsOuvertsParQuestion(),
      // Fiches de synthèse (question 59) : celles du module choisi, ou, sous le
      // filtre « à vérifier », celles qui attendent une validation.
      moduleId ? listerFiches({ moduleId }) : statut === "a_verifier" ? listerFiches({ statut: "a_verifier" }) : Promise.resolve([]),
      compterFichesAVerifier(),
      questionsAuCompte(),
      // Statistiques de réussite (question 78) : réussite et discrimination de chaque question, sur les essais conservés.
      conservationActive() ? reperesBanque().catch(() => new Map()) : Promise.resolve(new Map()),
      // Blocs servis, fiche et dépôts (question 81) : ceux que le filtre propose et accepte.
      listeBlocs(),
      // Noms des niveaux de question en vigueur (question 81).
      lireNomsNiveaux(),
      // Dépôts dont des questions sont encore en banque (question 89, lot 2).
      depotsEnBanque(),
    ]);
  const libellesNiveaux = libellesDe(nomsNiveaux);
  const stats = new Map<string, StatQuestion>(
    [...brutStats.values()].map((s) => {
      const reussite = tauxAgents(s.justes, s.n, s.agents);
      return [s.question_id, { reussite, discrimination: s.r, reperes: reperes(reussite, s.r) }];
    }),
  );
  const seulesARevoir = p.stat === "a-revoir";
  // Question 74 (choix c) : filtres par bloc et par profil. Un bloc se lit sur les modules de la
  // question et sur ses étiquettes ; un profil, sur ses modules et ses étiquettes de profil.
  const filtreBloc = blocsServis.find((b) => String(b.numero) === p.bloc)?.numero;
  const filtreFiliere = referentiel.filieres.find((f) => f.id !== "socle" && f.id === p.filiere)?.id;
  const filtreHabilitation = referentiel.niveaux.map((n) => String(n.code)).find((c) => c === p.habilitation);
  // Question 89, lot 2 : recherche dans le texte, dépôt d'origine, signalement ouvert, tri.
  const recherche = (p.q ?? "").replace(/\s+/g, " ").trim().slice(0, RECHERCHE_MAX);
  const mots = motsRecherche(recherche);
  const filtreDepot = p.depot === "aucun" ? "aucun" : depots.find((d) => d.id === p.depot)?.id;
  const seulesSignalees = p.signalees === "1";
  const tri = lireTri(p.tri);
  const rattachements = new Map<string, ModuleDeRattachement>(
    modules.map((m) => [
      m.id,
      { id: m.id, bloc: typeof m.bloc === "number" ? m.bloc : null, postes: m.postes ?? [], niveaux: (m.niveaux ?? []).map(String) },
    ]),
  );
  // Sous un filtre de module, le profil se juge sur ce module seul.
  const dansLeModule = (q: LigneQuestion) => (moduleId ? { ...q, module_id: moduleId, aussi_dans: [] } : q);
  // Filtre des obligatoires (question 63) : le socle posé à chaque évaluation, module par module.
  const seulesObligatoires = p.obligatoires === "1";
  const questions = trierQuestions(
    toutes.filter(
      (q) =>
        (!filtreNiveau || (filtreNiveau === "a_preciser" ? !q.niveau_question : q.niveau_question === filtreNiveau)) &&
        (!seulesObligatoires || q.obligatoire) &&
        (filtreBloc === undefined || blocsDeLaQuestion(q, rattachements).includes(filtreBloc)) &&
        (!seulesARevoir || questionARevoir(stats.get(q.id)?.reperes ?? [])) &&
        (!(filtreFiliere || filtreHabilitation) ||
          poseeAuProfil(dansLeModule(q), { filiere: filtreFiliere ?? null, niveau: filtreHabilitation ?? null }, rattachements)) &&
        (!filtreDepot || (filtreDepot === "aucun" ? !q.depot_id : q.depot_id === filtreDepot)) &&
        (!seulesSignalees || (signales[q.id] ?? 0) > 0) &&
        questionCorrespond(q, mots),
    ),
    tri,
  );
  // Liste : chaque question sous son module d'origine, ou sous le module filtré. Arborescence : sous
  // chacun des modules où elle est posée (question 74).
  const parModule = new Map<string, typeof questions>();
  const parModuleArbre = new Map<string, typeof questions>();
  const ranger = (carte: Map<string, typeof questions>, m: string, q: LigneQuestion) =>
    carte.set(m, [...(carte.get(m) ?? []), q]);
  for (const q of questions) {
    ranger(parModule, moduleId ?? q.module_id, q);
    for (const m of moduleId ? [moduleId] : modulesDeLaQuestion(q)) ranger(parModuleArbre, m, q);
  }
  // Cumul d'une branche : chaque question une fois, même posée dans plusieurs de ses modules.
  const cumul = (liste: { id: string }[]) => cumulDistinct(liste.map((m) => m.id), auCompte);
  const lectures: LecturesRattachement = {
    titreModule: (id) => titreDe(modules, id),
    blocs: (q) => blocsDeLaQuestion(q, rattachements),
    profils: (q) => libelleProfils(etiquettesProfil(q), referentiel.filieres),
  };
  // Filtres gardés après chaque geste, dans les deux vues. Le niveau et les
  // obligatoires, venus après l'adresse de retour, s'y perdaient.
  const filtres: [string, string][] = [
    ...(moduleId ? [["module", moduleId] as [string, string]] : []),
    ...(statut ? [["statut", statut] as [string, string]] : []),
    ...(filtreNiveau ? [["niveau", filtreNiveau] as [string, string]] : []),
    ...(seulesObligatoires ? [["obligatoires", "1"] as [string, string]] : []),
    ...(filtreBloc !== undefined ? [["bloc", String(filtreBloc)] as [string, string]] : []),
    ...(filtreFiliere ? [["filiere", filtreFiliere] as [string, string]] : []),
    ...(filtreHabilitation ? [["habilitation", filtreHabilitation] as [string, string]] : []),
    ...(seulesARevoir ? [["stat", "a-revoir"] as [string, string]] : []),
    ...(recherche ? [["q", recherche] as [string, string]] : []),
    ...(filtreDepot ? [["depot", filtreDepot] as [string, string]] : []),
    ...(seulesSignalees ? [["signalees", "1"] as [string, string]] : []),
    ...(tri ? [["tri", tri] as [string, string]] : []),
  ];
  const retour = `/admin/questions?${new URLSearchParams([["vue", "liste"], ...filtres]).toString()}`;
  const titreModule = (id: string) => titreDe(modules, id);
  const lienVue = (arbre: boolean) =>
    `/admin/questions?${new URLSearchParams([["vue", arbre ? "arbre" : "liste"], ...filtres]).toString()}`;

  // Arborescence : filière, niveau, module, question. Sous un filtre de
  // question, elle ne garde que les branches qui en portent ; sous le seul
  // filtre de module, les branches du module, même vide.
  const plis = lirePlis(p.plis);
  const ouvrir = vueArbre ? lireChemin(p.ouvrir) : null;
  // Vue, filtres et repli, gardés par chaque lien et chaque geste de l'arborescence.
  const parametresArbre: [string, string][] = [
    ["vue", "arbre"],
    ...filtres,
    ...(plis === "defaut" ? [] : [["plis", plis] as [string, string]]),
  ];
  // Adresse de la vue courante, filtres compris : un geste ou une création y ramène.
  const retourVue = vueArbre ? `/admin/questions?${new URLSearchParams(parametresArbre).toString()}` : retour;
  // Gestes en lot (questions 88 et 89) : tous les modules, les retirés se quittent sans se rejoindre ;
  // la clé fait repartir la sélection à chaque page.
  const ciblesLot = modules.map((m) => ({
    id: m.id,
    libelle: `${etiquetteModule(m)} — ${m.titre}`,
    bloc: typeof m.bloc === "number" ? m.bloc : null,
    retire: m.statut === "retire",
  }));
  const niveauxLot = [
    ...NIVEAUX_QUESTION.map((n) => ({ code: n as string, libelle: libellesNiveaux[n] })),
    { code: "a_preciser", libelle: "À préciser" },
  ];
  const cleSelection = new URLSearchParams(
    Object.entries(p).filter((e): e is [string, string] => typeof e[1] === "string"),
  ).toString();
  const filtreQuestions = Boolean(
    statut ||
      filtreNiveau ||
      seulesObligatoires ||
      filtreBloc !== undefined ||
      filtreFiliere ||
      filtreHabilitation ||
      seulesARevoir ||
      recherche ||
      filtreDepot ||
      seulesSignalees,
  );
  const complet = vueArbre
    ? construireArbre(
        referentiel.filieres,
        referentiel.niveaux.map((n) => ({ code: String(n.code), libelle: n.libelle })),
        modules.map((m) => ({
          id: m.id,
          titre: m.titre,
          etiquette: etiquetteModule(m),
          postes: m.postes ?? [],
          niveaux: (m.niveaux ?? []).map(String),
        })),
      )
    : [];
  const arbre =
    filtreQuestions || moduleId
      ? elaguer(complet, (id) => (!moduleId || id === moduleId) && (!filtreQuestions || (parModuleArbre.get(id)?.length ?? 0) > 0))
      : complet;

  // Puces des filtres actifs (question 89, lot 2) : chacune retire le sien.
  const libelleDepot = (id: string) => {
    const d = depots.find((x) => x.id === id);
    return d ? `${jourDe(d.depose_le)} — ${d.nom}` : id;
  };
  // Comme le formulaire, une puce garde la vue et laisse le repli à son défaut.
  const vue: [string, string][] = [["vue", vueArbre ? "arbre" : "liste"]];
  const sans = (cle: string) => `/admin/questions?${new URLSearchParams([...vue, ...filtres.filter(([k]) => k !== cle)]).toString()}`;
  const puces: { cle: string; libelle: string }[] = [
    ...(recherche ? [{ cle: "q", libelle: `Recherche : « ${recherche} »` }] : []),
    ...(statut ? [{ cle: "statut", libelle: `Statut : ${LIBELLES_STATUT[statut].toLowerCase()}` }] : []),
    ...(moduleId ? [{ cle: "module", libelle: `Module : ${titreModule(moduleId).slice(0, 60)}` }] : []),
    ...(filtreNiveau
      ? [{ cle: "niveau", libelle: `Niveau : ${filtreNiveau === "a_preciser" ? "à préciser" : libellesNiveaux[filtreNiveau]}` }]
      : []),
    ...(filtreDepot
      ? [{ cle: "depot", libelle: filtreDepot === "aucun" ? "Écrites dans l'éditeur, sans dépôt" : `Dépôt du ${libelleDepot(filtreDepot).slice(0, 70)}` }]
      : []),
    ...(seulesSignalees ? [{ cle: "signalees", libelle: "Signalées" }] : []),
    ...(filtreBloc !== undefined ? [{ cle: "bloc", libelle: `Bloc ${filtreBloc}` }] : []),
    ...(filtreFiliere
      ? [{ cle: "filiere", libelle: `Filière : ${referentiel.filieres.find((f) => f.id === filtreFiliere)?.libelle ?? filtreFiliere}` }]
      : []),
    ...(filtreHabilitation ? [{ cle: "habilitation", libelle: `Habilitation : ${filtreHabilitation}` }] : []),
    ...(seulesObligatoires ? [{ cle: "obligatoires", libelle: "Obligatoires seulement" }] : []),
    ...(seulesARevoir ? [{ cle: "stat", libelle: "À revoir d'après les essais" }] : []),
    ...(tri ? [{ cle: "tri", libelle: `Tri : ${minusculeInitiale(TRIS_BANQUE.find((t) => t.code === tri)?.libelle ?? tri)}` }] : []),
  ];
  // Filtres repliés sous « Plus de filtres » : combien sont actifs.
  const replies = [filtreDepot, seulesSignalees, filtreBloc !== undefined, filtreFiliere, filtreHabilitation, seulesObligatoires, seulesARevoir, tri].filter(
    Boolean,
  ).length;

  // Bilan d'un geste en lot (questions 88 et 89), au retour sur la banque.
  const gesteFait = p.ok === "lot" ? lireGeste(p.geste) : null;
  const bilan = gesteFait
    ? bilanLot(
        {
          geste: gesteFait,
          nb: Number(p.nb) || 0,
          revues: Number(p.revues) || 0,
          mods: Number(p.mods) || 0,
          ajouts: Number(p.ajouts) || 0,
          statut: lireStatutLot(p.cible) ?? undefined,
          auteur: Number(p.auteur) || 0,
          refus: Number(p.refus) || 0,
        },
        gesteFait === "niveau"
          ? p.cible === "a_preciser"
            ? "à préciser"
            : libellesNiveaux[p.cible as NiveauQuestion] ?? "le niveau choisi"
          : p.vers
            ? titreModule(p.vers)
            : "le module choisi",
      )
    : null;
  const gesteRefuse = p.erreur === "lot" ? lireGeste(p.geste) : null;

  return (
    <>
      {/* Présentation resserrée (question 89, lot 2) : le reste est au menu. */}
      <section className="panneau-titre panneau-titre--compact">
        <div className="panneau-titre-tete">
          <h1>Banque de questions</h1>
          <div className="actions">
            <Link
              href={`/admin/questions/nouvelle?${new URLSearchParams([...(moduleId ? [["module", moduleId] as [string, string]] : []), ["retour", retourVue]]).toString()}`}
              className="bouton bouton--compact"
            >
              Nouvelle question
            </Link>
            <Link href="/admin/questions/import" className="bouton bouton--compact bouton--secondaire">
              Déposer des questions
            </Link>
          </div>
        </div>
        <p>
          Seules les questions <strong>validées</strong> entrent dans les tirages ; déposée ou modifiée, une question
          repart « à vérifier ». Qui voit quelle question :{" "}
          <Link href="/admin/rattachement-questions">Comment sont rattachées les questions&nbsp;?</Link>
        </p>
      </section>

      {p.ok && MESSAGES[p.ok] && <p className="encart encart--ok">{MESSAGES[p.ok]}</p>}
      {bilan && (
        <p className="encart encart--ok" role="status">
          {bilan}
        </p>
      )}
      {p.erreur === "lot" && (
        <p className="encart encart--attention" role="alert">
          {gesteRefuse ? ERREURS_LOT[gesteRefuse] : "Geste inconnu : rien n'a été fait."}
        </p>
      )}
      {p.erreur && ERREURS_FICHE[p.erreur] && (
        <p className="encart encart--attention" role="alert">
          {ERREURS_FICHE[p.erreur]}
        </p>
      )}
      {p.erreur === "quatre-yeux" && (
        <p className="encart encart--attention" role="alert">
          Règle des quatre yeux : une question se valide par un autre code que celui qui l&apos;a écrite (création ou dernière
          modification).
        </p>
      )}

      {/* Couverture de la banque, repliée (question 89, lot 2) : elle sert à se rendre à un module. */}
      {!vueArbre && (
        <ArbreBanque
          filieres={referentiel.filieres}
          niveaux={referentiel.niveaux}
          modules={modules.map((m) => ({
            id: m.id,
            titre: m.titre,
            etiquette: etiquetteModule(m),
            postes: m.postes ?? [],
            niveaux: (m.niveaux ?? []).map(String),
          }))}
          comptes={comptes}
          cumul={cumul}
          moduleActif={moduleId}
        />
      )}

      {/* Recherche et trois filtres en vue, les autres repliés ; les filtres actifs en puces (question 89, lot 2). */}
      <form method="get" className="carte filtres" role="search">
        <input type="hidden" name="vue" value={vueArbre ? "arbre" : "liste"} />
        <div className="filtres-ligne">
          <label className="recherche-banque">
            {LOUPE}
            <span className="lecture-seule">Rechercher</span>
            <input
              type="search"
              name="q"
              defaultValue={recherche}
              maxLength={RECHERCHE_MAX}
              placeholder="Rechercher : énoncé, proposition, justification, identifiant"
            />
          </label>
          <label className="champ filtre-court">
            <span>Statut</span>
            <select name="statut" defaultValue={statut ?? ""}>
              <option value="">Tous</option>
              <option value="a_verifier">À vérifier</option>
              <option value="valide">Validées</option>
              <option value="retire">Retirées</option>
            </select>
          </label>
          <label className="champ filtre-court">
            <span>Niveau de question</span>
            <select name="niveau" defaultValue={filtreNiveau ?? ""}>
              <option value="">Tous</option>
              {NIVEAUX_QUESTION.map((n) => (
                <option key={n} value={n}>{libellesNiveaux[n]}</option>
              ))}
              <option value="a_preciser">À préciser</option>
            </select>
          </label>
          <label className="champ filtre-module">
            <span>Module</span>
            <select name="module" defaultValue={moduleId ?? ""}>
              <option value="">Tous les modules</option>
              {modules.map((m) => {
                const c = comptes[m.id];
                return (
                  <option key={m.id} value={m.id}>
                    {etiquetteModule(m)} — {m.titre.slice(0, 60)}
                    {c
                      ? ` (${c.valides} validée${c.valides > 1 ? "s" : ""}, ${c.aVerifier} à vérifier${c.reservees ? `, ${c.reservees} réservée${c.reservees > 1 ? "s" : ""} à l'évaluation` : ""})`
                      : ""}
                  </option>
                );
              })}
            </select>
          </label>
        </div>
        <details className="filtres-plus">
          <summary>
            Plus de filtres et tri
            {replies > 0 && <span className="filtres-nb">{replies}</span>}
          </summary>
          <div className="filtres-panneau">
            <label className="champ">
              <span>Dépôt</span>
              <select name="depot" defaultValue={filtreDepot ?? ""}>
                <option value="">Tous les dépôts</option>
                {depots.map((d) => (
                  <option key={d.id} value={d.id}>
                    {jourDe(d.depose_le)} — {d.nom.slice(0, 50)} ({d.n})
                  </option>
                ))}
                <option value="aucun">Écrites dans l&apos;éditeur, sans dépôt</option>
              </select>
            </label>
            <label className="champ">
              <span>Signalements</span>
              <select name="signalees" defaultValue={seulesSignalees ? "1" : ""}>
                <option value="">Toutes les questions</option>
                <option value="1">Signalées, signalement ouvert</option>
              </select>
            </label>
            {/* Question 74 : bloc et profil, lus sur les modules de la question et sur ses étiquettes. */}
            <label className="champ">
              <span>Bloc de compétence</span>
              <select name="bloc" defaultValue={filtreBloc !== undefined ? String(filtreBloc) : ""}>
                <option value="">Tous</option>
                {blocsServis.map((b) => (
                  <option key={b.numero} value={b.numero}>
                    {b.numero} — {b.titre.slice(0, 50)}
                  </option>
                ))}
              </select>
            </label>
            <label className="champ">
              <span>Filière</span>
              <select name="filiere" defaultValue={filtreFiliere ?? ""}>
                <option value="">Toutes</option>
                {referentiel.filieres
                  .filter((f) => f.id !== "socle")
                  .map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.libelle}
                    </option>
                  ))}
              </select>
            </label>
            <label className="champ">
              <span>Niveau d&apos;habilitation</span>
              <select name="habilitation" defaultValue={filtreHabilitation ?? ""}>
                <option value="">Tous</option>
                {referentiel.niveaux.map((n) => (
                  <option key={String(n.code)} value={String(n.code)}>
                    {n.libelle}
                  </option>
                ))}
              </select>
            </label>
            <label className="champ">
              <span>Obligatoires</span>
              <select name="obligatoires" defaultValue={seulesObligatoires ? "1" : ""}>
                <option value="">Toutes les questions</option>
                <option value="1">Obligatoires seulement</option>
              </select>
            </label>
            <label className="champ">
              <span>Statistiques</span>
              <select name="stat" defaultValue={seulesARevoir ? "a-revoir" : ""}>
                <option value="">Toutes les questions</option>
                <option value="a-revoir">À revoir d&apos;après les essais</option>
              </select>
            </label>
            <label className="champ">
              <span>Trier, dans chaque module</span>
              <select name="tri" defaultValue={tri}>
                {TRIS_BANQUE.map((t) => (
                  <option key={t.code} value={t.code}>
                    {t.libelle}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </details>
        <div className="actions filtres-pied">
          <button type="submit" className="bouton bouton--compact bouton--secondaire">
            Filtrer
          </button>
          <span className="legende">
            {questions.length} question{questions.length > 1 ? "s" : ""}
            {fichesAVerifier > 0 && (
              <>
                {" · "}
                <Link href={`/admin/questions?vue=${vueArbre ? "arbre" : "liste"}&statut=a_verifier#fiches`}>
                  {fichesAVerifier} fiche{fichesAVerifier > 1 ? "s" : ""} de synthèse à vérifier
                </Link>
              </>
            )}
          </span>
        </div>
        {puces.length > 0 && (
          <p className="puces" aria-label="Filtres actifs">
            {puces.map((x) => (
              <Link key={x.cle} href={sans(x.cle)} className="puce" aria-label={`${x.libelle} — retirer ce filtre`}>
                {x.libelle}
                <span className="puce-x" aria-hidden="true">
                  ✕
                </span>
              </Link>
            ))}
            {puces.length > 1 && (
              <Link href={`/admin/questions?${new URLSearchParams(vue).toString()}`} className="puces-effacer">
                Tout effacer
              </Link>
            )}
          </p>
        )}
      </form>

      <SectionFiches
        fiches={fiches}
        moduleId={moduleId}
        titreModule={titreModule}
        ouvrable={(id) => moduleOuvrable(modules, id)}
        session={session}
        // Un geste sur une fiche garde la vue : l'arborescence ne renvoie pas à la liste.
        retour={retourVue}
      />

      {/* Deux présentations de la même banque (question 64, choix b), puis la sélection et les gestes en lot
          (questions 88 et 89) ; une nouvelle page repart d'une sélection vide. */}
      <div className="selection-ligne">
        <nav className="bascule-vue" aria-label="Présentation de la banque">
          <Link href={lienVue(false)} aria-current={vueArbre ? undefined : "true"}>
            Liste
          </Link>
          <Link href={lienVue(true)} aria-current={vueArbre ? "true" : undefined}>
            Arborescence
          </Link>
        </nav>
        <SelectionBanque
          key={cleSelection}
          modules={ciblesLot}
          blocs={blocsServis.map((b) => ({ numero: b.numero, titre: b.titre }))}
          niveaux={niveauxLot}
          role={session.role}
          retour={retourVue}
          affichees={questions.length}
        />
      </div>

      {vueArbre ? (
        <>
          <ArborescenceBanque
            arbre={arbre}
            parModule={parModuleArbre}
            comptes={comptes}
            cumul={cumul}
            lectures={lectures}
            stats={stats}
            signales={signales}
            session={session}
            etat={{ plis, ouvrir, filtre: filtreQuestions || Boolean(moduleId) }}
            parametres={parametresArbre}
            libellesNiveaux={libellesNiveaux}
          />
          {/* La redirection d'une action perd l'ancre : on ramène à la branche du geste. */}
          {ouvrir && <RetourBranche ancre={ancreDe(ouvrir)} />}
        </>
      ) : (
        <>
          {questions.length === 0 && (
            <p className="encart">Aucune question en base pour ce filtre. La banque versionnée avec le site n&apos;apparaît pas ici : elle se modifie dans <code>content/modules/</code>.</p>
          )}

          {[...parModule.entries()].map(([mid, liste]) => (
            <section key={mid} id={`liste-${mid}`} className="section">
              <div className="section-titre">
                <CaseModule branche={`liste-${mid}`} titre={titreModule(mid)} nombre={liste.length} />
                <h2 style={{ fontSize: "1.15rem" }}>{titreModule(mid)}</h2>
                <span className="compte">
                  <Link href={`/module/${mid}`}>voir le module</Link>
                </span>
              </div>
              <ul className="liste-nue">
                {liste.map((q) => (
                  <li key={q.id} className="carte question-ligne">
                    <div className="etape-tete">
                      <CaseQuestion q={q} session={session} />
                      <EtiquettesQuestion q={q} signalements={signales[q.id] ?? 0} ici={mid} stat={stats.get(q.id)} libellesNiveaux={libellesNiveaux} />
                      <TraceQuestion q={q} />
                    </div>
                    <p className="question-enonce" style={{ fontSize: "1rem" }}>{q.enonce}</p>
                    <RattachementQuestion q={q} lectures={lectures} ici={mid} />
                    <StatistiqueQuestion q={q} stat={stats.get(q.id)} ici={mid} />
                    <ContenuQuestion q={q} />
                    {/* Modifier ou supprimer depuis la liste y ramène : l'arborescence est la vue par défaut. */}
                    <ActionsQuestion
                      q={q}
                      session={session}
                      retour={retour}
                      modifier={`/admin/questions/${q.id}?retour=${encodeURIComponent(retour)}`}
                      retourSuppression={retour}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </>
      )}
    </>
  );
}
