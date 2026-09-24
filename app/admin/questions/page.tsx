import Link from "next/link";
import { getSession } from "@/lib/auth";
import { comptesParModule, listerQuestions, signalementsOuvertsParQuestion, type StatutQuestion } from "@/content/banque-db";
import { getTousModulesAvecDeposes } from "@/content/store";
import { etiquetteModule, moduleOuvrable, titreModule as titreDe } from "./commun";
import { getReferentiel } from "@/content/referentiel-db";
import { ArbreBanque } from "@/components/ArbreBanque";
import { LIBELLES_NIVEAU_QUESTION, NIVEAUX_QUESTION, type NiveauQuestion } from "@/content/types";
import { compterFichesAVerifier, listerFiches } from "@/lib/fiches-db";
import { ancreDe, construireArbre, elaguer, lireChemin, lirePlis } from "@/content/arbre-banque";
import { RetourBranche } from "@/components/RetourBranche";
import { SectionFiches } from "./fiches";
import { ArborescenceBanque } from "./arborescence";
import { ActionsQuestion, ContenuQuestion, EtiquettesQuestion, TraceQuestion } from "./question-banque";

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

export default async function Questions({
  searchParams,
}: {
  searchParams: Promise<{
    module?: string;
    statut?: string;
    niveau?: string;
    obligatoires?: string;
    vue?: string;
    plis?: string;
    ouvrir?: string;
    ok?: string;
    erreur?: string;
  }>;
}) {
  const p = await searchParams;
  // Vue « Arborescence » (question 64, choix b), par défaut depuis le 24/09/2026 ;
  // la liste se demande (`vue=liste`) : les entrées de validation l'ouvrent.
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
  const [toutes, comptes, referentiel, signales, fiches, fichesAVerifier] = await Promise.all([
    listerQuestions({ moduleId, statut }),
    comptesParModule(),
    getReferentiel(),
    signalementsOuvertsParQuestion(),
    // Fiches de synthèse (question 59) : celles du module choisi, ou, sous le
    // filtre « à vérifier », celles qui attendent une validation.
    moduleId ? listerFiches({ moduleId }) : statut === "a_verifier" ? listerFiches({ statut: "a_verifier" }) : Promise.resolve([]),
    compterFichesAVerifier(),
  ]);
  // Filtre des obligatoires (question 63) : le socle posé à chaque évaluation, module par module.
  const seulesObligatoires = p.obligatoires === "1";
  const questions = toutes.filter(
    (q) =>
      (!filtreNiveau || (filtreNiveau === "a_preciser" ? !q.niveau_question : q.niveau_question === filtreNiveau)) &&
      (!seulesObligatoires || q.obligatoire),
  );
  const parModule = new Map<string, typeof questions>();
  for (const q of questions) {
    const liste = parModule.get(q.module_id) ?? [];
    liste.push(q);
    parModule.set(q.module_id, liste);
  }
  // Filtres gardés après chaque geste, dans les deux vues. Le niveau et les
  // obligatoires, venus après l'adresse de retour, s'y perdaient.
  const filtres: [string, string][] = [
    ...(moduleId ? [["module", moduleId] as [string, string]] : []),
    ...(statut ? [["statut", statut] as [string, string]] : []),
    ...(filtreNiveau ? [["niveau", filtreNiveau] as [string, string]] : []),
    ...(seulesObligatoires ? [["obligatoires", "1"] as [string, string]] : []),
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
  const filtreQuestions = Boolean(statut || filtreNiveau || seulesObligatoires);
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
      ? elaguer(complet, (id) => (!moduleId || id === moduleId) && (!filtreQuestions || (parModule.get(id)?.length ?? 0) > 0))
      : complet;

  return (
    <>
      <section className="panneau-titre">
        <h1>Banque de questions</h1>
        <p>
          Questions déposées par les tuteurs et administrateurs, en complément de la banque
          versionnée avec le site. Seules les questions <strong>validées</strong> entrent dans les
          tirages ; une question importée ou créée reste « à vérifier » jusqu&apos;à relecture.
        </p>
        <div className="actions" style={{ marginTop: 0 }}>
          <Link
            href={`/admin/questions/nouvelle?${new URLSearchParams([...(moduleId ? [["module", moduleId] as [string, string]] : []), ["retour", retourVue]]).toString()}`}
            className="bouton"
          >
            Nouvelle question
          </Link>
          <Link href="/admin/questions/import" className="bouton bouton--secondaire">
            Déposer un texte ou un fichier
          </Link>
          <Link href="/admin/questions/situations" className="bouton bouton--secondaire">
            Mises en situation
          </Link>
        </div>
      </section>

      {p.ok && MESSAGES[p.ok] && <p className="encart encart--ok">{MESSAGES[p.ok]}</p>}
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

      {/* Deux présentations de la même banque (question 64, choix b) ; les filtres suivent. */}
      <nav className="bascule-vue" aria-label="Présentation de la banque">
        <Link href={lienVue(false)} aria-current={vueArbre ? undefined : "true"}>
          Liste
        </Link>
        <Link href={lienVue(true)} aria-current={vueArbre ? "true" : undefined}>
          Arborescence
        </Link>
      </nav>

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
          moduleActif={moduleId}
        />
      )}

      <form method="get" className="carte filtres">
        <input type="hidden" name="vue" value={vueArbre ? "arbre" : "liste"} />
        <div className="rangee">
          <label className="champ">
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
          <label className="champ">
            <span>Statut</span>
            <select name="statut" defaultValue={statut ?? ""}>
              <option value="">Tous</option>
              <option value="a_verifier">À vérifier</option>
              <option value="valide">Validées</option>
              <option value="retire">Retirées</option>
            </select>
          </label>
          <label className="champ">
            <span>Niveau</span>
            <select name="niveau" defaultValue={filtreNiveau ?? ""}>
              <option value="">Tous</option>
              {NIVEAUX_QUESTION.map((n) => (
                <option key={n} value={n}>{LIBELLES_NIVEAU_QUESTION[n]}</option>
              ))}
              <option value="a_preciser">À préciser</option>
            </select>
          </label>
          <label className="champ">
            <span>Obligatoires</span>
            <select name="obligatoires" defaultValue={seulesObligatoires ? "1" : ""}>
              <option value="">Toutes les questions</option>
              <option value="1">Obligatoires seulement</option>
            </select>
          </label>
        </div>
        <div className="actions">
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

      {vueArbre ? (
        <>
          <ArborescenceBanque
            arbre={arbre}
            parModule={parModule}
            comptes={comptes}
            signales={signales}
            session={session}
            etat={{ plis, ouvrir, filtre: filtreQuestions || Boolean(moduleId) }}
            parametres={parametresArbre}
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
            <section key={mid} className="section">
              <div className="section-titre">
                <h2 style={{ fontSize: "1.15rem" }}>{titreModule(mid)}</h2>
                <span className="compte">
                  <Link href={`/module/${mid}`}>voir le module</Link>
                </span>
              </div>
              <ul className="liste-nue">
                {liste.map((q) => (
                  <li key={q.id} className="carte question-ligne">
                    <div className="etape-tete">
                      <EtiquettesQuestion q={q} signalements={signales[q.id] ?? 0} />
                      <TraceQuestion q={q} />
                    </div>
                    <p className="question-enonce" style={{ fontSize: "1rem" }}>{q.enonce}</p>
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
