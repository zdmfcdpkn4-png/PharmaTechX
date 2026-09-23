"use client";

import { useEffect } from "react";

/**
 * Ramène à la branche rouverte après un geste dans l'arborescence de la banque
 * (question 64, choix b) : la redirection d'une action serveur perd l'ancre
 * de l'adresse, et la page restait là où le formulaire l'avait laissée —
 * parfois loin de la question validée. Le focus va au titre de la branche :
 * le bouton du geste a pu disparaître (« Valider » devient « Remettre à
 * vérifier »), et le clavier ne doit pas repartir du haut de la page.
 *
 * Sans dépendances à l'effet : il suit chaque rendu de la page, donc chaque
 * geste, même deux de suite sur la même question. Sans script, la branche est
 * rouverte quand même par le serveur ; seul le défilement manque.
 */
export function RetourBranche({ ancre }: { ancre: string }) {
  useEffect(() => {
    const noeud = document.getElementById(ancre);
    if (!noeud) return;
    // Saut immédiat, malgré le défilement doux du site : on revient là où
    // l'on était, on ne parcourt pas la page depuis une position quelconque.
    noeud.scrollIntoView({ block: "start", behavior: "instant" });
    noeud.querySelector<HTMLElement>(":scope > summary")?.focus({ preventScroll: true });
  });
  return null;
}
