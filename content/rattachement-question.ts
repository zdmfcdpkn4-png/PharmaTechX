import { admiseAuProfil, type EtiquettesProfil, type ProfilTirage } from "./tirage";

/**
 * Une question dans plusieurs blocs et plusieurs profils (question 74,
 * choix c, 24/09/2026).
 *
 * Deux moyens, cumulés :
 *  - **rattachements** : la question garde son module d'origine, où elle se
 *    modifie et se valide, et peut être « aussi posée dans » d'autres
 *    modules. Elle entre dans leur tirage et figure sous chacun dans
 *    l'arborescence ; son bloc et ses profils suivent alors ceux de ces
 *    modules. Une seule validation, un seul signalement : elle est la même
 *    question partout ;
 *  - **étiquettes** propres à la question : des blocs de compétence, qui la
 *    classent, et des filières et niveaux d'habilitation, qui limitent son
 *    tirage aux profils cochés (`admiseAuProfil`, `content/tirage.ts`) —
 *    même lecture que le réglage d'un module : une liste vide ne limite rien.
 *
 * Module pur : l'éditeur, les actions, la banque et les tests en partagent
 * les règles.
 */

/** Ce que ces règles lisent d'un module. */
export interface ModuleDeRattachement {
  id: string;
  /** Bloc de compétence du critère ; `null` : à préciser. */
  bloc: number | null;
  /** Filières du module ; vide : tronc commun, tous postes. */
  postes: readonly string[];
  /** Niveaux d'habilitation du module ; vide : tous. */
  niveaux: readonly string[];
}

/** Ce que ces règles lisent d'une question. */
export interface QuestionRattachee {
  module_id: string;
  aussi_dans: readonly string[];
  blocs: readonly number[];
  profil_filieres: readonly string[];
  profil_niveaux: readonly string[];
}

/** Numéros de blocs distincts, entiers de 1 à 99, dans l'ordre croissant ; le reste est ignoré. */
export function lireBlocs(brut: unknown): number[] {
  const liste = Array.isArray(brut) ? brut : [];
  const nombres = liste
    .map((x) => (typeof x === "string" && /^\d{1,2}$/.test(x.trim()) ? Number(x.trim()) : x))
    .filter((x): x is number => typeof x === "number" && Number.isInteger(x) && x >= 1 && x <= 99);
  return [...new Set(nombres)].sort((a, b) => a - b);
}

/** Identifiants distincts, dans l'ordre reçu, chacun d'au plus 80 caractères ; le reste est ignoré. */
export function lireIdentifiants(brut: unknown): string[] {
  const liste = Array.isArray(brut) ? brut : [];
  return [...new Set(liste.filter((x): x is string => typeof x === "string" && x.trim() !== "" && x.length <= 80).map((x) => x.trim()))];
}

/** Les étiquettes de profil d'une question ; `null` : aucune, la question est posée à tous les profils. */
export function etiquettesProfil(q: Pick<QuestionRattachee, "profil_filieres" | "profil_niveaux">): EtiquettesProfil | null {
  return q.profil_filieres.length === 0 && q.profil_niveaux.length === 0
    ? null
    : { filieres: q.profil_filieres, niveaux: q.profil_niveaux };
}

/** Modules où la question est posée : l'origine d'abord, puis ceux où elle l'est aussi, sans doublon. */
export function modulesDeLaQuestion(q: Pick<QuestionRattachee, "module_id" | "aussi_dans">): string[] {
  return [...new Set([q.module_id, ...q.aussi_dans])];
}

/**
 * Blocs de la question : ceux de ses modules — origine et rattachements —
 * et ceux de ses étiquettes, sans doublon, dans l'ordre croissant.
 */
export function blocsDeLaQuestion(q: QuestionRattachee, modules: ReadonlyMap<string, ModuleDeRattachement>): number[] {
  const desModules = modulesDeLaQuestion(q)
    .map((id) => modules.get(id)?.bloc ?? null)
    .filter((b): b is number => b !== null);
  return [...new Set([...desModules, ...q.blocs])].sort((a, b) => a - b);
}

/**
 * La question est-elle posée à ce profil ? Il faut qu'un de ses modules le
 * couvre — tronc commun ou filière cochée, tous niveaux ou niveau coché — et
 * que ses étiquettes l'admettent. Une dimension laissée `null` n'est pas
 * filtrée : « Filière » seule retient les questions posées à cette filière,
 * à quelque niveau que ce soit.
 */
export function poseeAuProfil(
  q: QuestionRattachee,
  profil: ProfilTirage,
  modules: ReadonlyMap<string, ModuleDeRattachement>,
): boolean {
  if (!admiseAuProfil(etiquettesProfil(q), profil)) return false;
  return modulesDeLaQuestion(q).some((id) => {
    const m = modules.get(id);
    if (!m) return false;
    const filiere = !profil.filiere || m.postes.length === 0 || m.postes.includes(profil.filiere);
    const niveau =
      !profil.niveau || m.niveaux.length === 0 || m.niveaux.some((n) => n.toUpperCase() === profil.niveau!.toUpperCase());
    return filiere && niveau;
  });
}

/**
 * « Chimiothérapie, Préparatoire · N1c, N2 » : les étiquettes de profil en
 * clair, libellés du référentiel quand ils existent ; vide sans étiquette.
 */
export function libelleProfils(
  e: EtiquettesProfil | null,
  filieres: readonly { id: string; libelle: string }[],
): string {
  if (!e) return "";
  const f = e.filieres.map((id) => filieres.find((x) => x.id === id)?.libelle ?? id).join(", ");
  const n = e.niveaux.join(", ");
  return [f || "toutes filières", n || "tous niveaux"].join(" · ");
}
