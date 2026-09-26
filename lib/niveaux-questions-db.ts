import "server-only";
import { baseConfiguree, sql, type Role } from "./db";
import { NOMS_NIVEAUX_DEFAUT, normaliserNomsNiveaux, type NomsNiveauxQuestions } from "@/content/niveaux-questions";

/**
 * Noms des niveaux de question en vigueur (question 81, choix a,
 * 26/09/2026) : une ligne « niveaux_questions » de la table `parametres`,
 * réglée depuis `/admin/niveaux-questions`. Sans ligne, ou sans base, les
 * noms d'origine s'appliquent.
 */

export interface InfoNomsNiveaux {
  modifie_par: string;
  modifie_le: string;
}

export async function lireNomsNiveaux(): Promise<NomsNiveauxQuestions> {
  if (!baseConfiguree()) return NOMS_NIVEAUX_DEFAUT;
  try {
    const r = await sql<{ valeur: unknown }>`SELECT valeur FROM parametres WHERE cle = 'niveaux_questions'`;
    return r.rows[0] ? normaliserNomsNiveaux(r.rows[0].valeur) : NOMS_NIVEAUX_DEFAUT;
  } catch {
    return NOMS_NIVEAUX_DEFAUT;
  }
}

/** Qui a renommé les niveaux et quand ; `null` si les noms d'origine s'appliquent. */
export async function infoNomsNiveaux(): Promise<InfoNomsNiveaux | null> {
  if (!baseConfiguree()) return null;
  const r = await sql<InfoNomsNiveaux>`SELECT modifie_par, modifie_le::text FROM parametres WHERE cle = 'niveaux_questions'`;
  return r.rows[0] ?? null;
}

export async function enregistrerNomsNiveaux(
  noms: NomsNiveauxQuestions,
  acteur: { role: Role; libelle: string },
): Promise<void> {
  const par = `${acteur.role} · ${acteur.libelle}`;
  await sql`
    INSERT INTO parametres (cle, valeur, modifie_par)
    VALUES ('niveaux_questions', ${JSON.stringify(noms)}::jsonb, ${par})
    ON CONFLICT (cle) DO UPDATE SET valeur = EXCLUDED.valeur, modifie_par = EXCLUDED.modifie_par, modifie_le = NOW()`;
}

/** Retour aux noms d'origine : la ligne disparaît. */
export async function retablirNomsNiveaux(): Promise<void> {
  await sql`DELETE FROM parametres WHERE cle = 'niveaux_questions'`;
}
