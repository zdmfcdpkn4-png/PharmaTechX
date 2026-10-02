import "server-only";
import { baseConfiguree, sql, type Role } from "./db";
import { procedureReference } from "./config";
import { lireValeurComplement, procedureEffective, type ValeurComplement } from "@/content/complements";

/**
 * Éléments à compléter, renseignés depuis Réglages › À compléter (02/10/2026) :
 * une ligne de `parametres` par élément, clé `complement:<clé du catalogue>`,
 * avec qui l'a posée et quand. Sans base, ou base injoignable, rien n'est
 * renseigné : les encadrés restent, et la procédure retombe sur Render.
 */

export interface ComplementEnregistre extends ValeurComplement {
  modifiePar: string;
  modifieLe: string;
}

const PREFIXE = "complement:";

export async function lireComplements(): Promise<Record<string, ComplementEnregistre>> {
  if (!baseConfiguree()) return {};
  try {
    const r = await sql<{ cle: string; valeur: unknown; modifie_par: string; modifie_le: string }>`
      SELECT cle, valeur, modifie_par, modifie_le::text FROM parametres WHERE starts_with(cle, ${PREFIXE})`;
    const out: Record<string, ComplementEnregistre> = {};
    for (const l of r.rows) {
      const v = lireValeurComplement(l.valeur);
      if (v) out[l.cle.slice(PREFIXE.length)] = { ...v, modifiePar: l.modifie_par, modifieLe: l.modifie_le };
    }
    return out;
  } catch {
    return {};
  }
}

/** Pose ou efface un élément ; une valeur vide efface, et l'encadré revient. */
export async function enregistrerComplement(
  cle: string,
  valeur: ValeurComplement | null,
  acteur: { role: Role; libelle: string },
): Promise<void> {
  const v = lireValeurComplement(valeur);
  if (!v) {
    await sql`DELETE FROM parametres WHERE cle = ${PREFIXE + cle}`;
    return;
  }
  await sql`
    INSERT INTO parametres (cle, valeur, modifie_par)
    VALUES (${PREFIXE + cle}, ${JSON.stringify(v)}::jsonb, ${`${acteur.role} · ${acteur.libelle}`})
    ON CONFLICT (cle) DO UPDATE SET valeur = EXCLUDED.valeur, modifie_par = EXCLUDED.modifie_par, modifie_le = NOW()`;
}

/** La procédure en vigueur : renseignée sur le site, sinon `PROCEDURE_HABILITATION`. */
export async function procedureEnVigueur(): Promise<string | null> {
  const renseignes = await lireComplements();
  return procedureEffective(renseignes.procedure, procedureReference());
}
