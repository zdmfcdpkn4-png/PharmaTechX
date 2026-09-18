import Link from "next/link";
import { sessionRequise } from "@/lib/auth";
import { infoBareme, lireBareme } from "@/lib/bareme-db";
import { BAREME_DEFAUT, LIMITES_BAREME, estBaremeDefaut, resumeBareme } from "@/content/bareme";
import { actionEnregistrerBareme, actionRetablirBareme } from "./actions";

export const dynamic = "force-dynamic";

const MESSAGES: Record<string, string> = {
  enregistre: "Barème enregistré : il s'applique aux évaluations à venir.",
  defaut: "Valeurs par défaut rétablies.",
};

export default async function Bareme({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  await sessionRequise("admin");
  const p = await searchParams;
  const [bareme, info] = await Promise.all([lireBareme(), infoBareme()]);
  const d = BAREME_DEFAUT;

  return (
    <>
      <section className="panneau-titre">
        <h1>Barème</h1>
        <p>
          Règles de notation et de décision (décision du 18/09/2026, question 10). Elles sont
          annoncées sur l&apos;accueil et sous chaque question, copiées dans chaque résultat scellé
          et portées sur chaque rapport : une évaluation déjà passée garde le barème de son époque.
          Le seuil d&apos;un module se règle dans <Link href="/admin/modules">Modules</Link>.
        </p>
      </section>

      {p.ok && MESSAGES[p.ok] && <p className="encart encart--ok">{MESSAGES[p.ok]}</p>}

      <section className="carte">
        <h2 style={{ fontSize: "1.1rem" }}>Barème en vigueur</h2>
        <ul>
          {resumeBareme(bareme).map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
        <p className="legende" style={{ margin: 0 }}>
          {info
            ? `Réglé par ${info.modifie_par} le ${new Date(info.modifie_le).toLocaleString("fr-FR", { timeZone: "Europe/Paris" })}.`
            : "Valeurs par défaut (aucun réglage enregistré)."}
          {info && estBaremeDefaut(bareme) ? " Identique aux valeurs par défaut." : ""}
        </p>
      </section>

      <section className="carte">
        <form action={actionEnregistrerBareme}>
          <h2 style={{ fontSize: "1.1rem" }}>QIM — points sur 1 selon le nombre de discordances</h2>
          <div className="rangee">
            <label className="champ">
              <span>1 discordance (défaut {d.qim.unDiscordance})</span>
              <input type="number" name="qim1" min={0} max={1} step={0.05} defaultValue={bareme.qim.unDiscordance} />
            </label>
            <label className="champ">
              <span>2 discordances (défaut {d.qim.deuxDiscordances})</span>
              <input type="number" name="qim2" min={0} max={1} step={0.05} defaultValue={bareme.qim.deuxDiscordances} />
            </label>
            <label className="champ">
              <span>Au-delà (défaut {d.qim.auDela})</span>
              <input type="number" name="qim3" min={0} max={1} step={0.05} defaultValue={bareme.qim.auDela} />
            </label>
          </div>
          <p className="legende">0 discordance vaut toujours 1 point ; une proposition non jugée compte comme une discordance ; le QCM reste tout ou rien.</p>

          <h2 style={{ fontSize: "1.1rem" }}>Schéma à compléter</h2>
          <div className="rangee">
            <label className="champ">
              <span>Mode (défaut : partiel)</span>
              <select name="schemaMode" defaultValue={bareme.schema.mode}>
                <option value="partiel">Partiel — chaque légende vaut 1/n, une fausse la retire</option>
                <option value="tout_ou_rien">Tout ou rien — 1 point si toutes les légendes sont justes</option>
              </select>
            </label>
            <label className="champ" style={{ justifyContent: "end" }}>
              <span>Légende vide</span>
              <span className="cases">
                <label>
                  <input type="checkbox" name="schemaVide" defaultChecked={bareme.schema.videRetire} />
                  retire sa part comme une légende fausse (défaut : ne compte pas)
                </label>
              </span>
            </label>
          </div>

          <h2 style={{ fontSize: "1.1rem" }}>Décision</h2>
          <div className="rangee">
            <label className="champ">
              <span>Seuil de réussite par défaut, % (défaut {d.seuilDefaut})</span>
              <input type="number" name="seuilDefaut" min={LIMITES_BAREME.seuil.min} max={LIMITES_BAREME.seuil.max} step={1} defaultValue={bareme.seuilDefaut} />
            </label>
            <label className="champ">
              <span>Questions au moins pour conclure (défaut {d.minQuestions})</span>
              <input type="number" name="minQuestions" min={LIMITES_BAREME.minQuestions.min} max={LIMITES_BAREME.minQuestions.max} step={1} defaultValue={bareme.minQuestions} />
            </label>
          </div>
          <div className="rangee">
            <label className="champ">
              <span>Bande de garde (défaut : le poids d&apos;une question)</span>
              <select name="bandeMode" defaultValue={bareme.bande.mode}>
                <option value="question">Le poids d&apos;une question du tirage (100 / n)</option>
                <option value="demi_question">Le poids d&apos;une demi-question (50 / n)</option>
                <option value="fixe">Largeur fixe, en points de pourcentage</option>
              </select>
            </label>
            <label className="champ">
              <span>Largeur fixe, points (mode « fixe » seulement)</span>
              <input type="number" name="bandePoints" min={LIMITES_BAREME.bandePoints.min} max={LIMITES_BAREME.bandePoints.max} step={0.5} defaultValue={bareme.bande.points} />
            </label>
          </div>

          <h2 style={{ fontSize: "1.1rem" }}>Tirages</h2>
          <div className="rangee">
            <label className="champ">
              <span>Découverte, questions (défaut {d.tirages.decouverte})</span>
              <input type="number" name="tirageDecouverte" min={LIMITES_BAREME.tirage.min} max={LIMITES_BAREME.tirage.max} step={1} defaultValue={bareme.tirages.decouverte} />
            </label>
            <label className="champ">
              <span>Habilitation, questions (défaut {d.tirages.habilitation} ; jamais sous le minimum pour conclure)</span>
              <input type="number" name="tirageHabilitation" min={LIMITES_BAREME.tirage.min} max={LIMITES_BAREME.tirage.max} step={1} defaultValue={bareme.tirages.habilitation} />
            </label>
          </div>
          <div className="actions">
            <button type="submit" className="bouton">Enregistrer le barème</button>
          </div>
        </form>
        <form action={actionRetablirBareme} style={{ marginTop: ".5rem" }}>
          <button type="submit" className="bouton bouton--compact bouton--secondaire" disabled={!info}>
            Rétablir les valeurs par défaut
          </button>
        </form>
      </section>
    </>
  );
}
