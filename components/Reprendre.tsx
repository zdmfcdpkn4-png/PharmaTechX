"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "./Badge";
import { DERNIER, type DernierModule } from "./LectureModule";
import { useSessionFormation } from "./SessionFormation";
import {
  CLE_CONSULTATIONS,
  choisirReprise,
  lireConsultations,
  type Consultation,
  type EtapeProgramme,
} from "@/content/tableau";

/**
 * « Reprendre ma formation » (tableau de bord de l'accueil, 22/09/2026).
 *
 * Un seul bouton, qui ouvre ce qu'il y a de plus utile à reprendre — voir
 * `choisirReprise` —, et les modules consultés récemment sur ce poste. Le
 * programme de référence est celui qui s'affiche à l'arrivée : le programme à
 * la carte du code, ou le socle et la filière du code de poste.
 *
 * Premier rendu identique côté serveur et côté navigateur : les repères
 * locaux (lecture, consultations) ne sont lus qu'après le montage.
 */
export interface EtapeReprise extends EtapeProgramme {
  badge?: string;
}

export function Reprendre({
  evaluation,
  programme,
  catalogue,
  requete = "",
}: {
  /** Évaluation laissée en plan, connue du serveur pour un agent rattaché. */
  evaluation: { moduleId: string; titre: string; detail: string } | null;
  /** Programme affiché à l'arrivée, dans son ordre. */
  programme: EtapeReprise[];
  /** Tous les modules publiés : badges, et tri des consultations encore valables. */
  catalogue: EtapeReprise[];
  requete?: string;
}) {
  const { dernierPourModule } = useSessionFormation();
  const [lecture, setLecture] = useState<DernierModule | null>(null);
  const [consultes, setConsultes] = useState<Consultation[]>([]);

  useEffect(() => {
    try {
      const brut = localStorage.getItem(DERNIER);
      const d = brut ? (JSON.parse(brut) as DernierModule) : null;
      if (d && typeof d.module === "string" && typeof d.titre === "string") setLecture(d);
      setConsultes(lireConsultations(localStorage.getItem(CLE_CONSULTATIONS)));
    } catch {
      // stockage refusé : la reprise se fonde sur le programme seul
    }
  }, []);

  const acquis = (id: string) => dernierPourModule(id)?.reussi === true;
  const badges = useMemo(() => new Map(catalogue.map((m) => [m.id, m.badge])), [catalogue]);
  // Une lecture ne se reprend d'ici que si son module est de ce parcours : un
  // module réglé hors du parcours affiché n'y reparaît pas par ce biais.
  const lectureDuParcours = lecture && badges.has(lecture.module) ? lecture : null;
  const reprise = choisirReprise({ evaluation, lecture: lectureDuParcours, programme, acquis, requete });
  // Un module retiré depuis sa consultation n'est plus proposé.
  const autres = consultes
    .filter((c) => c.module !== reprise?.moduleId && badges.has(c.module))
    .slice(0, 3);
  const action =
    reprise?.nature === "suivant" && !programme.some((m) => dernierPourModule(m.id))
      ? "Commencer ma formation"
      : "Reprendre ma formation";

  return (
    <div className="reprendre">
      {reprise ? (
        <Link href={reprise.href} className="reprendre-principal">
          <span className="reprendre-vignette" aria-hidden="true">
            {badges.get(reprise.moduleId) ? (
              <Badge nom={badges.get(reprise.moduleId)} taille={72} />
            ) : (
              <span className="reprendre-fleche">→</span>
            )}
          </span>
          <span className="reprendre-texte">
            <span className="reprendre-action">{action}</span>
            <strong className="reprendre-titre">{reprise.titre}</strong>
            <span className="reprendre-detail">{reprise.detail}</span>
          </span>
        </Link>
      ) : (
        <p className="reprendre-fini">
          Tous les modules ouvrables de ce programme sont acquis à l&apos;écran.
        </p>
      )}
      {autres.length > 0 && (
        <div className="consultes">
          <span className="consultes-titre" id="t-consultes">Consultés récemment</span>
          <ul className="consultes-liste" aria-labelledby="t-consultes">
            {autres.map((c) => (
              <li key={c.module}>
                {/* Texte seul : une illustration ne se réduit pas en pastille
                    (`content/badges.ts`). */}
                <Link href={`/module/${c.module}`} className="consulte">
                  <span>{c.titre}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
