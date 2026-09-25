import "server-only";
import { baseConfiguree, sql } from "@/lib/db";
import {
  filieres as FILIERES_CODE,
  METIER_PAR_DEFAUT,
  metierOuDefaut,
  niveaux as NIVEAUX_CODE,
  type Filiere,
  type Niveau,
} from "./habilitation";
import { ordonnerNiveaux } from "./ordre-niveaux";
import { lireBareme } from "@/lib/bareme-db";

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
  /** Métier du profil de poste (question 53, choix b). */
  metierId: string;
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
  metier_id: string | null;
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
    SELECT id, libelle, description, badge, blocs, rang, actif, metier_id
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
      metierId: metierOuDefaut(l.metier_id).id,
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
  // Tous les dépôts de filières, inactifs compris, en une lecture : le retrait
  // d'une filière de la fiche ne dépend plus de l'existence d'un dépôt actif,
  // et un niveau garde le métier d'une filière désactivée.
  const [toutesFd, nd] = await Promise.all([
    listerFilieresDeposees(true).catch(() => [] as FiliereDeposee[]),
    listerNiveauxDeposes().catch(() => [] as NiveauDepose[]),
  ]);
  const fd = toutesFd.filter((f) => f.actif);
  const parId = new Map(fd.map((f) => [f.id, f]));
  // Une filière de la fiche explicitement déposée en « inactif » disparaît.
  const retires = new Set(toutesFd.filter((f) => !f.actif).map((f) => f.id));
  // Les filières de la fiche sont celles du préparateur : un dépôt qui les
  // corrige n'en change pas le métier.
  const filieres: Filiere[] = FILIERES_CODE.filter((f) => !retires.has(f.id)).map((f) => {
    const d = parId.get(f.id);
    return d
      ? { ...f, libelle: d.libelle, description: d.description, badge: d.badge || f.badge, blocs: d.blocs.length > 0 ? d.blocs : f.blocs, origine: "base" as const, metier: METIER_PAR_DEFAUT }
      : { ...f, origine: "code" as const, metier: METIER_PAR_DEFAUT };
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
      metier: d.metierId,
    });
  }
  // Un niveau porte le métier de sa filière (question 53, choix b), que
  // celle-ci soit servie ou désactivée ; la fiche reste au préparateur.
  const metierDeFiliere = new Map(toutesFd.map((f) => [f.id, f.metierId]));
  for (const f of FILIERES_CODE) metierDeFiliere.set(f.id, METIER_PAR_DEFAUT);
  const metierDuNiveau = (filiere: string) => metierDeFiliere.get(filiere) ?? METIER_PAR_DEFAUT;

  const parCode = new Map(nd.map((n) => [n.code, n]));
  const niveaux: Niveau[] = NIVEAUX_CODE.map((n) => {
    const d = parCode.get(n.code);
    return d
      ? { ...n, libelle: d.libelle, filiere: d.filiereId, condition: d.condition, prerequis: d.prerequis, origine: "base" as const, metier: metierDuNiveau(d.filiereId) }
      : { ...n, origine: "code" as const, metier: metierDuNiveau(n.filiere) };
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
      metier: metierDuNiveau(d.filiereId),
    });
  }

  // Ordre réglable par le rang, fiche comprise (tâche 66) : chaque écran qui
  // lit le référentiel reçoit les niveaux rangés par métier, puis par rang.
  const ordonnes = ordonnerNiveaux(
    niveaux,
    new Map(nd.map((n) => [n.code, n.rang])),
    NIVEAUX_CODE.map((n) => String(n.code)),
  );
  const place = new Map(ordonnes.map((n, i) => [String(n.code), i]));
  const selonPlace = (a: string, b: string) =>
    (place.get(a) ?? Number.MAX_SAFE_INTEGER) - (place.get(b) ?? Number.MAX_SAFE_INTEGER);

  // Les niveaux déposés rattachés à une filière la complètent, dans le même ordre.
  for (const f of filieres) {
    const propres = ordonnes.filter((n) => n.filiere === f.id).map((n) => n.code);
    f.niveaux = [...new Set([...f.niveaux, ...propres])].sort((a, b) => selonPlace(String(a), String(b)));
  }
  return { filieres, niveaux: ordonnes };
}

export interface FiliereListee {
  filiere: Filiere;
  /** Dépôt qui la corrige ou l'ajoute, s'il existe. */
  depot: FiliereDeposee | undefined;
  /** Filière de la fiche d'habilitation. */
  fiche: boolean;
  /** Proposée dans les listes de rattachement. */
  active: boolean;
}

/**
 * Filières servies, puis celles désactivées — fiche ou ajoutées —, pour
 * pouvoir les rouvrir (liste et page des filières, question 80, choix a).
 */
