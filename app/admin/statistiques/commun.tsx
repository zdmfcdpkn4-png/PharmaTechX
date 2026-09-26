import Link from "next/link";
import type { Module } from "@/content/types";
import { PERIODES } from "@/lib/pilotage";
import { LIBELLES_REPERE, SEUILS_STAT, type Repere, type Taux } from "@/lib/statistiques";

/**
 * Pièces communes aux écrans de statistiques (question 78, choix a,
 * 25/09/2026) : filtres, affichage d'un taux et de son intervalle, méthode.
 */

export interface ParametresStat {
  filiere?: string;
  niveau?: string;
  bloc?: string;
  periode?: string;
  ordre?: string;
}

export interface FiltreStat {
  filiere: string;
  niveau: string;
  bloc: number | null;
  periode: (typeof PERIODES)[number];
  /** Début de la période, ISO ; `null` : depuis le début. */
  depuis: string | null;
  /** Modules retenus par filière, niveau et bloc ; `null` : tous. */
  modules: string[] | null;
  /** Filtres actifs, à reporter dans les liens (fiche, export, ordre). */
  parametres: [string, string][];
}

/**
 * Même lecture que le Pilotage : filière et niveau portent sur le module — un
 * module de tronc commun concerne toutes les filières, un module sans niveau
 * tous les niveaux —, le bloc sur son critère.
 */
export function resoudreFiltre(
  p: ParametresStat,
  modules: Module[],
  filieres: { id: string }[],
  niveaux: { code: string }[],
  /** Blocs servis, fiche et dépôts (question 81) : le filtre n'accepte qu'eux. */
  blocs: { numero: number }[],
): FiltreStat {
  const filiere = filieres.some((f) => f.id === p.filiere) ? p.filiere! : "";
  const niveau = niveaux.some((n) => n.code === p.niveau) ? p.niveau! : "";
  const bloc = blocs.some((b) => String(b.numero) === p.bloc) ? Number(p.bloc) : null;
  const periode = PERIODES.find((x) => x.cle === p.periode) ?? PERIODES[3];
  const retenus = modules.filter(
    (m) =>
      (!filiere || m.affectation === "tronc-commun" || m.postes.includes(filiere)) &&
      (!niveau || m.niveaux.length === 0 || (m.niveaux as string[]).includes(niveau)) &&
      (bloc === null || m.bloc === bloc),
  );
  const parametres = (
    [
      ["filiere", filiere],
      ["niveau", niveau],
      ["bloc", bloc === null ? "" : String(bloc)],
      ["periode", periode.cle === "tout" ? "" : periode.cle],
    ] as [string, string][]
  ).filter(([, v]) => v !== "");
  return {
    filiere,
    niveau,
    bloc,
    periode,
    depuis: periode.jours === null ? null : new Date(Date.now() - periode.jours * 86_400_000).toISOString(),
    modules: filiere || niveau || bloc !== null ? retenus.map((m) => m.id) : null,
    parametres,
  };
}

/** Adresse avec les filtres courants, et d'éventuels paramètres en plus. */
export function avecFiltres(chemin: string, parametres: [string, string][], ajouts: Record<string, string> = {}): string {
  const q = new URLSearchParams(parametres);
  for (const [k, v] of Object.entries(ajouts)) q.set(k, v);
  const s = q.toString();
  return s ? `${chemin}?${s}` : chemin;
}

/** « 50 % », son intervalle en petit ; « — » et l'effectif sous le seuil. */
export function TexteTaux({ t, unite = "agent" }: { t: Taux; unite?: string }) {
  if (t.taux === null) {
    return (
      <span className="legende">
        — <span className="stat-effectif">({t.n} {unite}{t.n > 1 ? "s" : ""}, {SEUILS_STAT.effectif} requis)</span>
      </span>
    );
  }
  return (
    <span className="stat-taux">
      <strong>{t.taux} %</strong>{" "}
      <span className="stat-ic" title="Intervalle de confiance à 95 % (score de Wilson)">
        IC 95 % {t.bas}–{t.haut}
      </span>
    </span>
  );
}

/**
 * Le taux en barre pleine, son intervalle de confiance en trait fin : deux
 * modules dont les traits se chevauchent largement ne se distinguent pas
 * vraiment, quel que soit leur rang.
 */
