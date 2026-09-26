import Link from "next/link";
import { sessionRequise } from "@/lib/auth";
import { lireBareme } from "@/lib/bareme-db";
import { infoNomsNiveaux, lireNomsNiveaux } from "@/lib/niveaux-questions-db";
import { BAREME_DEFAUT, LIMITES_BAREME, plafondDuNiveau } from "@/content/bareme";
import { ORDRE_NIVEAUX, repartir } from "@/content/tirage";
import { listeNiveaux } from "@/content/referentiel-db";
import {
  LIMITES_NOMS_NIVEAUX,
  NOMS_NIVEAUX_DEFAUT,
  libellesDe,
  nomDansPhrase,
  plafondCourt,
  plafondEnPhrase,
} from "@/content/niveaux-questions";
import {
  actionEnregistrerNomsNiveaux,
  actionEnregistrerTirageNiveaux,
  actionRetablirNomsNiveaux,
  actionRetablirTirageNiveaux,
} from "./actions";

export const dynamic = "force-dynamic";

const MESSAGES: Record<string, string> = {
  noms: "Noms enregistrés : ils s'affichent dès maintenant, et les rapports déjà émis gardent ceux de leur époque.",
  "noms-defaut": "Noms d'origine rétablis.",
  tirage: "Tirage enregistré : il s'applique aux évaluations à venir.",
  "tirage-defaut": "Tirage d'origine rétabli ; le reste du barème garde son réglage.",
};

const ERREURS: Record<string, string> = {
  doublon: "Deux niveaux porteraient le même nom (casse et accents mis à part) : choisissez-en un autre.",
};

/**
 * Niveaux des questions (question 81, choix a, 26/09/2026) : leurs noms, et
 * le tirage selon le niveau cible (questions 62 et 63), venu de l'écran du
 * barème. Administration seule.
 */
