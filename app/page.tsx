import Link from "next/link";
import { composerProgramme, comptesQuestionsBase, getParcours } from "@/content/store";
import { miseEnService, modeConservation, procedureReference } from "@/lib/config";
import { lireBareme } from "@/lib/bareme-db";
import { baseConfiguree, depotsGeneraux } from "@/lib/db";
import { libelleQim, libelleSchema, resumeBareme, type Bareme } from "@/content/bareme";
import {
  arbitrageEnAttente,
  blocsCompetence,
  criteres,
  etapes,
  filieres,
  maintien,
  niveaux,
} from "@/content/habilitation";
import type { Module, TypeParcours } from "@/content/types";
import { TableauDeBord, type DocumentResume, type ModuleResume } from "@/components/TableauDeBord";

function resumer(m: Module, enBase: Record<string, number>): ModuleResume {
  return {
    id: m.id,
    titre: m.titre,
    objectif: m.objectif,
    bloc: typeof m.bloc === "number" ? String(m.bloc) : m.bloc,
    critereId: m.critereId,
    affectation: m.affectation,
    postes: m.postes,
    niveaux: m.niveaux,
    dureeMinutes:
      typeof m.dureeMinutes === "number" ? `${m.dureeMinutes}` : m.dureeMinutes,
    redige: m.redige,
    nbQuestions:
      m.questions.length +
      m.misesEnSituation.reduce((s, x) => s + x.questions.length, 0) +
      (enBase[m.id] ?? 0),
    nbSituations: m.misesEnSituation.length,
    periodiciteMois:
      typeof m.periodiciteMois === "number"
        ? `${m.periodiciteMois}`
        : m.periodiciteMois,
    origine: m.origine ?? "code",
  };
}

const LIEUX: Record<string, { texte: string; classe: string }> = {
  site: { texte: "Dans ce site", classe: "etiquette etiquette--site" },
  terrain: { texte: "Au poste", classe: "etiquette etiquette--poste" },
  pharmacien: {
    texte: "Pharmacien",
    classe: "etiquette etiquette--pharmacien",
  },
};

/** Les formats d'évaluation et leur barème en vigueur, annoncés avant toute question. */
const formats = (b: Bareme) => [
  {
    titre: "QCM — une seule réponse",
    regle: "1 point si la réponse est exacte, 0 sinon.",
  },
  {
    titre: "QCM — plusieurs réponses",
    regle:
      "Tout ou rien : l'ensemble coché doit être exactement l'ensemble attendu.",
  },
  {
    titre: "QIM — barème à la discordance",
    regle: libelleQim(b),
  },
  {
    titre: "Schéma à compléter",
    regle: libelleSchema(b),
  },
  {
    titre: "Mise en situation",
    regle:
      "Une vignette décrit un cas réel de l'unité ; plusieurs questions s'y rapportent et sont tirées ensemble.",
  },
  {
    titre: "Question éliminatoire",
    regle:
      "Une erreur ou une absence de réponse rend le critère non acquis, quel que soit le score global. Toujours incluse dans le tirage.",
  },
  {
    titre: "Correction sourcée",
    regle:
      "Chaque question corrigée affiche sa justification et la source réglementaire sur laquelle elle s'appuie.",
  },
];

const questionsFrequentes = (conservation: "aucune" | "pseudonyme") => [
  {
    q: "Si je valide le module, suis-je habilité ?",
    r: "Non. Ce site couvre les étapes 1 et 2 sur 6. L'habilitation est prononcée par le pharmacien responsable après le compagnonnage et l'évaluation pratique au poste, au vu des preuves réunies.",
  },
  {
    q: "Mes résultats sont-ils enregistrés quelque part ?",
    r:
      conservation === "pseudonyme"
        ? "Pas tant que vous ne l'avez pas décidé. Ils vivent en mémoire de l'onglet le temps de la session. Si vous émettez un rapport, il est enregistré sous votre identifiant d'agent, sans votre nom, numéroté et scellé, pour être visé par le tuteur puis le pharmacien responsable. Les entraînements ne sont jamais enregistrés."
        : "Non. Ils vivent en mémoire de l'onglet le temps de la session et disparaissent à sa fermeture. La seule trace durable est le rapport que vous téléchargez sur votre poste et remettez pour votre dossier.",
  },
  {
    q: "Quelle différence entre évaluation et entraînement ?",
    r: "L'entraînement corrige chaque question dès la réponse, avec sa justification et sa source, et n'est ni enregistré ni comptabilisé. L'évaluation corrige à la fin et produit le résultat porté au rapport.",
  },
  {
    q: "Le site sait-il qui je suis ?",
    r:
      conservation === "pseudonyme"
        ? "Non. Un code d'accès ouvre un profil — poste, tutorat, administration — jamais un compte nominatif. Un rapport émis est rattaché à votre identifiant d'agent (AG-001…) ; la correspondance avec votre nom est tenue par le pharmacien responsable, hors du site."
        : "Non. Un code d'accès ouvre un profil — poste, tutorat, administration — jamais un compte nominatif. Le serveur ne reçoit que des identifiants de questions et d'options.",
  },
  {
    q: "Que se passe-t-il si je rate une question éliminatoire ?",
    r: "Le critère est non acquis, même si le reste est juste. Ces questions portent sur la sécurité de l'opérateur ou l'intégrité de la préparation : il n'y a pas de compensation possible.",
  },
  {
    q: "Puis-je refaire une évaluation ?",
    r: "Oui, autant de fois que vous le souhaitez, avec un nouveau tirage à chaque fois. Rien n'est comptabilisé : l'outil sert à apprendre, pas à sanctionner.",
  },
  {
    q: "Pourquoi certains critères sont-ils marqués « à rédiger » ?",
    r: "Les 58 critères de la fiche d'habilitation sont tous référencés, mais deux modules seulement sont écrits à ce jour. Les autres apparaissent pour que le programme complet soit visible ; les tuteurs peuvent déjà y déposer des questions.",
  },
];

