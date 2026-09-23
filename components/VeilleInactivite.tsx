"use client";

import { useEffect } from "react";
import { INACTIVITE_SECONDES } from "@/lib/inactivite";

/**
 * Déconnexion après quatre heures sans activité (demande du 23/09/2026,
 * `lib/inactivite.ts`). Ce composant ne ferme rien lui-même : il renseigne
 * le serveur, qui décide.
 *
 *   - Un clic, une touche, la molette, un toucher : l'activité est signalée,
 *     au plus une fois par minute ; ouvrir une page en est une. Le défilement
 *     seul n'est pas écouté : le site en produit lui-même (retour en haut de
 *     page, reprise de lecture), et celui de l'utilisateur passe par ces gestes.
 *   - Un onglet resté quatre heures sans rien de cela demande au serveur où
 *     en est la session — un autre onglet a pu l'entretenir — et, fermée, se
 *     remet à la connexion avec la page où il était. C'est ce qui ferme
 *     l'écran d'un poste laissé ouvert, sans attendre que quelqu'un y touche.
 *   - Un ordinateur sorti de veille rattrape le temps passé au tic suivant.
 *
 * Ce composant n'écrit rien dans le navigateur ; le cookie d'activité est
 * posé par le serveur, en réponse au signal.
 */

const BATTEMENT_MS = 60_000;
const TIC_MS = 30_000;
const GESTES = ["pointerdown", "keydown", "wheel", "touchstart"] as const;

export function VeilleInactivite() {
  useEffect(() => {
    const delai = INACTIVITE_SECONDES * 1000;
    let derniere = Date.now();
    let dernierBattement = 0;
    let enAttente = false;
    let partie = false;

    const quitter = (code: unknown) => {
      if (partie) return;
      partie = true;
      const params = new URLSearchParams();
      if (typeof code === "string") params.set("erreur", code);
      const suite = location.pathname + location.search;
      if (suite !== "/") params.set("suite", suite);
      const q = params.toString();
      location.assign("/connexion" + (q ? `?${q}` : ""));
    };

    /** Secondes restantes selon le serveur ; null sans réponse exploitable. */
    const appeler = async (method: "GET" | "POST"): Promise<number | null> => {
      try {
        const r = await fetch("/api/activite", { method, cache: "no-store" });
        if (r.status === 401) {
          quitter(((await r.json().catch(() => ({}))) as { code?: unknown }).code);
          return null;
        }
        if (!r.ok || r.status === 204) return null;
        const { reste } = (await r.json()) as { reste?: unknown };
        return typeof reste === "number" ? reste : null;
      } catch {
        // Réseau coupé : le tic suivant réessaie.
        return null;
      }
    };

    const battre = () => {
      enAttente = false;
      dernierBattement = Date.now();
      void appeler("POST");
    };

    const tic = () => {
      if (partie) return;
      const t = Date.now();
      if (enAttente && t - dernierBattement >= BATTEMENT_MS) battre();
      else if (t - derniere >= delai) {
        void appeler("GET").then((reste) => {
          // Encore ouverte : un autre onglet l'entretient ; on se cale sur le serveur.
          if (reste !== null) derniere = Date.now() - (delai - reste * 1000);
        });
      }
    };

    const geste = () => {
      derniere = Date.now();
      if (derniere - dernierBattement >= BATTEMENT_MS) battre();
      else enAttente = true;
    };

    const visible = () => {
      if (document.visibilityState === "visible") tic();
    };

    battre();
    const minuteur = window.setInterval(tic, TIC_MS);
    for (const g of GESTES) window.addEventListener(g, geste, { capture: true, passive: true });
    document.addEventListener("visibilitychange", visible);
    return () => {
      window.clearInterval(minuteur);
      for (const g of GESTES) window.removeEventListener(g, geste, { capture: true });
      document.removeEventListener("visibilitychange", visible);
    };
  }, []);
  return null;
}
