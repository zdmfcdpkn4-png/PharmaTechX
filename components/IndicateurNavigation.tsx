"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * Retour visuel de navigation (22/09/2026, « retours visuels lors des clics
 * et du chargement »). Une page se compose sur le serveur, base comprise :
 * entre le clic et l'affichage, rien ne bougeait, et l'on recliquait. Une
 * barre fine part du haut de l'écran au clic sur un lien interne et se
 * referme quand l'adresse a changé.
 *
 * Elle ne touche pas au rendu : pas de `loading.tsx`, qui validerait la
 * navigation avant que la page soit prête et changerait ce que voient les
 * tests de bout en bout. Décorative (`aria-hidden`) : le lecteur d'écran
 * annonce déjà la nouvelle page. Garde de dix secondes si rien n'arrive.
 */
export function IndicateurNavigation() {
  const chemin = usePathname();
  const parametres = useSearchParams();
  const [etat, setEtat] = useState<"repos" | "en-cours" | "fin">("repos");
  const garde = useRef<number | null>(null);

  // L'adresse a changé : la navigation est arrivée.
  useEffect(() => {
    setEtat((e) => (e === "en-cours" ? "fin" : e));
    const t = window.setTimeout(() => setEtat((e) => (e === "fin" ? "repos" : e)), 450);
    return () => window.clearTimeout(t);
  }, [chemin, parametres]);

  useEffect(() => {
    const surClic = (e: MouseEvent) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || (a.target && a.target !== "_self") || a.hasAttribute("download")) return;
      let url: URL;
      try {
        url = new URL(a.href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      // Ancre de la même page, ou fichier servi tel quel : pas de navigation à attendre.
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      if (url.pathname.startsWith("/api/") || /\.[a-z0-9]{2,4}$/i.test(url.pathname)) return;
      setEtat("en-cours");
      if (garde.current) window.clearTimeout(garde.current);
      garde.current = window.setTimeout(() => setEtat("repos"), 10_000);
    };
    // Phase de capture : le lien de Next annule le comportement par défaut
    // avant que l'évènement ne remonte jusqu'ici.
    document.addEventListener("click", surClic, true);
    return () => {
      document.removeEventListener("click", surClic, true);
      if (garde.current) window.clearTimeout(garde.current);
    };
  }, []);

  return <div className={`indicateur-navigation indicateur-navigation--${etat}`} aria-hidden="true" />;
}
