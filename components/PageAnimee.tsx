"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 * Entrée de page (paquet A, 21/09/2026).
 *
 * Un fondu de 160 ms à chaque changement de chemin, au lieu du saut blanc.
 * Coupé par `prefers-reduced-motion` comme tout le reste du site.
 *
 * **L'animation ne déplace rien : elle ne joue que sur l'opacité.** Les deux
 * écritures précédentes déplaçaient le contenu de 6 px, et c'était un défaut,
 * pas un détail :
 *
 *   1. la première posait `key={chemin}` sur `<main>`, ce qui jetait et
 *      reconstruisait tout le sous-arbre à chaque navigation — le contenu
 *      devenait momentanément absent ;
 *   2. la seconde relançait l'animation depuis un effet, donc **après** que la
 *      page était peinte et cliquable : le contenu sautait de 6 px sous le
 *      pointeur, et un clic parti pendant ces 160 ms pouvait manquer sa cible.
 *
 * Les deux ont été retirées après mesure — la chaîne de bout en bout est
 * tombée quatre fois, à quatre endroits différents, tant qu'un déplacement
 * subsistait. Un fondu d'opacité ne peut pas produire ce défaut : la boîte ne
 * bouge pas, et l'élément reste cliquable du premier au dernier millième.
 *
 * L'effet est de mise en page (`useLayoutEffect`) et non différé : il doit
 * poser la classe **avant** la peinture, sinon la page s'affiche opaque puis
 * clignote. Le repli sur `useEffect` côté serveur évite l'avertissement de
 * React au rendu SSR, où aucun des deux ne s'exécute de toute façon.
 *
 * Une ancre de la même page (`/#modules`) ne rejoue pas l'animation :
 * `usePathname()` ne porte pas le fragment.
 *
 * Ce n'est pas l'API *View Transitions*, qui fondrait l'ancienne page dans la
 * nouvelle : elle demanderait le drapeau `experimental.viewTransition` de
 * Next — un drapeau expérimental sur un site qui produit des documents
 * opposables, pour un fondu croisé au lieu d'un fondu simple. Choix consigné
 * dans `docs/DECISIONS.md`.
 *
 * L'élément `<main>` est rendu ici et non dans le gabarit : la feuille de
 * style vise `.page > section` pour les décalages d'ancre, et un conteneur
 * intercalé romprait ce sélecteur.
 */
const useEffetDeMiseEnPage = typeof window === "undefined" ? useEffect : useLayoutEffect;

export function PageAnimee({ children }: { children: React.ReactNode }) {
  const chemin = usePathname();
  const ref = useRef<HTMLElement>(null);
  const premier = useRef(true);

  useEffetDeMiseEnPage(() => {
    // Au premier rendu, la classe posée dans le balisage suffit.
    if (premier.current) {
      premier.current = false;
      return;
    }
    const el = ref.current;
    if (!el) return;
    el.classList.remove("entree-page");
    void el.offsetWidth;
    el.classList.add("entree-page");
  }, [chemin]);

  return (
    <main ref={ref} id="contenu" className="page entree-page">
      {children}
    </main>
  );
}
