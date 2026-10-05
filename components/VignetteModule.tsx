import type { ReactNode } from "react";
import { BADGES, Badge } from "./Badge";

/**
 * Vignette d'un module — son illustration ou son pictogramme (`Badge`), sinon
 * un secours (numéro de critère, rang) — avec, quand le module est acquis à
 * l'écran, une coche de validation posée dessus (demande du 06/10/2026 :
 * « l'apprenant peut voir la progression, les modules validés avec une icône
 * modifiée avec une validation dessus »).
 *
 * « Acquis » veut dire ici, comme sur la barre de badges : la dernière
 * évaluation de ce module, dans la mémoire de session — celle de l'onglet, ou
 * l'historique conservé d'un agent rattaché —, a le verdict brut « acquis ».
 * Ce n'est pas un avancement d'habilitation. La coche est décorative : l'état
 * se lit à côté (pastille « Acquis » de la carte, nom accessible du badge).
 */
export function VignetteModule({
  badge,
  taille,
  acquis = false,
  secours,
}: {
  badge?: string | null;
  taille: number;
  /** Module acquis à l'écran : la coche verte se pose sur la vignette. */
  acquis?: boolean;
  /** Ce qui tient lieu de vignette quand le module n'a pas d'illustration. */
  secours?: ReactNode;
}) {
  // Rien à décorer — ni illustration connue, ni secours — : rien, plutôt qu'une coche orpheline.
  const illustre = Boolean(badge && BADGES[badge]);
  if (!illustre && !secours) return null;
  return (
    <span className={acquis ? "vignette-module vignette-module--acquise" : "vignette-module"}>
      {illustre ? <Badge nom={badge} taille={taille} /> : secours}
      {acquis && (
        <span className="vignette-coche" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
        </span>
      )}
    </span>
  );
}
