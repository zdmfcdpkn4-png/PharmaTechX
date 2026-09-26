import Link from "next/link";
import { sessionRequise } from "@/lib/auth";
import { lireBareme } from "@/lib/bareme-db";
import { getTousModules } from "@/content/store";
import { lireReglagesModules } from "@/content/modules-db";
import { getReferentiel } from "@/content/referentiel-db";
import { maintien } from "@/content/habilitation";
import { parcoursIntegration, parcoursMaintien } from "@/content/parcours";
import { ecartsDeLaFiche } from "@/content/reglages";
import { LienModule } from "@/components/LienModule";
import { actionReglerSeuil } from "../modules/actions";

export const dynamic = "force-dynamic";

const MESSAGES: Record<string, string> = {
  seuil: "Réglage enregistré.",
};

const ERREURS: Record<string, string> = {
  inconnu: "Module inconnu.",
};

/**
 * Rattachement des modules du code (question 36, choix a) : seuil, filières,
 * niveaux, parcours. Quitte l'écran Modules pour le sous-menu Squelette
 * (question 81, choix a, 26/09/2026), avec les deux parcours en lecture.
 * Administration seule, comme avant.
 */
export default async function Rattachement({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; erreur?: string }>;
}) {
  await sessionRequise("admin");
  const p = await searchParams;
  const [{ filieres, niveaux }, bareme, reglages] = await Promise.all([getReferentiel(), lireBareme(), lireReglagesModules()]);
  const modulesCode = getTousModules();

  return (
    <>
      <section className="panneau-titre">
        <p className="legende" style={{ margin: 0 }}>Squelette de la formation</p>
        <h1>Rattachement des modules</h1>
        <p>
          À quels profils chaque critère de la fiche est proposé : filières, niveaux, parcours, et son seuil.
          Pour composer le programme d&apos;une filière d&apos;un seul écran, voir sa page dans{" "}
          <Link href="/admin/filieres">Filières</Link> : elle enregistre au même endroit. Un module déposé se
          règle dans son propre formulaire (<Link href="/admin/modules">Modules</Link>).
        </p>
      </section>

      {p.ok && MESSAGES[p.ok] && <p className="encart encart--ok">{MESSAGES[p.ok]}</p>}
      {p.erreur && ERREURS[p.erreur] && <p className="encart encart--attention" role="alert">{ERREURS[p.erreur]}</p>}

      <section className="section" aria-labelledby="titre-parcours">
        <div className="section-titre">
          <h2 id="titre-parcours" style={{ fontSize: "1.15rem" }}>Les deux parcours</h2>
          <span className="compte">en lecture</span>
        </div>
        <ul className="liste-nue legende">
          <li>
            <strong>{parcoursIntegration.titre}</strong> — {parcoursIntegration.destinataire}.
          </li>
          <li>
            <strong>{parcoursMaintien.titre}</strong> — {parcoursMaintien.destinataire} ; revalidation tous les{" "}
            {maintien.periodiciteMois} mois.
          </li>
        </ul>
      </section>

      <section className="section" id="seuils">
        <div className="section-titre">
          <h2 style={{ fontSize: "1.15rem" }}>Réglage des modules du code</h2>
          <span className="compte">défaut du barème : {bareme.seuilDefaut} %</span>
        </div>
        <p className="legende">
          Le texte d&apos;un critère reste versionné avec le site, mais son rattachement se règle
          ici (décision du 19/09/2026, question 36) : seuil, <strong>filières</strong>,{" "}
          <strong>niveaux</strong> et présence en <strong>intégration</strong> ou en{" "}
          <strong>maintien</strong>. La fiche d&apos;habilitation reste la source : un réglage est
          un écart assumé, signalé ici, et « Rétablir la fiche » le retire. Le seuil par défaut
          vient du <Link href="/admin/bareme">barème</Link> ; un module déposé se règle dans son
          formulaire.
        </p>
        <details className="bloc">
          <summary>
            {modulesCode.length} modules · {Object.keys(reglages).length} réglé(s)
          </summary>
          <div className="contenu-bloc">
            {modulesCode.map((m) => {
              const regle = reglages[m.id];
              const ecarts = ecartsDeLaFiche(m, regle, bareme.seuilDefaut);
              return (
                <form key={m.id} action={actionReglerSeuil} className="ligne-critere" style={{ alignItems: "center", flexWrap: "wrap" }}>
                  <span className="code">{typeof m.critereId === "string" ? m.critereId : "—"}</span>
                  <span className="libelle">
                    <LienModule id={m.id}>{m.titre.slice(0, 70)}</LienModule>{" "}
                    <span className="legende">
                      — {ecarts.length > 0 ? `écart à la fiche : ${ecarts.join(" · ")}` : `fiche, seuil ${bareme.seuilDefaut} %`}
                    </span>
                  </span>
                  <input type="hidden" name="moduleId" value={m.id} />
                  <input
                    type="number"
                    name="seuil"
                    min={50}
                    max={100}
                    step={1}
                    defaultValue={regle?.seuil ?? bareme.seuilDefaut}
                    style={{ width: "5rem" }}
                    aria-label={`Seuil de ${m.titre}`}
                  />
                  <button type="submit" className="bouton bouton--compact bouton--secondaire">Régler</button>
                  {regle && (
                    <button type="submit" name="mode" value="defaut" className="bouton bouton--compact bouton--discret">
                      Rétablir la fiche
                    </button>
                  )}
                  <details style={{ flexBasis: "100%" }}>
                    <summary className="legende">Profils : filières, niveaux, parcours</summary>
                    <div className="rangee">
                      <fieldset className="champ">
                        <legend className="legende">Filières</legend>
                        <span className="cases">
                          {filieres.map((f) => (
                            <label key={f.id}>
                              <input
                                type="checkbox"
                                name="filieres"
                                value={f.id}
                                defaultChecked={(regle?.filieres ?? m.postes).includes(f.id)}
                              />
                              {f.libelle}
                            </label>
                          ))}
                        </span>
                      </fieldset>
                      <fieldset className="champ">
                        <legend className="legende">Niveaux</legend>
                        <span className="cases">
                          {niveaux.map((n) => (
                            <label key={n.code}>
                              <input
                                type="checkbox"
                                name="niveaux"
                                value={n.code}
                                defaultChecked={(regle?.niveaux ?? m.niveaux).includes(n.code)}
                              />
                              {n.code}
                            </label>
                          ))}
                        </span>
                      </fieldset>
                      <fieldset className="champ">
                        <legend className="legende">Parcours</legend>
                        <span className="cases">
                          <label>
                            <input
                              type="checkbox"
                              name="parcours"
                              value="integration"
                              defaultChecked={(regle?.parcours ?? m.parcours).includes("integration")}
                            />
                            intégration
                          </label>
                          <label>
                            <input
                              type="checkbox"
                              name="parcours"
                              value="maintien"
                              defaultChecked={(regle?.parcours ?? m.parcours).includes("maintien")}
                            />
                            maintien
                          </label>
                        </span>
                      </fieldset>
                    </div>
                    <p className="legende" style={{ margin: 0 }}>
                      Tout décocher dans une liste revient à suivre la fiche pour elle. Une filière
                      hors socle fait passer le critère au programme de poste ; le socle seul le
                      remet au tronc commun.
                    </p>
                  </details>
                </form>
              );
            })}
          </div>
        </details>
      </section>
    </>
  );
}