export async function toutesLesFilieres(): Promise<FiliereListee[]> {
  const [{ filieres }, deposees] = await Promise.all([
    getReferentiel(),
    listerFilieresDeposees(true).catch(() => [] as FiliereDeposee[]),
  ]);
  const depot = new Map(deposees.map((f) => [f.id, f]));
  const deLaFiche = new Set(FILIERES_CODE.map((f) => f.id));
  const servies: FiliereListee[] = filieres.map((f) => ({ filiere: f, depot: depot.get(f.id), fiche: deLaFiche.has(f.id), active: true }));
  const inactives: FiliereListee[] = deposees
    .filter((d) => !d.actif && !filieres.some((f) => f.id === d.id))
    .map((d) => {
      const code = FILIERES_CODE.find((f) => f.id === d.id);
      return {
        filiere: {
          id: d.id,
          libelle: d.libelle,
          description: d.description,
          blocs: d.blocs.length > 0 ? d.blocs : code?.blocs ?? [],
          niveaux: [],
          badge: d.badge || code?.badge || "",
          origine: "base",
          metier: code ? METIER_PAR_DEFAUT : d.metierId,
        },
        depot: d,
        fiche: Boolean(code),
        active: false,
      };
    });
  return [...servies, ...inactives];
}

/** Filières servies aux écrans (raccourci le plus courant). */
export async function listeFilieres(): Promise<Filiere[]> {
  return (await getReferentiel()).filieres;
}

/** Niveaux servis aux écrans. */
export async function listeNiveaux(): Promise<Niveau[]> {
  return (await getReferentiel()).niveaux;
}

/**
 * Identifiants qu'un rattachement peut citer : ceux de la fiche et tous ceux
 * déposés, actifs ou non. Un dépôt désactivé quitte les listes de
 * rattachement, pas les rattachements déjà posés — même règle que
 * `niveauxOrphelins`. Valider contre la fiche seule écartait en silence ce
 * que le référentiel venait d'ajouter (constaté le 23/09/2026).
 */
export async function identifiantsConnus(): Promise<{ filieres: string[]; niveaux: string[] }> {
  const [fd, nd] = await Promise.all([
    listerFilieresDeposees(true).catch(() => [] as FiliereDeposee[]),
    listerNiveauxDeposes(true).catch(() => [] as NiveauDepose[]),
  ]);
  return {
    filieres: [...new Set([...FILIERES_CODE.map((f) => f.id), ...fd.map((f) => f.id)])],
    niveaux: [...new Set([...NIVEAUX_CODE.map((n) => String(n.code)), ...nd.map((n) => n.code)])],
  };
}

/**
 * Métier d'une filière, servie ou désactivée (question 53, choix b) : c'est
 * lui qui donne son préfixe au code d'un niveau. La fiche est au préparateur.
 */
export async function metierDeLaFiliere(id: string): Promise<string> {
  if (FILIERES_CODE.some((f) => f.id === id)) return METIER_PAR_DEFAUT;
  const deposees = await listerFilieresDeposees(true).catch(() => [] as FiliereDeposee[]);
  return deposees.find((f) => f.id === id)?.metierId ?? METIER_PAR_DEFAUT;
}

