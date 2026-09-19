import type { NextConfig } from "next";

/**
 * En-têtes de sécurité (19/09/2026). Posés ici et non dans le middleware :
 * `headers()` couvre toutes les réponses, y compris les fichiers statiques
 * et `/_next/`, que le filtre de session ne regarde pas.
 *
 * `frame-ancestors 'self'` interdit à un autre site d'enfermer une page dans
 * une iframe — c'est le détournement de clic : une page hostile superpose la
 * nôtre, rendue invisible, sous ses propres boutons, et le clic de
 * l'utilisateur part sur la nôtre (révoquer un code, viser un rapport).
 *
 * `'self'` et non `'none'` : la fin de test affiche les documents de synthèse
 * PDF dans une iframe de même origine (`/api/fichiers/<id>`, voir
 * `components/Evaluation.tsx`) ; `'none'` les refuserait. Encadrer une page du
 * site depuis le site lui-même suppose déjà d'y injecter du code, c'est-à-dire
 * une faille d'un autre ordre.
 *
 * `X-Frame-Options: SAMEORIGIN` double la mesure pour les navigateurs qui
 * ignorent `frame-ancestors` ; là où la directive est connue, elle prime et
 * l'ancien en-tête est sans effet (CSP niveau 2).
 *
 * Ce n'est pas une politique de sécurité du contenu complète : sans
 * `script-src` ni `style-src`, elle ne protège pas de l'injection de script.
 * Une telle politique demande de recenser les scripts en ligne de Next.js
 * (nonce par requête) — `[à vérifier]`, non fait à ce jour.
 */
const ENTETES_SECURITE = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // `X-Powered-By: Next.js` annonce la pile technique à qui interroge le
  // site : sans usage pour l'utilisateur, il oriente la recherche de
  // vulnérabilités publiées. Retiré de toutes les réponses. Les en-têtes du
  // mandataire de Render (`Server`, notamment) ne sont pas de notre ressort.
  poweredByHeader: false,
  // `pg` est chargé tel quel côté serveur (module natif optionnel, pas de
  // bundling). Portable Vercel (fonctions Node) et Render (processus Node).
  serverExternalPackages: ["pg"],
  // Fichiers déposés en base : jusqu'à 15 Mo par action serveur.
  experimental: {
    serverActions: { bodySizeLimit: "16mb" },
  },
  async headers() {
    return [{ source: "/:chemin*", headers: ENTETES_SECURITE }];
  },
};

export default nextConfig;
