/**
 * Arborescence de la banque par profil (question 64, choix b, 23/09/2026) :
 * filière, niveau d'habilitation, module, question — la couverture de la
 * banque, prolongée jusqu'aux questions. Elle s'offre à côté de la liste,
 * comme l'arborescence du quiz de Flore à côté de son diagramme.
 *
 * Un module rattaché à deux niveaux, ou à deux filières, figure sous chacun
 * avec ses questions : c'est fidèle au rattachement, et c'est le choix b. Pour
 * qu'une question validée dans une branche ne surprenne pas dans l'autre,
 * chaque branche dit sous quelles autres le module figure aussi.
 *
 * Module pur : la page et les tests en partagent le calcul. Le repli tient
 * dans l'adresse (`plis`, `ouvrir`) et dans des `<details>` : aucun script,
 * comme le reste du site.
 */

/** Ce que l'arbre lit d'un module : son rattachement et de quoi l'afficher. */
export interface ModuleRattache {
  id: string;
  titre: string;
  etiquette: string;
  /** Filières du module ; vide : tronc commun, tous postes. */
  postes: string[];
  /** Niveaux d'habilitation du module ; vide : tous les niveaux de sa filière. */
  niveaux: string[];
}

export interface BrancheModule {
  chemin: string;
  module: ModuleRattache;
  /** Les autres branches où le même module figure, « Filière › niveau ». */
  aussiSous: string[];
}

export interface BrancheNiveau {
  chemin: string;
  /** Code du niveau ; `null` : « Tous niveaux », les modules sans niveau. */
  code: string | null;
  libelle: string;
  /** Faux pour un code cité par un module mais absent du référentiel. */
  connu: boolean;
  modules: BrancheModule[];
}

export interface BrancheFiliere {
  chemin: string;
  libelle: string;
  badge?: string;
  /** Faux pour une filière citée par un module mais absente du référentiel. */
  connue: boolean;
  /** Les modules de la filière, chacun une fois, pour ses décomptes. */
  modules: ModuleRattache[];
  niveaux: BrancheNiveau[];
}

/**
 * Clé du tronc commun et de « Tous niveaux ». L'astérisque ne peut pas être un
 * identifiant de filière ni un code de niveau : aucune collision possible.
 */
export const TOUS = "*";

const TRONC_COMMUN = "Tronc commun — tous postes";
const TOUS_NIVEAUX = "Tous niveaux";

/** Segment de chemin : un identifiant qui contiendrait « / » ne casse pas le chemin. */
function segment(s: string): string {
  return encodeURIComponent(s);
}

export function cheminDe(...segments: string[]): string {
  return segments.map(segment).join("/");
}

/**
 * L'arbre complet, sans filtre : tronc commun, puis les filières du
 * référentiel dans leur ordre, puis celles qu'un module cite encore sans
 * qu'elles y soient ; dans chacune, « Tous niveaux », puis les niveaux du
 * référentiel dans leur ordre, puis les niveaux absents. Même règle que la
 * couverture de la liste (`components/ArbreBanque.tsx`), dont elle reprend
 * les rattachements : les deux vues ne se contredisent pas.
 */
export function construireArbre(
  filieres: { id: string; libelle: string; badge?: string }[],
  niveaux: { code: string; libelle: string }[],
  modules: ModuleRattache[],
): BrancheFiliere[] {
  // La filière « socle » n'est jamais un poste : ses modules sont au tronc commun.
  const retenues = filieres.filter((f) => f.id !== "socle");
  const connues = new Set(filieres.map((f) => f.id));
  const inconnues = [...new Set(modules.flatMap((m) => m.postes).filter((id) => !connues.has(id)))];
  const groupes: { cle: string; libelle: string; badge?: string; connue: boolean; modules: ModuleRattache[] }[] = [
    { cle: TOUS, libelle: TRONC_COMMUN, connue: true, modules: modules.filter((m) => m.postes.length === 0) },
    ...retenues.map((f) => ({
      cle: f.id,
      libelle: f.libelle,
      badge: f.badge,
      connue: true,
      modules: modules.filter((m) => m.postes.includes(f.id)),
    })),
    ...inconnues.map((id) => ({
      cle: id,
      libelle: `${id} — filière absente du référentiel`,
      connue: false,
      modules: modules.filter((m) => m.postes.includes(id)),
    })),
  ];

  const codesConnus = new Set(niveaux.map((n) => n.code));
  const arbre: BrancheFiliere[] = [];
  for (const g of groupes) {
    if (g.modules.length === 0) continue;
    const cheminF = cheminDe(g.cle);
    const branches: { code: string | null; libelle: string; connu: boolean; liste: ModuleRattache[] }[] = [
      { code: null, libelle: TOUS_NIVEAUX, connu: true, liste: g.modules.filter((m) => m.niveaux.length === 0) },
      // Tous les niveaux, pas ceux de la filière seule : B5-09, critère de
      // chimiothérapie de niveau N1a, était donné « absent du référentiel ».
      ...niveaux.map((n) => ({
        code: n.code,
        libelle: n.libelle,
        connu: true,
        liste: g.modules.filter((m) => m.niveaux.includes(n.code)),
      })),
      ...[...new Set(g.modules.flatMap((m) => m.niveaux).filter((c) => !codesConnus.has(c)))].map((code) => ({
        code,
        libelle: "niveau absent du référentiel",
        connu: false,
        liste: g.modules.filter((m) => m.niveaux.includes(code)),
      })),
    ];
    arbre.push({
      chemin: cheminF,
      libelle: g.libelle,
      badge: g.badge,
      connue: g.connue,
      modules: g.modules,
      niveaux: branches
        .filter((b) => b.liste.length > 0)
        .map((b) => {
          const cheminN = `${cheminF}/${segment(b.code ?? TOUS)}`;
          return {
            chemin: cheminN,
            code: b.code,
            libelle: b.libelle,
            connu: b.connu,
            modules: b.liste.map((m) => ({ chemin: `${cheminN}/${segment(m.id)}`, module: m, aussiSous: [] })),
          };
        }),
    });
  }

  // « Aussi sous » : les autres branches du même module, dans l'ordre de l'arbre.
  const branchesDe = new Map<string, { chemin: string; nom: string }[]>();
  for (const f of arbre) {
    for (const n of f.niveaux) {
      for (const bm of n.modules) {
        const liste = branchesDe.get(bm.module.id) ?? [];
        liste.push({ chemin: bm.chemin, nom: `${nomCourtFiliere(f)} › ${n.code ?? TOUS_NIVEAUX}` });
        branchesDe.set(bm.module.id, liste);
      }
    }
  }
  for (const f of arbre) {
    for (const n of f.niveaux) {
      for (const bm of n.modules) {
        bm.aussiSous = (branchesDe.get(bm.module.id) ?? []).filter((b) => b.chemin !== bm.chemin).map((b) => b.nom);
      }
    }
  }
  return arbre;
}

