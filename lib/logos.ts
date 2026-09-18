import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";

/** Logos du rapport encodés en data URI, lus une fois depuis `public/`. */
export interface LogosRapport {
  hdv?: string;
  pharmaco?: string;
}

let cache: Promise<LogosRapport> | null = null;

/**
 * Décision du 18/09/2026 (question 20, choix c) : chaque rendu du rapport,
 * sur le site comme en dehors, incorpore les logos pour rester lisible sans
 * le site pendant toute sa durée de conservation. Un logo illisible est omis
 * du résultat, et le rendu retombe alors sur l'adresse du fichier ; la
 * lecture est alors retentée au rendu suivant.
 */
export function logosIncorpores(): Promise<LogosRapport> {
  cache ??= (async () => {
    const lire = async (nom: string): Promise<string | undefined> => {
      try {
        const octets = await readFile(path.join(process.cwd(), "public", nom));
        return `data:image/png;base64,${octets.toString("base64")}`;
      } catch {
        return undefined;
      }
    };
    const [hdv, pharmaco] = await Promise.all([lire("hdv.png"), lire("pharmaco-web.png")]);
    if (!hdv || !pharmaco) cache = null;
    return { ...(hdv ? { hdv } : {}), ...(pharmaco ? { pharmaco } : {}) };
  })();
  return cache;
}
