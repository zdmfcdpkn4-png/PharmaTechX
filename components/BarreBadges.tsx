"use client";

import Link from "next/link";
import { Badge } from "./Badge";
import { useSessionFormation } from "./SessionFormation";

/**
 * Barre de progression du parcours (demande du 22/09/2026) : « utiliser les
 * badges des modules, validés ou grisés ». Un badge par module du programme,
 * dans l'ordre du programme : en couleur quand le critère est acquis, grisé
 * sinon.
 *
 * « Acquis » veut dire ici : la dernière évaluation de ce module, dans la
 * mémoire de session — celle de l'onglet, ou l'historique conservé d'un agent
 * rattaché —, a le verdict brut « acquis ». Un verdict indéterminé en attente
 * d'arbitrage reste grisé. Ce n'est pas un avancement d'habilitation : la
 * barre le dit.
 *
 * Les illustrations ne se lisent pas à cette taille (`content/badges.ts`) :
 * elles servent ici de repère de couleur, et le titre du module est dans le
 * nom accessible et l'infobulle de chaque badge.
 */

export interface EtapeBadge {
  id: string;
  titre: string;
  critereId: string;
  /** Illustration ou pictogramme du module ; absent, le numéro de critère en tient lieu. */
  badge?: string;
  /** Module avec des questions : lui seul peut devenir acquis. */
  evaluable: boolean;
}

export function BarreBadges({ etapes, requete = "" }: { etapes: EtapeBadge[]; requete?: string }) {
  const { dernierPourModule } = useSessionFormation();
  if (etapes.length === 0) return null;
  const acquis = (id: string) => dernierPourModule(id)?.reussi === true;
  const nbAcquis = etapes.filter((e) => acquis(e.id)).length;
  const nbEvaluables = etapes.filter((e) => e.evaluable).length;

  return (
    <section className="barre-badges" aria-labelledby="t-barre-badges">
      <p id="t-barre-badges" className="barre-badges-titre">
        <strong>
          {nbAcquis} / {etapes.length}
        </strong>{" "}
        critère{etapes.length > 1 ? "s" : ""} acquis — {nbEvaluables} évaluable{nbEvaluables > 1 ? "s" : ""} aujourd&apos;hui
      </p>
      <ol className="barre-badges-liste">
        {etapes.map((e, i) => {
          const ok = acquis(e.id);
          const etat = ok ? "acquis" : e.evaluable ? "à valider" : "pas encore d'évaluation";
          const nom = `${i + 1}. ${e.critereId && e.critereId !== "[à préciser]" ? `${e.critereId} — ` : ""}${e.titre} : ${etat}`;
          const contenu = (
            <>
              <span aria-hidden="true" className="barre-badge-visuel">
                {e.badge ? <Badge nom={e.badge} taille={40} /> : <span className="barre-badge-vide">{i + 1}</span>}
              </span>
              <span className="visually-hidden">{nom}</span>
            </>
          );
          return (
            <li key={e.id} className={ok ? "est-acquis" : "est-grise"}>
              {e.evaluable ? (
                <Link href={`/module/${e.id}${requete}`} title={nom} className="barre-badge">
                  {contenu}
                </Link>
              ) : (
                <span title={nom} className="barre-badge">
                  {contenu}
                </span>
              )}
            </li>
          );
        })}
      </ol>
      <p className="legende" style={{ margin: 0 }}>
        En couleur : critère acquis à l&apos;écran. Grisé : à valider. Ce n&apos;est pas un avancement
        d&apos;habilitation.
      </p>
    </section>
  );
}
