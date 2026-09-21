"use client";

import { useEffect, useState } from "react";

/**
 * Mode zone (paquet A, 21/09/2026).
 *
 * Le contexte d'usage réel de la tablette n'est pas un bureau : c'est une
 * zone d'atmosphère contrôlée, double gantage, visière. Le site tient déjà un
 * plancher de 44 px partout ; ce mode le porte à 52 px et le corps de texte à
 * 18 px, sans pénaliser le poste de bureau le reste du temps.
 *
 * Le réglage est écrit dans `localStorage`, sous une clé qui ne désigne
 * personne : c'est un réglage de poste, pas une préférence d'utilisateur —
 * le site ne connaît pas d'utilisateur. Tous les accès sont dans un
 * `try/catch` : le stockage peut être refusé, le mode fonctionne quand même
 * le temps de la session.
 */
const CLE = "fp-mode-zone";

export function ModeZone() {
  const [actif, setActif] = useState(false);

  // Jamais au premier rendu : le serveur ne connaît pas `localStorage`, et
  // lire ici produirait une discordance d'hydratation.
  useEffect(() => {
    try {
      if (localStorage.getItem(CLE) === "1") setActif(true);
    } catch {
      // stockage refusé : le mode reste disponible, simplement non mémorisé
    }
  }, []);

  useEffect(() => {
    const html = document.documentElement;
    if (actif) html.setAttribute("data-zone", "1");
    else html.removeAttribute("data-zone");
  }, [actif]);

  const basculer = () => {
    setActif((v) => {
      try {
        if (v) localStorage.removeItem(CLE);
        else localStorage.setItem(CLE, "1");
      } catch {
        // rien : le réglage vaut pour la session
      }
      return !v;
    });
  };

  return (
    <button
      type="button"
      className="bouton-zone"
      aria-pressed={actif}
      onClick={basculer}
      title="Cibles agrandies et texte plus grand, pour le travail ganté en zone"
    >
      Mode zone
    </button>
  );
}
