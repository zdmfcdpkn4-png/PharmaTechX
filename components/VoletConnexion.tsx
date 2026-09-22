import Link from "next/link";

/**
 * Contenu du volet avant connexion (demande du 19/09/2026).
 *
 * Le volet portait jusqu'ici les mêmes raccourcis qu'une fois connecté :
 * « Mes modules », « Ma progression », « Le dispositif »… Or le filtre
 * d'entrée garde tout le site (question 13, choix c) : chacun de ces liens
 * ramenait à l'écran de connexion. Un menu dont tous les liens reviennent au
 * point de départ n'informe pas, il égare.
 *
 * Le volet ne garde donc que le seul écran réellement ouvert sans code — la
 * page d'information sur les données personnelles — et porte à la place ce
 * qu'il est utile de savoir avant d'entrer.
 */
export function VoletConnexion() {
  return (
    <>
      <div className="rail-groupe">
        <span className="rail-titre">Avant d&apos;entrer</span>
        <p className="rail-info">
          Ce site porte la formation et le maintien d&apos;habilitation de l&apos;équipe de
          production. Il est réservé au personnel de l&apos;unité.
        </p>
      </div>

      <div className="rail-groupe">
        <span className="rail-titre">Votre code</span>
        <p className="rail-info">
          Dix caractères, remis par le tutorat ou l&apos;administration. Perdu, il se
          remplace : demandez-en un nouveau.
        </p>
      </div>

      {/* Le détail de ce qui est enregistré est sur la page elle-même : le
          répéter ici faisait lire deux fois la même chose. Le lien reste. */}
      <div className="rail-groupe">
        <span className="rail-titre">En savoir plus</span>
        <Link href="/donnees-personnelles">Vos données et vos droits</Link>
      </div>
    </>
  );
}