export default async function NiveauxQuestions({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; erreur?: string }>;
}) {
  await sessionRequise("admin");
  const p = await searchParams;
  const [noms, info, bareme, niveaux] = await Promise.all([
    lireNomsNiveaux(),
    infoNomsNiveaux().catch(() => null),
    lireBareme(),
    listeNiveaux(),
  ]);
  const l = libellesDe(noms);
  const d = BAREME_DEFAUT;
  // Minuscule initiale seulement : un nom choisi à l'écran garde sa casse.
  const minuscule = (x: string) => x.charAt(0).toLowerCase() + x.slice(1);
  const tirageDefaut =
    JSON.stringify({ p: bareme.plafonds, r: bareme.repartitions }) === JSON.stringify({ p: d.plafonds, r: d.repartitions });

  return (
    <>
      <section className="panneau-titre">
        <p className="legende" style={{ margin: 0 }}>Squelette de la formation</p>
        <h1>Niveaux des questions</h1>
        <p>
          Chaque question porte un niveau, du plus simple au plus exigeant. Le niveau d&apos;habilitation visé fixe le
          niveau le plus élevé tiré, et chaque tirage suit une répartition entre les niveaux admis. Les noms se
          changent ici ; leur nombre reste trois, le tirage et le barème étant bâtis sur trois.
        </p>
      </section>

      {p.ok && MESSAGES[p.ok] && <p className="encart encart--ok">{MESSAGES[p.ok]}</p>}
      {p.erreur && ERREURS[p.erreur] && (
        <p className="encart encart--attention" role="alert">{ERREURS[p.erreur]}</p>
      )}

      <section id="noms" className="section">
        <div className="section-titre">
          <h2 style={{ fontSize: "1.15rem" }}>Les trois niveaux</h2>
        </div>
        <p className="legende">
          Le nom s&apos;affiche dans la banque, l&apos;éditeur de question, l&apos;aperçu d&apos;un dépôt et
          l&apos;écran d&apos;évaluation ; la définition, sous le choix du niveau dans l&apos;éditeur. Un dépôt de
          questions et le prompt de génération gardent les mots d&apos;origine — initial, intermédiaire, avancé — :
          un fichier préparé avant un renommage s&apos;importe toujours. Un rapport déjà émis garde les noms de son
          époque.
        </p>
        <form action={actionEnregistrerNomsNiveaux} className="carte">
          {ORDRE_NIVEAUX.map((n, i) => (
            <fieldset key={n} className="groupe">
              <legend className="champ-titre">
                Niveau {i + 1} sur 3 · d&apos;origine « {NOMS_NIVEAUX_DEFAUT[n].libelle} »
              </legend>
              <div className="rangee">
                <label className="champ">
                  <span>Nom</span>
                  <input
                    name={`libelle-${n}`}
                    defaultValue={noms[n].libelle}
                    maxLength={LIMITES_NOMS_NIVEAUX.libelle}
                    required
                  />
                </label>
                <label className="champ">
                  <span>Ce qu&apos;il évalue (défaut : {NOMS_NIVEAUX_DEFAUT[n].definition})</span>
                  <input
                    name={`definition-${n}`}
                    defaultValue={noms[n].definition}
                    maxLength={LIMITES_NOMS_NIVEAUX.definition}
                  />
                </label>
              </div>
            </fieldset>
          ))}
          <p className="legende" style={{ margin: 0 }}>
            {info
              ? `Renommés par ${info.modifie_par} le ${new Date(info.modifie_le).toLocaleString("fr-FR", { timeZone: "Europe/Paris" })}.`
              : "Noms d'origine (aucun renommage enregistré)."}{" "}
            Un champ vidé reprend sa valeur d&apos;origine.
          </p>
          <div className="actions">
            <button type="submit" className="bouton">Enregistrer les noms</button>
          </div>
        </form>
        <form action={actionRetablirNomsNiveaux}>
          <button type="submit" className="bouton bouton--compact bouton--secondaire" disabled={!info}>
            Rétablir les noms d&apos;origine
          </button>
        </form>
      </section>

      <section id="tirage" className="section">
        <div className="section-titre">
          <h2 style={{ fontSize: "1.15rem" }}>Tirage selon le niveau cible</h2>
        </div>
        <p className="legende">
          Questions 62 et 63 (23/09/2026). Le niveau d&apos;habilitation visé par le profil fixe le niveau de question
          le plus élevé tiré ; une question sans niveau (« à préciser ») est tirée pour tous. Chaque tirage suit ensuite
          la répartition de son plafond : deux passations au même niveau cible ont la même composition. Éliminatoires
          et obligatoires sont toujours posées et comptent dans leur niveau ; les places qu&apos;un niveau ne peut pas
          remplir vont aux questions sans niveau, puis aux autres niveaux admis. Ce réglage fait partie du{" "}
          <Link href="/admin/bareme">barème</Link> : copié dans chaque résultat scellé, il ne change pas une
          évaluation déjà passée.
        </p>
        <form action={actionEnregistrerTirageNiveaux} className="carte">
          <div className="rangee">
            {niveaux.map((n) => (
              <label key={n.code} className="champ">
                <span>
                  {n.libelle} (défaut : {minuscule(plafondCourt(plafondDuNiveau(d, n.code), l))})
                </span>
                <select name={`plafond-${n.code}`} defaultValue={plafondDuNiveau(bareme, n.code)}>
                  {ORDRE_NIVEAUX.map((x) => (
                    <option key={x} value={x}>
                      {plafondCourt(x, l)}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <p className="legende" style={{ margin: ".25rem 0 .5rem" }}>
            Répartition, en parts relatives (%). Au plafond le plus bas, toutes les questions sont de niveau{" "}
            {nomDansPhrase("initial", l)}.
          </p>
          {(["intermediaire", "avance"] as const).map((x) => {
            const admis = ORDRE_NIVEAUX.slice(0, ORDRE_NIVEAUX.indexOf(x) + 1);
            const nombres = repartir(bareme.tirages.habilitation, bareme.repartitions[x], x);
            const phrase = plafondEnPhrase(x, l);
            return (
              <div key={x}>
                <h3 style={{ fontSize: "1rem", marginBottom: ".25rem" }}>
                  {phrase[0].toUpperCase() + phrase.slice(1)} — Habilitation :{" "}
                  {admis.map((n) => `${nomDansPhrase(n, l)} ${nombres[n]}`).join(", ")}
                </h3>
                <div className="rangee">
                  {admis.map((n) => (
                    <label key={n} className="champ">
                      <span>
                        {l[n]}, % (défaut {d.repartitions[x][n]})
                      </span>
                      <input
                        type="number"
                        name={`part-${x}-${n}`}
                        min={LIMITES_BAREME.partNiveau.min}
                        max={LIMITES_BAREME.partNiveau.max}
                        step={1}
                        defaultValue={bareme.repartitions[x][n]}
                      />
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
          <div className="actions">
            <button type="submit" className="bouton">Enregistrer le tirage</button>
          </div>
        </form>
        <form action={actionRetablirTirageNiveaux}>
          <button type="submit" className="bouton bouton--compact bouton--secondaire" disabled={tirageDefaut}>
            Rétablir le tirage d&apos;origine
          </button>
        </form>
      </section>
    </>
  );
}
