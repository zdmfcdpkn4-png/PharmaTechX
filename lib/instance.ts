/**
 * Étiquette d'instance de la base (décision du 18/09/2026, question 23,
 * choix b).
 *
 * Une même base peut servir un site d'essai ou le site en service, et rien,
 * dans une chaîne de connexion, ne dit lequel. Une variable mal collée suffit
 * à écrire des rapports d'essai dans la base qui sert de preuve, ou à y
 * appliquer le schéma d'une version non encore mise en service — qui retire
 * des colonnes (`lib/schema.ts`, `DROP COLUMN IF EXISTS`).
 *
 * La base porte donc une étiquette (table `parametres`, clé « instance ») et
 * l'environnement déclare celle qu'il attend (`BASE_ATTENDUE`). La règle est
 * dirigée par l'étiquette inscrite, non par la présence de la variable :
 * **une base étiquetée n'est servie que par un environnement qui la
 * réclame**, faute de quoi le schéma n'est pas appliqué et la base n'est pas
 * servie. Sans étiquette et sans déclaration, rien n'est vérifié : c'est le
 * développement local, et le comportement d'avant cette version.
 *
 * L'étiquette s'inscrit toute seule, une fois, au premier accès d'un
 * environnement qui en déclare une. Elle se change ensuite à la main, en SQL
 * (mise en service : voir `docs/DEPLOIEMENT.md`).
 */

export type Etiquette = "service" | "essai";

export const ETIQUETTES: readonly Etiquette[] = ["service", "essai"];

export interface ConformiteInstance {
  ok: boolean;
  /** Étiquette à inscrire dans la base après l'application du schéma, le cas échéant. */
  aInscrire: Etiquette | null;
  /** Refus en clair : deux étiquettes, jamais la chaîne de connexion. */
  raison: string | null;
}

/** L'étiquette si elle est connue, `null` sinon (valeur vide, inconnue, autre type). */
export function etiquette(v: unknown): Etiquette | null {
  return v === "service" || v === "essai" ? v : null;
}

/** Texte brut nettoyé : une valeur d'environnement vide vaut « non déclarée ». */
function propre(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

export function conformiteInstance(declaree: unknown, inscrite: unknown): ConformiteInstance {
  const d = propre(declaree);
  const i = propre(inscrite);
  const oui = (aInscrire: Etiquette | null = null): ConformiteInstance => ({
    ok: true,
    aInscrire,
    raison: null,
  });
  const non = (raison: string): ConformiteInstance => ({ ok: false, aInscrire: null, raison });

  if (d && !etiquette(d)) {
    return non(`BASE_ATTENDUE inconnue : « ${d} » (attendu « service » ou « essai »).`);
  }
  if (!d) {
    return i
      ? non(`La base porte l'étiquette « ${i} » ; cet environnement ne déclare aucune BASE_ATTENDUE.`)
      : oui();
  }
  if (!i) return oui(d as Etiquette);
  return d === i
    ? oui()
    : non(`La base porte l'étiquette « ${i} », l'environnement attend « ${d} ».`);
}
