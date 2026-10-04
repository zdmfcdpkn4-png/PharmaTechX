import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    // .claude/ : outils des sessions Claude Code, hors du site ; leur JSX
    // n'est pas du React et se vérifie par claude plugin validate et test.
    ignores: [".next/**", "node_modules/**", "docs/**", "next-env.d.ts", "e2e/**", ".claude/**"],
  },
  {
    rules: {
      // Inter est chargée par <link> plutôt que next/font — décision de la
      // passation de design : pas de récupération au build, rendu correct si
      // Google Fonts est injoignable depuis le réseau de l'établissement.
      "@next/next/no-page-custom-font": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", destructuredArrayIgnorePattern: "^_" },
      ],
    },
  },
];

export default eslintConfig;