export default async function Accueil({
  searchParams,
}: {
  searchParams: Promise<{ parcours?: string }>;
}) {
  const params = await searchParams;
  const parcoursId: TypeParcours =
    params.parcours === "maintien" ? "maintien" : "integration";
  const parcours = getParcours(parcoursId)!;
  const [enBase, bareme, programme] = await Promise.all([
    comptesQuestionsBase(),
    lireBareme(),
    composerProgramme(parcoursId),
  ]);
  const conservation = modeConservation();

  const troncCommun = programme.troncCommun.map((m) => resumer(m, enBase));
  const parPoste: Record<string, ModuleResume[]> = {};
  for (const f of filieres) {
    if (f.id === "socle") continue;
    parPoste[f.id] = (programme.parFiliere[f.id] ?? []).map((m) => resumer(m, enBase));
  }
  // Documents généraux, proposés par profil (filières, niveaux) — question 10.
  const documents: DocumentResume[] = baseConfiguree()
    ? (await depotsGeneraux().catch(() => [])).map((d) => ({
        id: d.id,
        titre: d.titre,
        nature: d.nature,
        url: d.url,
        filieres: d.filieres,
        niveaux: d.niveaux,
      }))
    : [];

  const rediges = [...troncCommun, ...Object.values(parPoste).flat()].filter(
    (m) => m.redige || m.nbQuestions > 0,
  );
  const obligatoires = criteres.filter((x) => x.obligatoire).length;

  return (
    <>
      {/* ───────────────────────────────────────────────────────── héros */}
      <section className="panneau-titre">
        <p className="sur-titre">
          Étapes 1 et 2 sur 6 — {parcours.titre.toLowerCase()}
        </p>
        <h1>Se former, puis prouver ce qu&apos;on sait faire</h1>
        <p style={{ fontSize: "1.0625rem", maxWidth: "58ch" }}>
          {parcours.description}
        </p>
        <div className="actions" style={{ marginTop: 0 }}>
          <a href="#modules" className="bouton">
            Voir mes modules
          </a>
          <a href="#dispositif" className="bouton bouton--secondaire">
            Comment fonctionne l&apos;habilitation
          </a>
        </div>
        <p className="mentions-hero">
          Aucun compte nominatif · {conservation === "pseudonyme" ? "rapports enregistrés sur émission, sous identifiant" : "résultats non conservés"} · {rediges.length}{" "}
          critère{rediges.length > 1 ? "s" : ""} évaluable{rediges.length > 1 ? "s" : ""} sur {criteres.length}
        </p>
      </section>

      <nav className="nav-sections" aria-label="Choix du parcours">
        <Link
          href="/?parcours=integration"
          className={`bouton bouton--compact ${parcoursId === "integration" ? "" : "bouton--discret"}`}
        >
          Intégration
        </Link>
        <Link
          href="/?parcours=maintien"
          className={`bouton bouton--compact ${parcoursId === "maintien" ? "" : "bouton--discret"}`}
        >
          Maintien d&apos;habilitation
        </Link>
      </nav>

      {/* ──────────────────────────────────────────────────── mes modules */}
      <section id="modules" className="section">
        <h2>Mes modules</h2>
        <p className="section-intro">{parcours.destinataire}.</p>
        <TableauDeBord
          troncCommun={troncCommun}
          parPoste={parPoste}
          postes={filieres
            .filter((f) => f.id !== "socle")
            .map((f) => ({
              id: f.id,
              libelle: f.libelle,
              niveauxRequis: f.niveaux,
            }))}
          niveaux={niveaux.map((n) => ({
            code: n.code,
            libelle: n.libelle,
            filiere: n.filiere,
          }))}
          parcoursTitre={parcours.titre}
          conservation={conservation}
          procedure={procedureReference()}
          miseEnService={miseEnService()}
          documents={documents}
        />
      </section>

      {/* ───────────────────────────────────────────────── le dispositif */}
      <section id="dispositif" className="section">
        <h2>Le dispositif</h2>
        <p className="section-intro">
          Ce site couvre les deux premières étapes. Les quatre suivantes se
          déroulent au poste de travail et devant le pharmacien responsable :{" "}
          <strong>un module validé à l&apos;écran ne vaut pas habilitation</strong>.
        </p>
        <ol className="etapes">
          {etapes.map((e) => (
            <li key={e.numero} className="carte">
              <div className="etape-tete">
                <span className="etape-num">{e.numero}</span>
                <h3>{e.titre}</h3>
                <span className={LIEUX[e.lieu].classe}>
                  {LIEUX[e.lieu].texte}
                </span>
              </div>
              <p style={{ marginBottom: ".375rem" }}>{e.description}</p>
              <p className="etape-preuve">Preuve attendue : {e.preuve}</p>
            </li>
          ))}
        </ol>
        <p className="encart">
          <strong>Maintien de l&apos;habilitation.</strong>{" "}
          {maintien.activiteMinimale} Réévaluation tous les{" "}
          {maintien.periodiciteMois / 12} ans. {maintien.reserve}
        </p>
      </section>

      {/* ────────────────────────────────────────────────── l'évaluation */}
      <section id="evaluation" className="section">
        <h2>L&apos;évaluation</h2>
        <p className="section-intro">
          Chaque format a son barème, réglé par l&apos;administrateur. Ils sont
          annoncés ici pour qu&apos;aucune règle de notation ne soit découverte
          en cours d&apos;épreuve.
        </p>
        <div className="grille">
          {formats(bareme).map((f) => (
            <article key={f.titre} className="carte">
              <h3 style={{ fontSize: "1rem" }}>{f.titre}</h3>
              <p className="legende" style={{ marginBottom: 0 }}>
                {f.regle}
              </p>
            </article>
          ))}
        </div>
        <p className="legende" style={{ marginTop: ".75rem" }}>
          {resumeBareme(bareme).slice(3).join(" ")}
        </p>
      </section>

      {/* ──────────────────────────────── programme complet, par bloc */}
      <section className="section">
        <h2>Programme complet</h2>
        <p className="section-intro">
          {criteres.length} critères, dont {obligatoires} obligatoires, repris
          sans réécriture de la fiche d&apos;habilitation préparateur de
          l&apos;unité. Deux points y restent en attente d&apos;arbitrage
          pharmacien : {arbitrageEnAttente.marquageObligatoire}{" "}
          {arbitrageEnAttente.correspondanceBlocsNiveaux}
        </p>
        {blocsCompetence.map((b) => {
          const items = criteres.filter((x) => x.bloc === b.numero);
          return (
            <details key={b.numero} className="bloc">
              <summary>
                Bloc {b.numero} — {b.titre}
                <span
                  className="etiquette etiquette--neutre"
                  style={{ marginLeft: ".5rem" }}
                >
                  {items.length} critères
                </span>
              </summary>
              <div className="contenu-bloc">
                <p className="legende" style={{ margin: "0 0 .5rem" }}>
                  Réf. : {b.reference}
                </p>
                {items.map((x) => (
                  <div key={x.id} className="ligne-critere">
                    <span className="code">{x.id}</span>
                    <span className="libelle">
                      {x.libelle}
                      {x.sousSection ? ` — ${x.sousSection}` : ""}
                    </span>
                    <span className="etiquette etiquette--neutre">
                      {x.niveau}
                    </span>
                    {x.obligatoire && (
                      <span className="obligatoire">Obligatoire</span>
                    )}
                    {!x.moduleId && (
                      <span className="etiquette etiquette--attention">
                        À rédiger
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </details>
          );
        })}
      </section>

      {/* ───────────────────────────────────── conditions des niveaux */}
      <section className="section">
        <h2>Conditions d&apos;obtention des niveaux</h2>
        <p className="section-intro">Chapitre III de la fiche d&apos;habilitation.</p>
        <ul className="liste-nue">
          {niveaux.map((n) => (
            <li key={n.code} className="carte">
              <span className="etiquette etiquette--code">{n.code}</span>{" "}
              <strong>{n.libelle}</strong>
              <p className="legende" style={{ margin: ".375rem 0 0" }}>
                {n.condition}
              </p>
            </li>
          ))}
        </ul>
      </section>

      {/* ────────────────────────────────────────────────────── questions */}
      <section id="questions" className="section">
        <h2>Questions</h2>
        <div style={{ display: "grid", gap: ".5rem" }}>
          {questionsFrequentes(conservation).map((x) => (
            <details key={x.q} className="bloc">
              <summary>{x.q}</summary>
              <div className="contenu-bloc">
                <p style={{ marginBottom: 0 }}>{x.r}</p>
              </div>
            </details>
          ))}
        </div>
      </section>
    </>
  );
}
