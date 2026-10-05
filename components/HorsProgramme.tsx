import Link from "next/link";
import type { MotifFermeture } from "@/lib/profil-impose";

/**
 * Module fermé à l'apprenant, sans rien en servir hormis son titre, que les
 * Repères citent déjà ; la page dit pourquoi et ramène au programme :
 *  - hors du programme d'un code de poste (question 101, choix b,
 *    05/10/2026) : sa page, ses documents et son évaluation lui sont fermés ;
 *  - sans question (05/10/2026, demande directe) : un module ne s'ouvre à
 *    l'apprenant qu'avec au moins une question validée.
 */
export function HorsProgramme({ titre, motif = "hors-programme" }: { titre: string; motif?: MotifFermeture }) {
  return (
    <article>
      <section className="panneau-titre">
        <p className="sur-titre">{titre}</p>
        {motif === "sans-question" ? (
          <>
            <h1>Ce module n&apos;est pas encore ouvert</h1>
            <p>
              Il n&apos;a pas encore de question validée. Il s&apos;ouvrira dès que ses questions le seront&nbsp;: sa
              page, ses documents et son évaluation vous seront alors accessibles.
            </p>
          </>
        ) : (
          <>
            <h1>Ce module n&apos;est pas à votre programme</h1>
            <p>
              Votre code d&apos;accès ouvre les modules de votre programme : votre filière et votre niveau, ou votre
              programme à la carte, fixés par votre tuteur ou l&apos;administrateur. La page de ce module, ses documents et
              son évaluation vous sont fermés.
            </p>
          </>
        )}
        <div className="actions" style={{ marginTop: 0 }}>
          <Link href="/#modules" className="bouton">
            Voir mes modules
          </Link>
        </div>
      </section>
    </article>
  );
}
