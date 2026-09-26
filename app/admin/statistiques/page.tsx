import Link from "next/link";
import { Cartouche } from "@/components/Graphiques";
import { getReferentiel } from "@/content/referentiel-db";
import { getTousModulesAvecDeposes } from "@/content/store";
import { listeBlocs } from "@/content/blocs-db";
import { conservationActive } from "@/lib/config";
import { PERIODES } from "@/lib/pilotage";
import { SEUILS_STAT, bilansModules, classerModules, premierEssaiGlobal, type OrdreClassement } from "@/lib/statistiques";
import { lireEssais } from "@/lib/statistiques-db";
import { BarreTaux, Methode, TexteTaux, avecFiltres, resoudreFiltre, type ParametresStat } from "./commun";

export const dynamic = "force-dynamic";

/**
 * Statistiques de réussite (question 78, choix a, 25/09/2026) — tuteurs et
 * administrateurs.
 *
 * Le classement des modules, du plus faible au plus fort (ou l'inverse), sur
 * la réussite au premier essai : c'est elle qui mesure la formation reçue. Le
 * Pilotage ne lit que les rapports émis, où la réussite paraît plus haute
 * qu'elle n'est ; ici, tous les essais conservés comptent, premiers essais
 * compris. Chaque module ouvre sa fiche : questions, réponses manquées,
 * sources, actions d'amélioration.
 */
