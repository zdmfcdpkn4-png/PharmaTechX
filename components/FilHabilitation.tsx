"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Fil d'habilitation (paquet A, 21/09/2026).
 *
 * Il n'est pas décoratif : il corrige un malentendu coûteux. Le site couvre
 * les étapes 1 et 2 de la chaîne d'habilitation — formation théorique et
 * évaluation des connaissances. Les étapes 3 à 6 se déroulent au poste et
 * chez le pharmacien responsable. Un agent qui valide un module croit
 * parfois être habilité ; la bande le dit à chaque écran, sans phrase.
 *
 * Écrans de module seulement. L'accueil porte déjà la phrase deux fois — en
 * sur-titre (« étapes 1 et 2 sur 6 ») et dans l'encart « Valider un module à
 * l'écran ne vaut pas habilitation » ; une troisième occurrence n'aurait rien
 * ajouté qu'une bande de plus. C'est dans le module et dans l'évaluation que
 * rien ne le dit, et c'est là qu'on l'oublie. Sur les écrans d'administration,
 * le malentendu n'existe pas.
 *
 * Les pastilles ne sont pas cliquables — six cibles de 20 px violeraient la
 * règle de taille ; un seul lien, en fin de bande, mène aux repères.
 */
export interface EtapeFil {
  numero: number;
  titre: string;
  lieu: "site" | "terrain" | "pharmacien";
}

const OU: Record<EtapeFil["lieu"], string> = {
  site: "sur ce site",
  terrain: "au poste",
  pharmacien: "chez le pharmacien responsable",
};

export function FilHabilitation({ etapes }: { etapes: EtapeFil[] }) {
  const chemin = usePathname();
  if (!chemin.startsWith("/module") || etapes.length === 0) return null;

  // Lire un module, c'est l'étape 1 ; passer l'évaluation, l'étape 2.
  const courante = chemin.endsWith("/evaluation") ? 2 : 1;
  const surLeSite = etapes.filter((e) => e.lieu === "site").length;

  return (
    <nav className="fil-habilitation" aria-label="Chaîne d'habilitation">
      {/* Deux intitulés, un seul affiché : le court sur téléphone, où le fil
          tient sur deux lignes au lieu de quatre (audit du 22/09/2026). */}
      <span className="sur-titre">
        <span className="fil-titre-long">
          Habilitation — {etapes.length} étapes, dont {surLeSite} sur ce site
        </span>
        <span className="fil-titre-court">
          Habilitation · {surLeSite} étapes sur {etapes.length} ici
        </span>
      </span>
      <span className="fil-etapes">
      {etapes.map((e) => (
        <span
          key={e.numero}
          className={[
            "fil-etape",
            e.lieu === "site" ? "fil-etape--site" : "fil-hors",
            e.lieu === "site" && e.numero === courante ? "fil-etape--courante" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <span className="num" aria-hidden="true">{e.numero}</span>
          <span className="libelle">{e.titre}</span>
          <span className="lecture-seule">
            {" "}— étape {e.numero} sur {etapes.length}, {OU[e.lieu]}
            {e.lieu === "site" && e.numero === courante ? ", étape en cours" : ""}
          </span>
        </span>
      ))}
      </span>
      <Link href="/reperes#dispositif" className="fil-lien">
        Le dispositif
      </Link>
    </nav>
  );
}
