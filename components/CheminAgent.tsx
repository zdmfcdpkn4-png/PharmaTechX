"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge } from "./Badge";
import { DERNIER, type DernierModule } from "./LectureModule";
import { useSessionFormation } from "./SessionFormation";
import type { EtapeReprise } from "./Reprendre";
import { CHEMIN, etapeCourante } from "@/content/accueil";
import { choisirReprise } from "@/content/tableau";

/**
 * Accueil de l'agent (question 91, choix a, 02/10/2026) : les six étapes de
 * l'habilitation, de haut en bas, chacune avec son médaillon. Les étapes 1 et
 * 2 se font sur ce site ; les quatre autres sont grisées, avec le lieu où
 * elles se passent.
 *
 * Les comptes viennent de la mémoire de session (`SessionFormation`), la même
 * que le programme et « Reprendre » : un module acquis ici l'est là-bas. La
 * dernière lecture, gardée sur ce poste, n'est lue qu'après le montage :
 * premier rendu identique côté serveur et côté navigateur.
 */
export function CheminAgent({
  programme,
  evaluation,
  requete = "",
}: {
  /** Programme affiché à l'arrivée sur le programme, dans son ordre. */
  programme: EtapeReprise[];
  /** Évaluation laissée en plan, connue du serveur pour un agent rattaché. */
  evaluation: { moduleId: string; titre: string; detail: string } | null;
  requete?: string;
}) {
  const { resultats, dernierPourModule } = useSessionFormation();
  const [lecture, setLecture] = useState<DernierModule | null>(null);
  useEffect(() => {
    try {
      const brut = localStorage.getItem(DERNIER);
      const d = brut ? (JSON.parse(brut) as DernierModule) : null;
      if (d && typeof d.module === "string" && typeof d.titre === "string") setLecture(d);
    } catch {
      // stockage refusé : la reprise se fonde sur le programme seul
    }
  }, []);

  const acquis = (id: string) => dernierPourModule(id)?.reussi === true;
  const ouvrables = programme.filter((m) => m.evaluable || m.redige);
  const nbAcquis = ouvrables.filter((m) => acquis(m.id)).length;
  const lectureDuProgramme = lecture && programme.some((m) => m.id === lecture.module) ? lecture : null;
  const reprise = choisirReprise({ evaluation, lecture: lectureDuProgramme, programme, acquis, requete });
  const ici = etapeCourante({ evaluationEnCours: Boolean(evaluation), resteAAcquerir: reprise !== null });
  const reussies = resultats.filter((r) => r.reussi).length;
  const jamaisEvalue = !programme.some((m) => dernierPourModule(m.id));

  return (
    <ol className="chemin">
      {CHEMIN.map((e, i) => {
        const surLeSite = e.lieu === "site";
        const courante = e.numero === ici;
        // Le tronçon qui part de cette étape est plein s'il mène à une étape du site.
        const versSite = CHEMIN[i + 1]?.lieu === "site";
        return (
          <li
            key={e.numero}
            className={[
              "chemin-etape",
              surLeSite ? "chemin-etape--site" : "chemin-etape--hors",
              courante ? "chemin-etape--ici" : "",
              versSite ? "chemin-etape--vers-site" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            aria-current={courante && surLeSite ? "step" : undefined}
          >
            <span className="chemin-medaillon">
              <Badge nom={e.medaillon} taille={64} />
              <span className="chemin-numero" aria-hidden="true">
                {e.numero}
              </span>
            </span>
            <div className="chemin-corps">
              <span className="chemin-titre">
                {e.titre}
                <span className="lecture-seule">
                  {" "}— étape {e.numero} sur {CHEMIN.length}, {e.titreFiche.toLowerCase()}
                  {surLeSite ? ", sur ce site" : `, hors du site : ${e.ou?.toLowerCase()}`}
                </span>
              </span>
              {courante && (
                <span className="chemin-ici">{surLeSite ? "Vous êtes ici" : "Prochaine étape"}</span>
              )}
              {e.numero === 1 && (
                <>
                  <span className="chemin-detail">
                    {nbAcquis} module{nbAcquis > 1 ? "s" : ""} sur {ouvrables.length} acquis
                  </span>
                  <span className="jauge-chemin" aria-hidden="true">
                    <span style={{ width: `${ouvrables.length ? Math.round((nbAcquis / ouvrables.length) * 100) : 0}%` }} />
                  </span>
                  {reprise && reprise.nature !== "evaluation" ? (
                    <Link href={reprise.href} className="bouton bouton--compact chemin-action">
                      {jamaisEvalue && reprise.nature === "suivant" ? "Commencer" : "Reprendre"} : {reprise.titre}
                    </Link>
                  ) : (
                    <Link href={`/${requete}#modules`} className="chemin-lien">
                      Mes modules
                    </Link>
                  )}
                </>
              )}
              {e.numero === 2 && (
                <>
                  <span className="chemin-detail">
                    {resultats.length === 0
                      ? "Aucune évaluation encore"
                      : `${resultats.length} évaluation${resultats.length > 1 ? "s" : ""}, ${reussies} réussie${reussies > 1 ? "s" : ""}`}
                  </span>
                  {reprise?.nature === "evaluation" ? (
                    <Link href={reprise.href} className="bouton bouton--compact chemin-action">
                      Reprendre l&apos;évaluation : {reprise.titre}
                    </Link>
                  ) : resultats.length > 0 ? (
                    <Link href={`/${requete}#rapport`} className="chemin-lien">
                      Mes évaluations
                    </Link>
                  ) : null}
                </>
              )}
              {!surLeSite && <span className="chemin-ou">{e.ou}</span>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
