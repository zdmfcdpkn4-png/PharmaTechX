import "server-only";
import { baseConfiguree, sql } from "@/lib/db";
import {
  filieres as FILIERES_CODE,
  niveaux as NIVEAUX_CODE,
  type Filiere,
  type Niveau,
} from "./habilitation";

/**
 * Référentiel : filières et niveaux, fiche versionnée **plus** dépôts en base.
 *
 * Décision du 19/09/2026 (question 38, choix b) : l'unité peut ajouter ses
 * propres filières et ses propres niveaux sans passer par une livraison de
 * code. La fiche d'habilitation (`content/habilitation.ts`) reste la
 * référence livrée ; une ligne déposée qui porte l'identifiant d'une filière
 * de la fiche la **corrige** (libellé, description, badge, blocs), une ligne
 * d'identifiant nouveau s'**ajoute**.
 *
 * Conséquence assumée, et c'est la raison du scellement : ces listes sont
 * modifiables après coup. Un rapport émis recopie donc dans son sceau les
 * libellés du moment (`ResultatEvaluation.referentiel`) ; il se relit tel
 * qu'il a été émis, même après un renommage ou un retrait.
 *
 * Un dépôt désactivé (`actif = false`) disparaît des listes de rattachement
 * sans rien effacer : les modules et les rapports qui le citent restent
 * lisibles.
 */

export interface FiliereDeposee {
  id: string;
  libelle: string;
  description: string;
  badge: string;
  blocs: number[];
  rang: number;
  actif: boolean;
}

export interface NiveauDepose {
  code: string;
  libelle: string;
  filiereId: string;
  condition: string;
  prerequis: string[];
  rang: number;
  actif: boolean;
}

interface LigneFiliere {
  id: string;
  libelle: string;
  description: string;
  badge: string;
  blocs: unknown;
  rang: number;
  actif: boolean;
}

interface LigneNiveau {
  code: string;
  libelle: string;
  filiere_id: string;
  condition: string;
  prerequis: unknown;
  rang: number;
  actif: boolean;
}

const nombres = (v: unknown): number[] =>
  Array.isArray(v) ? v.filter((x): x is number => typeof x === "number") : [];
const chaines = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

/** Identifiant technique : minuscules, chiffres et tirets, 2 à 40 caractères. */
export function normaliserIdentifiant(brut: string): string {
  return brut
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

/** Code de niveau : majuscules, chiffres et tirets, 1 à 12 caractères. */
export function normaliserCode(brut: string): string {
  return brut
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9-]+/g, "")
    .slice(0, 12);
}

export async function listerFilieresDeposees(toutes = false): Promise<FiliereDeposee[]> {
  if (!baseConfiguree()) return [];
  const r = await sql<LigneFiliere>`
    SELECT id, libelle, description, badge, blocs, rang, actif
    FROM filieres_deposees ORDER BY rang, libelle`;
  return r.rows
    .filter((l) => toutes || l.actif)
    .map((l) => ({
      id: l.id,
      libelle: l.libelle,
      description: l.description,
      badge: l.badge,
      blocs: nombres(l.blocs),
      rang: l.rang,
      actif: l.actif,
    }));
}

export async function listerNiveauxDeposes(tous = false): Promise<NiveauDepose[]> {
  if (!baseConfiguree()) return [];
  const r = await sql<LigneNiveau>`
    SELECT code, libelle, filiere_id, condition, prerequis, rang, actif
    FROM niveaux_deposes ORDER BY rang, code`;
  return r.rows
    .filter((l) => tous || l.actif)
    .map((l) => ({
      code: l.code,
      libelle: l.libelle,
      filiereId: l.filiere_id,
      condition: l.condition,
      prerequis: chaines(l.prerequis),
      rang: l.rang,
      actif: l.actif,
    }));
}

export interface Referentiel {
  filieres: Filiere[];
  niveaux: Niveau[];
}

/**
 * Listes servies aux écrans : fiche versionnée corrigée et complétée par les
 * dépôts actifs. Sans base, ce sont les listes de la fiche, inchangées.
 */
