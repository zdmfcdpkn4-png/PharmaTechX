import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // `pg` est chargé tel quel côté serveur (module natif optionnel, pas de
  // bundling). Portable Vercel (fonctions Node) et Render (processus Node).
  serverExternalPackages: ["pg"],
  // Fichiers déposés en base : jusqu'à 15 Mo par action serveur.
  experimental: {
    serverActions: { bodySizeLimit: "16mb" },
  },
};

export default nextConfig;
