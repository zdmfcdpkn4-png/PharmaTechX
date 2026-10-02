import Link from "next/link";
import { BarreFiltres } from "@/components/BarreFiltres";
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
  // Compte de la barre (question 91, lot 3) : les modules évalués du périmètre, sur ceux évalués sans filtre.
  const evalues = conservation ? bilansModules(f.modules === null ? essais : await lireEssais(null)).length : 0;

  const dansPeriode = essais.filter((e) => f.depuis === null || e.le >= f.depuis);
  const agents = new Set(dansPeriode.map((e) => e.agent)).size;
  // Cinq agents distincts, pas cinq premiers essais : un agent évalué sur cinq modules ne fait pas un taux.
  const premiers = premierEssaiGlobal(essais, f.depuis);
  const aRevoir = bilans.filter((b) => b.aRevoir).length;

  return (
    <>
      <section className="panneau-titre">
        <h1>Statistiques de réussite</h1>
        <p>
          Les modules réussis, ceux qui accrochent, et où : pour ajuster la formation, jamais pour juger quelqu&apos;un.
          Aucune donnée individuelle ; un taux n&apos;apparaît qu&apos;à partir de {SEUILS_STAT.effectif} agents.
        </p>
      </section>

      {/* La barre de la banque (question 91, choix a, lot 3), le classement sous « Plus de filtres et tri ». */}
      <BarreFiltres
        adresse="/admin/statistiques"
        classe="filtres-pilotage"
        champs={[
          {
            nom: "filiere",
            libelle: "Filière",
            tous: "Toutes",
            options: filieres.map((x) => ({ valeur: x.id, libelle: x.libelle })),
            valeur: f.filiere,
          },
          {
            nom: "niveau",
            libelle: "Niveau",
            options: niveaux.map((n) => ({ valeur: n.code, libelle: n.libelle })),
            valeur: f.niveau,
          },
          {
            nom: "bloc",
            libelle: "Bloc",
            options: blocs.map((b) => ({ valeur: String(b.numero), libelle: `${b.numero} — ${b.titre.slice(0, 50)}`, puce: String(b.numero) })),
            valeur: f.bloc === null ? "" : String(f.bloc),
            large: true,
          },
        ]}
        plus={[
          {
            nom: "periode",
            libelle: "Période",
            tous: "Depuis le début",
            options: PERIODES.filter((x) => x.jours !== null).map((x) => ({ valeur: x.cle, libelle: x.libelle })),
            valeur: f.periode.jours === null ? "" : f.periode.cle,
          },
          {
            nom: "ordre",
            libelle: "Classement",
            tous: "Le plus faible d'abord",
            options: [{ valeur: "fort", libelle: "Le meilleur d'abord" }],
            valeur: ordre === "fort" ? "fort" : "",
            minuscule: true,
            tri: true,
          },
        ]}
        plusLibelle="Plus de filtres et tri"
        retenus={bilans.length}
        total={evalues}
        unite={["module évalué", "modules évalués"]}
      />

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
