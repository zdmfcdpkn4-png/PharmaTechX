import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Aucune donnée n'est persistée : pas de base applicative, pas de session,
  // pas de cookie. Le contenu (modules, questions, documents) est servi
  // exclusivement côté serveur.
  reactStrictMode: true,
};

export default nextConfig;