export async function getReferentiel(): Promise<Referentiel> {
  const [fd, nd] = await Promise.all([
    listerFilieresDeposees().catch(() => [] as FiliereDeposee[]),
    listerNiveauxDeposes().catch(() => [] as NiveauDepose[]),
  ]);
  const parId = new Map(fd.map((f) => [f.id, f]));
  const retires = new Set<string>();
  if (fd.length > 0) {
    // Une filière de la fiche explicitement déposée en « inactif » disparaît.
    const inactives = await listerFilieresDeposees(true)
      .then((l) => l.filter((x) => !x.actif).map((x) => x.id))
      .catch(() => []);
    for (const id of inactives) retires.add(id);
  }
  const filieres: Filiere[] = FILIERES_CODE.filter((f) => !retires.has(f.id)).map((f) => {
    const d = parId.get(f.id);
    return d
      ? { ...f, libelle: d.libelle, description: d.description, badge: d.badge || f.badge, blocs: d.blocs.length > 0 ? d.blocs : f.blocs, origine: "base" as const }
      : { ...f, origine: "code" as const };
  });
  const connues = new Set(FILIERES_CODE.map((f) => f.id));
  for (const d of fd) {
    if (connues.has(d.id)) continue;
    filieres.push({
      id: d.id,
      libelle: d.libelle,
      description: d.description,
      blocs: d.blocs,
      niveaux: [],
      badge: d.badge,
      origine: "base",
    });
  }

  const parCode = new Map(nd.map((n) => [n.code, n]));
  const niveaux: Niveau[] = NIVEAUX_CODE.map((n) => {
    const d = parCode.get(n.code);
    return d
      ? { ...n, libelle: d.libelle, filiere: d.filiereId, condition: d.condition, prerequis: d.prerequis, origine: "base" as const }
      : { ...n, origine: "code" as const };
  });
  const codesConnus = new Set(NIVEAUX_CODE.map((n) => n.code));
  for (const d of nd) {
    if (codesConnus.has(d.code)) continue;
    niveaux.push({
      code: d.code,
      libelle: d.libelle,
      filiere: d.filiereId,
      condition: d.condition,
      prerequis: d.prerequis,
      origine: "base",
    });
  }

  // Les niveaux déposés rattachés à une filière la complètent.
  for (const f of filieres) {
    const propres = niveaux.filter((n) => n.filiere === f.id).map((n) => n.code);
    f.niveaux = [...new Set([...f.niveaux, ...propres])];
  }
  return { filieres, niveaux };
}

/** Filières servies aux écrans (raccourci le plus courant). */
export async function listeFilieres(): Promise<Filiere[]> {
  return (await getReferentiel()).filieres;
}

/** Niveaux servis aux écrans. */
export async function listeNiveaux(): Promise<Niveau[]> {
  return (await getReferentiel()).niveaux;
}

export async function enregistrerFiliere(f: {
  id: string;
  libelle: string;
  description: string;
  badge: string;
  blocs: number[];
  rang: number;
  actif: boolean;
}, par: string): Promise<void> {
  await sql`
    INSERT INTO filieres_deposees (id, libelle, description, badge, blocs, rang, actif, modifie_par)
    VALUES (${f.id}, ${f.libelle}, ${f.description}, ${f.badge},
            ${JSON.stringify(f.blocs)}::jsonb, ${f.rang}, ${f.actif}, ${par})
    ON CONFLICT (id) DO UPDATE SET
      libelle = EXCLUDED.libelle, description = EXCLUDED.description,
      badge = EXCLUDED.badge, blocs = EXCLUDED.blocs, rang = EXCLUDED.rang,
      actif = EXCLUDED.actif, modifie_le = NOW(), modifie_par = EXCLUDED.modifie_par`;
}

export async function enregistrerNiveau(n: {
  code: string;
  libelle: string;
  filiereId: string;
  condition: string;
  prerequis: string[];
  rang: number;
  actif: boolean;
}, par: string): Promise<void> {
  await sql`
    INSERT INTO niveaux_deposes (code, libelle, filiere_id, condition, prerequis, rang, actif, modifie_par)
    VALUES (${n.code}, ${n.libelle}, ${n.filiereId}, ${n.condition},
            ${JSON.stringify(n.prerequis)}::jsonb, ${n.rang}, ${n.actif}, ${par})
    ON CONFLICT (code) DO UPDATE SET
      libelle = EXCLUDED.libelle, filiere_id = EXCLUDED.filiere_id,
      condition = EXCLUDED.condition, prerequis = EXCLUDED.prerequis,
      rang = EXCLUDED.rang, actif = EXCLUDED.actif,
      modifie_le = NOW(), modifie_par = EXCLUDED.modifie_par`;
}

export async function supprimerFiliereDeposee(id: string): Promise<void> {
  await sql`DELETE FROM filieres_deposees WHERE id = ${id}`;
}

export async function supprimerNiveauDepose(code: string): Promise<void> {
  await sql`DELETE FROM niveaux_deposes WHERE code = ${code}`;
}