/** « Tronc commun » plutôt que son libellé complet, dans « Aussi sous ». */
function nomCourtFiliere(f: BrancheFiliere): string {
  return f.libelle === TRONC_COMMUN ? "Tronc commun" : f.libelle;
}

/**
 * Sous un filtre, l'arbre ne garde que les modules retenus, et les niveaux et
 * filières qui en portent encore : on voit où sont les questions cherchées,
 * pas cinquante-sept modules vides. « Aussi sous » reste celui de l'arbre
 * entier : le rattachement ne change pas avec le filtre.
 */
export function elaguer(arbre: BrancheFiliere[], garder: (moduleId: string) => boolean): BrancheFiliere[] {
  return arbre
    .map((f) => ({
      ...f,
      modules: f.modules.filter((m) => garder(m.id)),
      niveaux: f.niveaux
        .map((n) => ({ ...n, modules: n.modules.filter((bm) => garder(bm.module.id)) }))
        .filter((n) => n.modules.length > 0),
    }))
    .filter((f) => f.niveaux.length > 0);
}

/**
 * État du repli : par défaut, tout est replié (demande du 24/09/2026 ; avant,
 * les filières s'ouvraient, comme les UE du quiz de Flore) ; sous un filtre,
 * tout est ouvert jusqu'aux modules, l'arbre étant déjà réduit à ce qu'on
 * cherche. « Tout déplier » s'arrête aux modules : une question ne s'ouvre
 * qu'à la demande.
 */
export type Plis = "defaut" | "tout" | "aucun";

export function lirePlis(v: string | undefined): Plis {
  return v === "tout" || v === "aucun" ? v : "defaut";
}

/** Chemin reçu dans l'adresse ; au-delà de 600 caractères, il n'est pas lu. */
export function lireChemin(v: string | undefined): string | null {
  return v && v.length <= 600 ? v : null;
}

export interface EtatPlis {
  plis: Plis;
  /** Branche à rouvrir après un geste : elle et tous ses ancêtres. */
  ouvrir: string | null;
  filtre: boolean;
}

/** Profondeur : 1 filière, 2 niveau, 3 module, 4 question. */
export function estOuvert(chemin: string, profondeur: 1 | 2 | 3 | 4, e: EtatPlis): boolean {
  if (e.ouvrir && (e.ouvrir === chemin || e.ouvrir.startsWith(`${chemin}/`))) return true;
  if (profondeur === 4 || e.plis === "aucun") return false;
  if (e.plis === "tout") return true;
  return e.filtre;
}

/**
 * Adresse de retour sur la banque après un geste — valider, retirer,
 * modifier, supprimer : la banque seulement, jamais une autre adresse reçue
 * du formulaire ; l'ancre gardée, pour revenir à la branche ; les paramètres
 * ajoutés (`ok`, `erreur`) placés avant elle, là où le serveur les lit.
 * `null` si l'adresse reçue n'est pas celle de la banque.
 */
export function retourBanque(brut: unknown, ajouts: Record<string, string> = {}): string | null {
  if (typeof brut !== "string" || brut.length > 1200 || !/^\/admin\/questions(?:[/?#]|$)/.test(brut)) return null;
  const url = new URL(brut, "http://banque.invalid");
  for (const [cle, valeur] of Object.entries(ajouts)) url.searchParams.set(cle, valeur);
  return `${url.pathname}${url.search}${url.hash}`;
}

/**
 * Ancre d'une branche : le chemin, chaque caractère hors [A-Za-z0-9-] écrit
 * « _ » et son code. Injective, donc deux branches n'ont jamais la même ancre,
 * et sans rien que l'adresse ait à réencoder.
 */
export function ancreDe(chemin: string): string {
  return `arb-${chemin.replace(/[^A-Za-z0-9-]/g, (c) => `_${c.charCodeAt(0).toString(16)}_`)}`;
}