export function BarreTaux({ t, repere }: { t: Taux; repere?: number }) {
  if (t.taux === null) return <div className="barre-taux barre-taux--vide" aria-hidden="true" />;
  const faible = repere !== undefined && t.taux < repere;
  return (
    <div className="barre-taux" aria-hidden="true">
      <span className={`barre-taux-valeur${faible ? " barre-taux-valeur--faible" : ""}`} style={{ width: `${t.taux}%` }} />
      <span className="barre-taux-ic" style={{ left: `${t.bas}%`, width: `${Math.max(0, (t.haut ?? 0) - (t.bas ?? 0))}%` }} />
      {repere !== undefined && <span className="barre-taux-repere" style={{ left: `${repere}%` }} />}
    </div>
  );
}

export function Reperes({ reperes }: { reperes: readonly Repere[] }) {
  if (reperes.length === 0) return null;
  return (
    <>
      {reperes.map((r) => (
        <span key={r} className={`etiquette ${r === "tres-facile" ? "etiquette--neutre" : "etiquette--attention"}`}>
          {LIBELLES_REPERE[r]}
        </span>
      ))}
    </>
  );
}

/** Méthode et repères de lecture, avec leurs sources, au bas de chaque écran. */
export function Methode() {
  return (
    <details className="bloc methode-stat">
      <summary>Méthode et repères de lecture</summary>
      <div className="contenu-bloc">
        <ul>
          <li>
            <strong>Essais comptés</strong> : toutes les évaluations conservées des agents rattachés à leur
            identifiant, réussies ou non, émises en rapport ou non, et les rapports émis sans évaluation
            conservée ; une évaluation émise ne compte qu&apos;une fois. Un essai dont le seul rapport a été
            annulé est écarté. Ni les entraînements, ni le mode test, ni les évaluations passées sans
            identifiant — ni rattachées ni émises — n&apos;y figurent.
          </li>
          <li>
            <strong>Réussir un essai</strong> : atteindre le seuil du module sans échouer à une question
            éliminatoire. Ce n&apos;est pas le verdict d&apos;habilitation (bande de garde, tirage concluant),
            qui reste au Pilotage.
          </li>
          <li>
            <strong>Réussite au premier essai</strong> : le premier essai de chaque agent sur le module — la
            mesure la plus directe de la formation reçue. <strong>Réussite finale</strong> : les agents qui ont
            atteint le seuil à un essai au moins, chaque agent comptant une fois.
          </li>
          <li>
            <strong>Aucun taux sous {SEUILS_STAT.effectif} agents distincts</strong>, pour un module, une
            question, une réponse ou une source : un agent qui repasse cinq fois ne fait pas un taux — ce serait
            le sien. En dessous, il ne dirait rien, et désignerait presque quelqu&apos;un. Chaque taux porte son
            intervalle de confiance à 95 % (score de Wilson) ; deux intervalles qui se chevauchent largement ne
            distinguent pas vraiment deux modules.
          </li>
          <li>
            <strong>Indice de discrimination</strong> : corrélation entre la réussite à une question et le score
            de l&apos;essai sans elle (point-bisériale corrigée). Sous {String(SEUILS_STAT.discrimination).replace(".", ",")},
            la question sépare mal ceux qui réussissent de ceux qui échouent ; négatif, elle est mieux réussie
            par ceux qui échouent — la réponse attendue est à vérifier.
          </li>
          <li>
            <strong>Repères</strong>, conventions de lecture et non normes : module à revoir sous{" "}
            {SEUILS_STAT.aRevoir} % de réussite au premier essai ; question très facile à {SEUILS_STAT.facile} % et
            plus, très difficile à {SEUILS_STAT.difficile} % et moins ; mauvaise réponse de QCM choisie par moins de{" "}
            {SEUILS_STAT.distracteur} % : elle ne piège plus personne.
          </li>
        </ul>
        <p className="legende">
          Sources : Tavakol M, Dennick R. Post-examination analysis of objective tests. Med Teach.
          2011;33(6):447-58 (indices de difficulté et de discrimination) ; Tarrant M, Ware J, Mohammed AM. BMC
          Med Educ. 2009;9:40 (mauvaises réponses qui ne piègent personne) ; Newcombe RG. Stat Med.
          1998;17(8):857-72 (intervalle de Wilson). Le détail par agent reste sur{" "}
          <Link href="/admin/personnel">Personnel</Link>.
        </p>
      </div>
    </details>
  );
}
