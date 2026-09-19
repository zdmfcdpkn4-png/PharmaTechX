import type { Metadata } from "next";
import Link from "next/link";
import { modeConservation } from "@/lib/config";
import { lireBareme } from "@/lib/bareme-db";
import { libelleQim, libelleSchema, resumeBareme, type Bareme } from "@/content/bareme";
import {
  arbitrageEnAttente,
  blocsCompetence,
  criteres,
  etapes,
  maintien,
  niveaux,
} from "@/content/habilitation";

// Le barème et le mode de conservation sont lus à chaque requête : la page
// annonce les règles en vigueur, jamais celles figées à la construction.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Repères — Formation et habilitation",
};

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

export default async function Reperes() {
  const conservation = modeConservation();
  const bareme = await lireBareme();
  const obligatoires = criteres.filter((x) => x.obligatoire).length;

  return (
    <>
      <section className="panneau-titre">
        <p className="sur-titre">Repères</p>
        <h1>Comment l&apos;habilitation se conduit, et comment elle s&apos;évalue</h1>
        <p style={{ fontSize: "1.0625rem", maxWidth: "58ch" }}>
          Le dispositif en six étapes, les formats d&apos;évaluation et leur barème, le
          programme complet des critères, les conditions des niveaux et les questions les
          plus fréquentes. <strong>Un module validé à l&apos;écran ne vaut pas
          habilitation</strong> : les quatre dernières étapes se déroulent au poste de
          travail et devant le pharmacien responsable.
        </p>
        <div className="actions" style={{ marginTop: 0 }}>
          <Link href="/#modules" className="bouton">
            Revenir à mes modules
          </Link>
        </div>
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
      <section id="programme" className="section">
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
      <section id="niveaux" className="section">
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
