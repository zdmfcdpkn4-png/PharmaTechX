import Link from "next/link";

/**
 * Module hors du programme d'un code de poste (question 101, choix b,
 * 05/10/2026) : sa page, ses documents et son évaluation lui sont fermés. La
 * page le dit et ramène au programme ; rien du module n'est servi, hormis son
 * titre, que les Repères citent déjà.
 */
export function HorsProgramme({ titre }: { titre: string }) {
  return (
    <article>
      <section className="panneau-titre">
        <p className="sur-titre">{titre}</p>
        <h1>Ce module n&apos;est pas à votre programme</h1>
        <p>
          Votre code d&apos;accès ouvre les modules de votre programme : votre filière et votre niveau, ou votre
          programme à la carte, fixés par votre tuteur ou l&apos;administrateur. La page de ce module, ses documents et
          son évaluation vous sont fermés.
        </p>
        <div className="actions" style={{ marginTop: 0 }}>
          <Link href="/#modules" className="bouton">
            Voir mes modules
          </Link>
        </div>
      </section>
    </article>
  );
}
