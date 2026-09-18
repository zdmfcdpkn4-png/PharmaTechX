import "server-only";
import { baseConfiguree, sql, type Role } from "./db";
import { BAREME_DEFAUT, normaliserBareme, type Bareme } from "@/content/bareme";

/**
 * Barème en vigueur (décision du 18/09/2026, question 10) : une ligne
 * « bareme » de la table `parametres`, réglée depuis `/admin/bareme` par un
 * administrateur. Sans ligne, ou sans base, les valeurs par défaut de
 * `content/bareme.ts` s'appliquent. Chaque évaluation copie le barème lu dans
 * son résultat scellé : les rapports se relisent avec le barème de leur époque.
 */

export interface InfoBareme {
  modifie_par: string;
  modifie_le: string;
}

export async function lireBareme(): Promise<Bareme> {
  if (!baseConfiguree()) return BAREME_DEFAUT;
  try {
    const r = await sql<{ valeur: unknown }>`SELECT valeur FROM parametres WHERE cle = 'bareme'`;
    return r.rows[0] ? normaliserBareme(r.rows[0].valeur) : BAREME_DEFAUT;
  } catch {
    return BAREME_DEFAUT;
  }
}

/** Qui a réglé le barème et quand ; `null` si les valeurs par défaut s'appliquent. */
export async function infoBareme(): Promise<InfoBareme | null> {
  const r = await sql<InfoBareme>`SELECT modifie_par, modifie_le::text FROM parametres WHERE cle = 'bareme'`;
  return r.rows[0] ?? null;
}

export async function enregistrerBareme(
  brut: unknown,
  acteur: { role: Role; libelle: string },
): Promise<Bareme> {
  const bareme = normaliserBareme(brut);
  const par = `${acteur.role} · ${acteur.libelle}`;
  await sql`
    INSERT INTO parametres (cle, valeur, modifie_par)
    VALUES ('bareme', ${JSON.stringify(bareme)}::jsonb, ${par})
    ON CONFLICT (cle) DO UPDATE SET valeur = EXCLUDED.valeur, modifie_par = EXCLUDED.modifie_par, modifie_le = NOW()`;
  return bareme;
}

/** Retour aux valeurs par défaut : la ligne disparaît. */
export async function retablirBareme(): Promise<void> {
  await sql`DELETE FROM parametres WHERE cle = 'bareme'`;
}