export async function enregistrerFiliere(f: {
  id: string;
  libelle: string;
  description: string;
  badge: string;
  blocs: number[];
  rang: number;
  actif: boolean;
  metierId: string;
}, par: string): Promise<void> {
  await sql`
    INSERT INTO filieres_deposees (id, libelle, description, badge, blocs, rang, actif, metier_id, modifie_par)
    VALUES (${f.id}, ${f.libelle}, ${f.description}, ${f.badge},
            ${JSON.stringify(f.blocs)}::jsonb, ${f.rang}, ${f.actif}, ${f.metierId}, ${par})
    ON CONFLICT (id) DO UPDATE SET
      libelle = EXCLUDED.libelle, description = EXCLUDED.description,
      badge = EXCLUDED.badge, blocs = EXCLUDED.blocs, rang = EXCLUDED.rang,
      actif = EXCLUDED.actif, metier_id = EXCLUDED.metier_id,
      modifie_le = NOW(), modifie_par = EXCLUDED.modifie_par`;
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


// ────────────────────────────────────── Ce qui cite une filière

/**
 * Ce qui cite une filière hors des modules, lu sur sa page avant de la
 * désactiver ou de supprimer son dépôt (question 80, choix a). Les modules
 * se comptent sur la page elle-même, dans son programme.
 *
 * Rien n'est décidé ici : une filière désactivée garde tout ce qui la cite,
 * et une filière ajoutée dont on supprime le dépôt le laisse citer un
 * identifiant devenu inconnu. La liste sert à le savoir avant.
 */
export interface CitationsFiliere {
  /** Documents déposés rattachés à la filière (titre). */
  documents: string[];
  /** Codes d'accès actifs de ce profil de poste (libellé du code). */
  codes: string[];
  /** Niveaux déposés rattachés à la filière (code). */
  niveaux: string[];
  /** Ordres de profil enregistrés : niveau et parcours. */
  ordres: { niveau: string; parcours: string }[];
  /** Ordres propres à des apprenants, sur un profil de cette filière. */
  ordresApprenants: number;
  /** Questions étiquetées de ce profil, hors questions retirées. */
  questions: number;
}

export async function citationsDeLaFiliere(id: string): Promise<CitationsFiliere> {
  const vide: CitationsFiliere = { documents: [], codes: [], niveaux: [], ordres: [], ordresApprenants: 0, questions: 0 };
  if (!baseConfiguree()) return vide;
  const cite = JSON.stringify([id]);
  const [documents, codes, niveaux, ordres, apprenants, questions] = await Promise.all([
    sql<{ titre: string }>`
      SELECT titre FROM depots WHERE filieres @> ${cite}::jsonb ORDER BY titre`.catch(() => ({ rows: [] })),
    sql<{ libelle: string }>`
      SELECT libelle FROM acces WHERE actif AND filiere = ${id} ORDER BY libelle`.catch(() => ({ rows: [] })),
    sql<{ code: string }>`
      SELECT code FROM niveaux_deposes WHERE filiere_id = ${id} ORDER BY rang, code`.catch(() => ({ rows: [] })),
    sql<{ niveau: string; parcours: string }>`
      SELECT niveau, parcours FROM ordres_profil WHERE filiere_id = ${id} ORDER BY niveau, parcours`.catch(() => ({ rows: [] })),
    sql<{ n: number }>`
      SELECT COUNT(*)::int AS n FROM ordres_agent WHERE filiere_id = ${id}`.catch(() => ({ rows: [{ n: 0 }] })),
    sql<{ n: number }>`
      SELECT COUNT(*)::int AS n FROM questions
      WHERE statut <> 'retire' AND profil_filieres @> ${cite}::jsonb`.catch(() => ({ rows: [{ n: 0 }] })),
  ]);
  return {
    documents: documents.rows.map((r) => r.titre),
    codes: codes.rows.map((r) => r.libelle),
    niveaux: niveaux.rows.map((r) => r.code),
    ordres: ordres.rows,
    ordresApprenants: apprenants.rows[0]?.n ?? 0,
    questions: questions.rows[0]?.n ?? 0,
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
 * correction peut encore les citer. Utile aussi pour **renommer** un niveau,
 * qui se fait à la main (tâche 66, recommandation retenue le 23/09/2026) :
 * nouveau code ajouté, ancien dépôt supprimé, cette liste dit tout ce qui
 * citait l'ancien — codes d'accès et plafonds du barème compris.
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

  const [modules, reglages, depots, deposes, codes, bareme] = await Promise.all([
    sql<{ id: string; titre: string; niveaux: unknown }>`
      SELECT id, titre, niveaux FROM modules_deposes`.catch(() => ({ rows: [] })),
    sql<{ module_id: string; niveaux: unknown }>`
      SELECT module_id, niveaux FROM reglages_modules WHERE niveaux IS NOT NULL`.catch(() => ({ rows: [] })),
    sql<{ id: number; titre: string; niveaux: unknown }>`
      SELECT id, titre, niveaux FROM depots`.catch(() => ({ rows: [] })),
    sql<{ code: string; prerequis: unknown }>`
      SELECT code, prerequis FROM niveaux_deposes`.catch(() => ({ rows: [] })),
    // Un code d'accès ne change pas de niveau : il se remplace. Les codes
    // révoqués ne comptent pas, ils n'ouvrent plus de session.
    sql<{ libelle: string; niveau: string }>`
      SELECT libelle, niveau FROM acces WHERE actif AND niveau IS NOT NULL`.catch(() => ({ rows: [] })),
    lireBareme().catch(() => null),
  ]);

  for (const l of modules.rows) pousser("Module déposé", l.titre || l.id, inconnus(l.niveaux));
  for (const l of reglages.rows) pousser("Réglage de module", l.module_id, inconnus(l.niveaux));
  for (const l of depots.rows) pousser("Document déposé", l.titre || String(l.id), inconnus(l.niveaux));
  for (const l of deposes.rows) pousser("Prérequis d'un niveau déposé", l.code, inconnus(l.prerequis));
  for (const l of codes.rows) pousser("Code d'accès", l.libelle, inconnus([l.niveau]));
  // Un niveau cible sans plafond tombe sur « avancé » : un plafond resté sous
  // l'ancien code d'un niveau renommé laisserait le nouveau tirer sans limite.
  if (bareme) pousser("Barème, plafond par niveau cible", "barème", inconnus(Object.keys(bareme.plafonds)));
  return orphelins;
}
