import "server-only";
import { baseConfiguree, sql } from "@/lib/db";
import { blocsCompetence } from "./habilitation";
import { fusionnerBlocs, type BlocDepose, type BlocServi } from "./blocs";

/**
 * Blocs de compétence : fiche versionnée **plus** dépôts en base (question 81,
 * choix a, 26/09/2026). Voir `content/blocs.ts` pour la règle de fusion.
 * Sans base, ce sont les blocs de la fiche, inchangés.
 */

export async function listerBlocsDeposes(): Promise<BlocDepose[]> {
  if (!baseConfiguree()) return [];
  const r = await sql<BlocDepose>`
    SELECT numero, titre, reference, filiere, actif FROM blocs_deposes ORDER BY numero`;
  return r.rows;
}

/** Blocs servis aux écrans : la fiche corrigée, puis les blocs ajoutés actifs. */
export async function listeBlocs(): Promise<BlocServi[]> {
  return fusionnerBlocs(blocsCompetence, await listerBlocsDeposes().catch(() => []));
}

/** Tous les blocs, ajoutés désactivés compris : l'écran des blocs, pour les rouvrir. */
export async function tousLesBlocs(): Promise<BlocServi[]> {
  return fusionnerBlocs(blocsCompetence, await listerBlocsDeposes().catch(() => []), true);
}

export async function enregistrerBloc(b: BlocDepose, par: string): Promise<void> {
  await sql`
    INSERT INTO blocs_deposes (numero, titre, reference, filiere, actif, modifie_par)
    VALUES (${b.numero}, ${b.titre}, ${b.reference}, ${b.filiere}, ${b.actif}, ${par})
    ON CONFLICT (numero) DO UPDATE SET
      titre = EXCLUDED.titre, reference = EXCLUDED.reference, filiere = EXCLUDED.filiere,
      actif = EXCLUDED.actif, modifie_par = EXCLUDED.modifie_par, modifie_le = NOW()`;
}

export async function supprimerBlocDepose(numero: number): Promise<void> {
  await sql`DELETE FROM blocs_deposes WHERE numero = ${numero}`;
}

/** Modules déposés rangés dans un bloc par leur champ « bloc » (sans critère de la fiche), retirés compris. */
export async function modulesDeposesParBloc(): Promise<Record<number, { id: string; titre: string; statut: string }[]>> {
  if (!baseConfiguree()) return {};
  const r = await sql<{ id: string; titre: string; statut: string; bloc: number }>`
    SELECT id, titre, statut, bloc FROM modules_deposes
    WHERE bloc IS NOT NULL AND critere_id IS NULL
    ORDER BY titre`.catch(() => ({ rows: [] as { id: string; titre: string; statut: string; bloc: number }[] }));
  const out: Record<number, { id: string; titre: string; statut: string }[]> = {};
  for (const l of r.rows) (out[l.bloc] ??= []).push({ id: l.id, titre: l.titre, statut: l.statut });
  return out;
}
