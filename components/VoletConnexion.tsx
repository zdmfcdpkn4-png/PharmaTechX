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
          Dix caractères séparés d&apos;un tiret, remis par le tutorat ou
          l&apos;administration. Il ouvre un profil — poste de travail, tutorat ou
          administration — et ne désigne personne.
        </p>
        <p className="rail-info">
          Un code perdu ne se retrouve pas : la base ne le conserve que haché. Le tutorat en
          délivre un nouveau.
        </p>
      </div>

      <div className="rail-groupe">
        <span className="rail-titre">Ce qui est enregistré</span>
        <p className="rail-info">
          Aucun nom. Les réponses transmises pour correction ne portent ni nom, ni matricule, ni
          adresse.
        </p>
        <Link href="/donnees-personnelles">Vos données et vos droits</Link>
      </div>
    </>
  );
}
