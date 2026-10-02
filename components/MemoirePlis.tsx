"use client";

import { useEffect, useRef } from "react";

/**
 * Souvenir des branches ouvertes d'une arborescence (question 91, choix a,
 * 02/10/2026). Toute arborescence s'ouvre repliée ; une branche qu'on ouvre
 * le reste, le temps de la session de l'onglet, quand on revient sur la page
 * — après un geste, un filtre ou un retour arrière.
 *
 * Les branches suivies portent `data-pli="<arbre>:<clé>"`. Seules leurs clés
 * ouvertes sont gardées, sous `fp-plis-<arbre>`, dans le stockage de session
 * du navigateur : rien de nominatif, rien de transmis, oublié à la fermeture
 * de l'onglet. Une branche n'est rouverte qu'à sa première apparition dans
 * la page : une branche que le serveur referme ensuite reste fermée.
 *
 * Le choix est retenu au clic sur l'intitulé, souris ou clavier, et non à
 * l'événement `toggle` : celui-ci arrive après coup, et se perdait quand on
 * quittait la page aussitôt la branche ouverte.
 *
 * `etat` : `garder` (par défaut) ; `suspendre`, sous « Tout déplier », qui ne
 * rouvre ni ne retient rien ; `oublier`, sous « Tout replier », qui efface le
 * souvenir. Sans script, l'arborescence s'ouvre repliée, comme avant.
 */
export function MemoirePlis({ arbre, etat = "garder" }: { arbre: string; etat?: "garder" | "suspendre" | "oublier" }) {
  const vues = useRef(new WeakSet<Element>());
  const cle = `fp-plis-${arbre}`;
  const prefixe = `${arbre}:`;

  // Chaque rendu : les branches apparues depuis le dernier sont rouvertes si
  // elles l'étaient, une fois chacune.
  useEffect(() => {
    if (etat === "oublier") {
      try {
        sessionStorage.removeItem(cle);
      } catch {
        /* stockage refusé : rien à oublier */
      }
      return;
    }
    if (etat !== "garder") return;
    const ouvertes = lire(cle);
    for (const d of document.querySelectorAll<HTMLDetailsElement>("details[data-pli]")) {
      if (vues.current.has(d) || !d.dataset.pli?.startsWith(prefixe)) continue;
      vues.current.add(d);
      if (!d.open && ouvertes.has(d.dataset.pli)) d.open = true;
    }
  });

  // Au clic sur l'intitulé d'une branche suivie : l'état qu'elle va prendre,
  // le repli se faisant après l'événement, s'il n'est pas empêché.
  useEffect(() => {
    if (etat !== "garder") return;
    const surClic = (e: MouseEvent) => {
      if (e.defaultPrevented || !(e.target instanceof Element)) return;
      const intitule = e.target.closest("summary");
      const d = intitule?.parentElement;
      if (!(d instanceof HTMLDetailsElement) || d.querySelector(":scope > summary") !== intitule) return;
      const pli = d.dataset.pli;
      if (!pli?.startsWith(prefixe)) return;
      const ouvertes = lire(cle);
      if (d.open) ouvertes.delete(pli);
      else ouvertes.add(pli);
      try {
        sessionStorage.setItem(cle, JSON.stringify([...ouvertes]));
      } catch {
        /* stockage refusé : le repli vaut pour la page en cours */
      }
    };
    document.addEventListener("click", surClic);
    return () => document.removeEventListener("click", surClic);
  }, [cle, prefixe, etat]);

  return null;
}

function lire(cle: string): Set<string> {
  try {
    const brut = JSON.parse(sessionStorage.getItem(cle) ?? "[]");
    return new Set(Array.isArray(brut) ? brut.filter((x): x is string => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}
