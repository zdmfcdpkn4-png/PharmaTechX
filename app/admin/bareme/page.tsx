import Link from "next/link";
import { sessionRequise } from "@/lib/auth";
import { infoBareme, lireBareme } from "@/lib/bareme-db";
import {
  BAREME_DEFAUT,
  LIBELLES_FORMAT,
  type CleFormat,
  LIMITES_BAREME,
  estBaremeDefaut,
  resumeBareme,
  type BaremeFormat,
} from "@/content/bareme";
import { lireNomsNiveaux } from "@/lib/niveaux-questions-db";
import { libellesDe } from "@/content/niveaux-questions";
import { actionEnregistrerBareme, actionRetablirBareme } from "./actions";

export const dynamic = "force-dynamic";

const MESSAGES: Record<string, string> = {
  enregistre: "Barème enregistré : il s'applique aux évaluations à venir.",
  defaut: "Valeurs par défaut rétablies. Le tirage selon le niveau cible garde son réglage (Niveaux des questions).",
};

const FORMATS = [
  { cle: "qcm" as const, element: "proposition", sansReponse: "proposition non tranchée" },
  { cle: "qim" as const, element: "proposition", sansReponse: "« je ne sais pas »" },
  { cle: "schema" as const, element: "légende", sansReponse: "légende vide" },
  { cle: "ordre" as const, element: "étape à sa place", sansReponse: "étape sans rang" },
  { cle: "trous" as const, element: "trou bien rempli", sansReponse: "trou laissé vide" },
];

/** Les six mêmes réglages pour chaque format : c'est tout l'objet de l'harmonisation. */
function ReglagesFormat({
  cle,
  element,
  sansReponse,
  valeur,
  defaut,
}: {
  cle: CleFormat;
  element: string;
  sansReponse: string;
  valeur: BaremeFormat;
  defaut: BaremeFormat;
}) {
  const part = (nom: string, libelle: string, v: number, parDefaut: number) => (
    <label className="champ">
      <span>
        {libelle} (défaut {parDefaut})
      </span>
      <input
        type="number"
        name={`${cle}-${nom}`}
        min={LIMITES_BAREME.part.min}
        max={LIMITES_BAREME.part.max}
        step={0.05}
        defaultValue={v}
      />
    </label>
  );
  return (
    <>
      <h3 style={{ fontSize: "1rem", marginBottom: ".25rem" }}>{LIBELLES_FORMAT[cle]}</h3>
      {cle === "schema" && (
        <p className="legende" style={{ margin: "0 0 .5rem" }}>
          S&apos;applique aussi aux schémas à découvrir (question 52), cache par cache : un cache jugé juste
          compte comme une légende juste, jugé faux comme une légende fausse, non jugé comme une légende vide.
        </p>
      )}
      <div className="rangee">
        <label className="champ">
          <span>Mode (défaut : {defaut.mode === "tout_ou_rien" ? "tout ou rien" : "partiel"})</span>
          <select name={`${cle}-mode`} defaultValue={valeur.mode}>
            <option value="partiel">Partiel — chaque {element} compte pour sa part</option>
            <option value="tout_ou_rien">Tout ou rien — le plafond si tout est juste, le plancher sinon</option>
          </select>
        </label>
        {part("juste", `${element[0].toUpperCase()}${element.slice(1)} juste`, valeur.juste, defaut.juste)}
        {part("faux", `${element[0].toUpperCase()}${element.slice(1)} fausse`, valeur.faux, defaut.faux)}
      </div>
      <div className="rangee">
        {part("sans", `Sans réponse — ${sansReponse}`, valeur.sansReponse, defaut.sansReponse)}
        <label className="champ">
          <span>Plancher de la question (défaut {defaut.min})</span>
          <input
            type="number"
            name={`${cle}-min`}
            min={LIMITES_BAREME.plancher.min}
            max={LIMITES_BAREME.plancher.max}
            step={0.05}
            defaultValue={valeur.min}
          />
        </label>
        <label className="champ">
          <span>Plafond, poids de la question (défaut {defaut.max})</span>
          <input
            type="number"
            name={`${cle}-max`}
            min={LIMITES_BAREME.plafond.min}
            max={LIMITES_BAREME.plafond.max}
            step={0.05}
            defaultValue={valeur.max}
          />
        </label>
      </div>
    </>
  );
}

export default async function Bareme({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  await sessionRequise("admin");
  const p = await searchParams;
  const [bareme, info, noms] = await Promise.all([lireBareme(), infoBareme(), lireNomsNiveaux()]);
  const d = BAREME_DEFAUT;

  return (
    <>
      <section className="panneau-titre">
        <h1>Barème</h1>
        <p>
          Règles de notation et de décision (décision du 18/09/2026, question 10). Elles sont
          annoncées sur l&apos;accueil et sous chaque question, copiées dans chaque résultat scellé
          et portées sur chaque rapport : une évaluation déjà passée garde le barème de son époque.
          Le seuil d&apos;un module de la fiche se règle dans{" "}
          <Link href="/admin/rattachement">Rattachement des modules</Link>, celui d&apos;un module déposé dans son
          formulaire (<Link href="/admin/modules">Modules</Link>).
        </p>
      </section>

      {p.ok && MESSAGES[p.ok] && <p className="encart encart--ok">{MESSAGES[p.ok]}</p>}

      <section className="carte">
        <h2 style={{ fontSize: "1.1rem" }}>Barème en vigueur</h2>
        <ul>
          {resumeBareme(bareme, libellesDe(noms)).map((l) => (
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
          <h2 style={{ fontSize: "1.1rem" }}>Notation des trois formats</h2>
          <p className="legende">
            La même règle partout : les éléments d&apos;une question — propositions d&apos;un QCM ou
            d&apos;une QIM, légendes d&apos;un schéma — valent chacun une part, et la note se range
            entre un plancher et un plafond. Le plafond est aussi le poids de la question dans le
            total. Un élément « sans réponse » est un « je ne sais pas » de QIM, une légende vide,
            une proposition non tranchée.
          </p>
          {FORMATS.map(({ cle, element, sansReponse }) => (
            <ReglagesFormat
              key={cle}
              cle={cle}
              element={element}
              sansReponse={sansReponse}
              valeur={bareme[cle]}
              defaut={d[cle]}
            />
          ))}

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

          <p className="legende">
            Le tirage selon le niveau cible — plafond et répartition par niveau de question — se règle dans{" "}
            <Link href="/admin/niveaux-questions#tirage">Niveaux des questions</Link> ; il reste rangé dans le barème,
            copié dans chaque résultat scellé.
          </p>
          <div className="actions">
            <button type="submit" className="bouton">Enregistrer le barème</button>
          </div>
        </form>
        <form action={actionRetablirBareme} style={{ marginTop: ".5rem" }}>
          <button type="submit" className="bouton bouton--compact bouton--secondaire" disabled={!info || estBaremeDefaut({ ...bareme, plafonds: d.plafonds, repartitions: d.repartitions })}>
            Rétablir les valeurs par défaut
          </button>
        </form>
      </section>
    </>
  );
}