export default async function Statistiques({ searchParams }: { searchParams: Promise<ParametresStat> }) {
  const p = await searchParams;
  const [{ filieres, niveaux }, modules, blocs] = await Promise.all([
    getReferentiel(),
    getTousModulesAvecDeposes({ publiesSeulement: false }),
    listeBlocs(),
  ]);
  const f = resoudreFiltre(p, modules, filieres, niveaux, blocs);
  const ordre: OrdreClassement = p.ordre === "fort" ? "fort" : "faible";
  const conservation = conservationActive();
  const essais = conservation ? await lireEssais(f.modules) : [];
  const bilans = classerModules(bilansModules(essais, f.depuis), ordre);

  const dansPeriode = essais.filter((e) => f.depuis === null || e.le >= f.depuis);
  const agents = new Set(dansPeriode.map((e) => e.agent)).size;
  // Cinq agents distincts, pas cinq premiers essais : un agent évalué sur cinq modules ne fait pas un taux.
  const premiers = premierEssaiGlobal(essais, f.depuis);
  const aRevoir = bilans.filter((b) => b.aRevoir).length;
  const aucunFiltre = f.parametres.length === 0;

  return (
    <>
      <section className="panneau-titre">
        <h1>Statistiques de réussite</h1>
        <p>
          Les modules que les agents réussissent, ceux qui accrochent, et où précisément — pour ajuster la
          formation, jamais pour juger quelqu&apos;un. Tous les essais conservés comptent, premiers essais
          compris ; aucune donnée individuelle ; un taux n&apos;apparaît qu&apos;à partir de {SEUILS_STAT.effectif}{" "}
          agents.
        </p>
      </section>

      <form method="get" className="carte filtres-pilotage">
        <div className="rangee">
          <label className="champ">
            <span>Filière</span>
            <select name="filiere" defaultValue={f.filiere}>
              <option value="">Toutes</option>
              {filieres.map((x) => (
                <option key={x.id} value={x.id}>{x.libelle}</option>
              ))}
            </select>
          </label>
          <label className="champ">
            <span>Niveau</span>
            <select name="niveau" defaultValue={f.niveau}>
              <option value="">Tous</option>
              {niveaux.map((n) => (
                <option key={n.code} value={n.code}>{n.libelle}</option>
              ))}
            </select>
          </label>
          <label className="champ">
            <span>Bloc de compétence</span>
            <select name="bloc" defaultValue={f.bloc === null ? "" : String(f.bloc)}>
              <option value="">Tous</option>
              {blocs.map((b) => (
                <option key={b.numero} value={b.numero}>{b.numero}. {b.titre}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="rangee">
          <label className="champ">
            <span>Période</span>
            <select name="periode" defaultValue={f.periode.cle}>
              {PERIODES.map((x) => (
                <option key={x.cle} value={x.cle}>{x.libelle}</option>
              ))}
            </select>
          </label>
          <label className="champ">
            <span>Classement</span>
            <select name="ordre" defaultValue={ordre}>
              <option value="faible">Le plus faible d&apos;abord</option>
              <option value="fort">Le meilleur d&apos;abord</option>
            </select>
          </label>
          <div className="actions actions--fin">
            <button type="submit" className="bouton bouton--compact">Appliquer</button>
            {(!aucunFiltre || ordre === "fort") && (
              <Link href="/admin/statistiques" className="bouton bouton--compact bouton--discret">Tout afficher</Link>
            )}
          </div>
        </div>
      </form>

      {!conservation ? (
        <p className="encart encart--attention">
          <strong>Les résultats ne sont pas enregistrés.</strong> Avec <code>CONSERVATION_RAPPORTS=aucune</code>,
          aucune évaluation n&apos;entre en base : il n&apos;y a rien à analyser. Voir <code>docs/RGPD.md</code>.
        </p>
      ) : (
        <>
          <div className="grille-cartouches">
            <Cartouche valeur={bilans.length} libelle="Modules évalués" precision={`${dansPeriode.length} essai(s) sur la période`} />
            <Cartouche valeur={agents} libelle="Agents évalués" precision="rattachés ou ayant émis un rapport" />
            <Cartouche
              valeur={premiers.taux ?? "—"}
              unite={premiers.taux === null ? undefined : " %"}
              libelle="Réussite au premier essai"
              precision={
                premiers.taux === null
                  ? `${premiers.n} premier(s) essai(s), ${SEUILS_STAT.effectif} requis`
                  : `IC 95 % ${premiers.bas}–${premiers.haut}, ${premiers.n} premiers essais`
              }
            />
            <Cartouche
              valeur={aRevoir}
              libelle="Modules à revoir"
              ton={aRevoir > 0 ? "var(--alerte)" : undefined}
              precision={`sous ${SEUILS_STAT.aRevoir} % au premier essai`}
            />
          </div>

          <section className="carte">
            <div className="section-titre">
              <h2>{ordre === "faible" ? "Modules — le plus faible d'abord" : "Modules — le meilleur d'abord"}</h2>
              <span className="compte">{bilans.length} module(s)</span>
            </div>
            <p className="legende">
              Barre : réussite au premier essai ; trait fin : son intervalle de confiance à 95 % ; repère :{" "}
              {SEUILS_STAT.aRevoir} %. Chaque module ouvre sa fiche — questions, réponses manquées, sources,
              actions d&apos;amélioration.
            </p>
            {bilans.length === 0 ? (
              <p className="legende">Aucun essai conservé sur ce périmètre.</p>
            ) : (
              <ul className="liste-nue liste-criteres liste-stats">
                {bilans.map((b) => (
                  <li key={b.moduleId}>
                    <div className="etape-tete">
                      {b.aRevoir && <span className="etiquette etiquette--echec">À revoir</span>}
                      <Link href={avecFiltres(`/admin/statistiques/${encodeURIComponent(b.moduleId)}`, f.parametres.filter(([k]) => k === "periode"))}>
                        {b.titre}
                      </Link>
                      <span className="legende" style={{ marginLeft: "auto" }}>
                        {b.agents} agent{b.agents > 1 ? "s" : ""} · {b.essais} essai{b.essais > 1 ? "s" : ""}
                      </span>
                    </div>
                    <BarreTaux t={b.premierEssai} repere={SEUILS_STAT.aRevoir} />
                    <p className="legende stat-ligne">
                      Premier essai : <TexteTaux t={b.premierEssai} unite="premier essai" />
                      {" · "}Final : <TexteTaux t={b.final} />
                      {b.essaisPourReussir !== null && <> · {String(b.essaisPourReussir).replace(".", ",")} essai(s) pour réussir</>}
                      {b.scoreMedianPremier !== null && <> · score médian au premier essai {b.scoreMedianPremier} %</>}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            <p className="actions">
              <a className="bouton bouton--compact bouton--secondaire" href={avecFiltres("/admin/statistiques/export.csv", f.parametres, { type: "modules" })}>
                Tableur des modules
              </a>
              <a className="bouton bouton--compact bouton--secondaire" href={avecFiltres("/admin/statistiques/export.csv", f.parametres, { type: "questions" })}>
                Tableur des questions
              </a>
            </p>
          </section>

          <p className="legende">
            Les verdicts d&apos;habilitation et ce qui attend une signature sont au <Link href="/admin/pilotage">Pilotage</Link>.
          </p>
        </>
      )}

      <Methode />
    </>
  );
}