/**
 * Sceau du référentiel pour un module : filières et niveaux qu'il porte, avec
 * leurs libellés **au moment de l'évaluation**. Recopié dans le résultat, il
 * rend le rapport indépendant des listes, qui sont modifiables ensuite.
 *
 * Une valeur qui ne figure plus au référentiel est conservée telle quelle,
 * sous son identifiant : mieux vaut un rapport qui cite « chimiotherapie »
 * qu'un rapport qui n'en parle plus.
 */
export async function referentielDuModule(m: {
  postes?: string[];
  niveaux?: readonly string[];
}): Promise<{ filieres: { id: string; libelle: string }[]; niveaux: { code: string; libelle: string; condition: string }[] }> {
  const { filieres: F, niveaux: N } = await getReferentiel().catch(() => ({
    filieres: FILIERES_CODE,
    niveaux: NIVEAUX_CODE,
  }));
  const parId = new Map(F.map((f) => [f.id, f]));
  const parCode = new Map(N.map((n) => [String(n.code), n]));
  return {
    filieres: (m.postes ?? []).map((id) => ({ id, libelle: parId.get(id)?.libelle ?? id })),
    niveaux: (m.niveaux ?? []).map((code) => {
      const n = parCode.get(String(code));
      return { code: String(code), libelle: n?.libelle ?? String(code), condition: n?.condition ?? "" };
    }),
  };
}


// ────────────────────────────────────── Rattachements devenus orphelins

/** Une ligne qui cite un code de niveau que le référentiel ne connaît plus. */
export interface NiveauOrphelin {
  /** Table d'origine, en clair. */
  origine: string;
  /** Clé de la ligne, telle qu'elle s'affiche en administration. */
  cle: string;
  /** Codes cités et introuvables. */
  codes: string[];
}

/**
 * Rattachements citant un code de niveau inconnu du référentiel servi.
 *
 * Utile après une **correction de l'échelle** : le 22/09/2026, `P1` et `P2`
 * ont disparu au profit de `N1b`, la fiche officielle ne connaissant ni
 * référent préparatoire ni ces deux codes. Une ligne déposée avant cette
 * correction peut encore les citer.
 *
 * Rien n'est supprimé sur ce constat, et c'est le point : un rattachement
 * orphelin se **signale**. L'effacer en silence ferait disparaître un
 * rattachement que quelqu'un a posé sciemment, sans qu'il l'apprenne.
 *
 * Sans base configurée, la liste est vide : il n'y a rien à orpheliner.
 */
export async function niveauxOrphelins(): Promise<NiveauOrphelin[]> {
  if (!baseConfiguree()) return [];
  const { niveaux } = await getReferentiel().catch(() => ({ niveaux: NIVEAUX_CODE }));
  const connus = new Set(niveaux.map((n) => String(n.code)));
  // Un code déposé mais désactivé reste connu : il n'orpheline pas ce qui le cite.
  for (const n of await listerNiveauxDeposes(true).catch(() => [])) connus.add(n.code);

  const inconnus = (v: unknown): string[] =>
    chaines(v).filter((code) => !connus.has(code));

  const orphelins: NiveauOrphelin[] = [];
  const pousser = (origine: string, cle: string, codes: string[]) => {
    if (codes.length > 0) orphelins.push({ origine, cle, codes });
  };

  const [modules, reglages, depots, deposes] = await Promise.all([
    sql<{ id: string; titre: string; niveaux: unknown }>`
      SELECT id, titre, niveaux FROM modules_deposes`.catch(() => ({ rows: [] })),
    sql<{ module_id: string; niveaux: unknown }>`
      SELECT module_id, niveaux FROM reglages_modules WHERE niveaux IS NOT NULL`.catch(() => ({ rows: [] })),
    sql<{ id: number; titre: string; niveaux: unknown }>`
      SELECT id, titre, niveaux FROM depots`.catch(() => ({ rows: [] })),
    sql<{ code: string; prerequis: unknown }>`
      SELECT code, prerequis FROM niveaux_deposes`.catch(() => ({ rows: [] })),
  ]);

  for (const l of modules.rows) pousser("Module déposé", l.titre || l.id, inconnus(l.niveaux));
  for (const l of reglages.rows) pousser("Réglage de module", l.module_id, inconnus(l.niveaux));
  for (const l of depots.rows) pousser("Document déposé", l.titre || String(l.id), inconnus(l.niveaux));
  for (const l of deposes.rows) pousser("Prérequis d'un niveau déposé", l.code, inconnus(l.prerequis));
  return orphelins;
}
