import Link from "next/link";
import { PictoMenu } from "./PictoMenu";

/**
 * Contenu du volet avant connexion (demande du 19/09/2026).
 *
 * Le volet portait jusqu'ici les mêmes raccourcis qu'une fois connecté :
 * « Mes modules », « Ma progression », « Le dispositif »… Or le filtre
 * d'entrée garde tout le site (question 13, choix c) : chacun de ces liens
 * ramenait à l'écran de connexion. Un menu dont tous les liens reviennent au
 * point de départ n'informe pas, il égare.
 *
 * Le volet ne garde donc que le seul écran réellement ouvert sans code —
 * l'onglet RGPD — et porte à la place ce qu'il est utile de savoir avant
 * d'entrer.
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

      {/* L'onglet RGPD, comme une fois connecté : seul écran ouvert sans code. */}
      <Link href="/donnees-personnelles" className="rail-onglet">
        <span className="rail-onglet-titre">
          <PictoMenu theme="rgpd" taille={15} />
          RGPD
        </span>
        <span className="rail-onglet-detail">Vos données et vos droits</span>
      </Link>
    </>
  );
}
