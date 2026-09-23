/**
 * Ordonnancement par profil de poste et niveau cible (question 55, choix a,
 * 23/09/2026).
 *
 * Un ordre se fixe pour une filière, un niveau cible et un parcours
 * (Intégration ou Maintien). Il porte sur les seuls modules du profil — le
 * socle et la filière, au niveau cible — et en fait une chronologie unique :
 * à l'accueil, le profil qui a son ordre voit ses modules numérotés 1, 2, 3…,
 * socle et filière mêlés ; « Reprendre », la barre de badges et le module
 * suivant la suivent. Un profil sans ordre propre garde l'ordre général du
 * parcours, puis celui de la fiche, regroupé par bloc.
 *
 * Un ordre enregistré ne se périme pas en silence : un module entré depuis
 * dans le profil (publié, rattaché) se range après ceux que l'ordre nomme, et
 * un module qui en est sorti n'y paraît plus.
 *
 * Module pur : testable sans base.
 */

/** Clé d'un ordre de profil, dans un parcours : « filière|niveau ». */
export function cleProfil(filiere: string, niveau: string): string {
  return `${filiere}|${niveau}`;
}

/**
 * Modules d'un profil : socle puis filière, au niveau cible, sans doublon,
 * dans l'ordre reçu — l'ordre général du parcours, puis celui de la fiche.
 */
export function modulesDuProfil<T extends { id: string; niveaux: readonly string[] }>(
  socle: readonly T[],
  filiere: readonly T[],
  niveau: string,
): T[] {
  const vus = new Set<string>();
  const retenus: T[] = [];
  for (const m of [...socle, ...filiere]) {
    if (!m.niveaux.includes(niveau) || vus.has(m.id)) continue;
    vus.add(m.id);
    retenus.push(m);
  }
  return retenus;
}

/**
 * Modules d'un profil dans son ordre propre : ceux que l'ordre enregistré
 * nomme, dans cet ordre (`ranges`), puis ceux qu'il ne nomme pas encore, dans
 * l'ordre par défaut (`nouveaux`). Un identifiant de l'ordre qui n'est plus
 * dans le profil est ignoré.
 */
export function appliquerOrdre<T extends { id: string }>(
  modules: readonly T[],
  ordre: readonly string[],
): { ranges: T[]; nouveaux: T[] } {
  const parId = new Map(modules.map((m) => [m.id, m]));
  const vus = new Set<string>();
  const ranges: T[] = [];
  for (const id of ordre) {
    const m = parId.get(id);
    if (!m || vus.has(id)) continue;
    vus.add(id);
    ranges.push(m);
  }
  return { ranges, nouveaux: modules.filter((m) => !vus.has(m.id)) };
}

/** La chronologie d'un profil qui a son ordre : les modules rangés, puis les nouveaux. */
export function chronologie<T extends { id: string }>(modules: readonly T[], ordre: readonly string[]): T[] {
  const { ranges, nouveaux } = appliquerOrdre(modules, ordre);
  return [...ranges, ...nouveaux];
}

/**
 * Ordre saisi à l'écran : les modules du profil, sans doublon, dans l'ordre
 * reçu ; un module du profil que la saisie omet se range à la suite, dans
 * l'ordre du profil. Rien d'étranger au profil n'est retenu.
 */
export function lireOrdreSaisi(saisis: readonly unknown[], profil: readonly string[]): string[] {
  const permis = new Set(profil);
  const vus = new Set<string>();
  const ordre: string[] = [];
  for (const s of saisis) {
    if (typeof s !== "string" || !permis.has(s) || vus.has(s)) continue;
    vus.add(s);
    ordre.push(s);
  }
  for (const id of profil) if (!vus.has(id)) ordre.push(id);
  return ordre;
}

/**
 * Déplacement d'un élément dans une liste, par le glisser, les flèches ou le
 * numéro saisi : `vers` est la place d'arrivée, bornée à la liste. Rend une
 * nouvelle liste ; la liste reçue ne change pas.
 */
export function deplacer<T>(liste: readonly T[], de: number, vers: number): T[] {
  const copie = [...liste];
  if (de < 0 || de >= copie.length) return copie;
  const cible = Math.max(0, Math.min(copie.length - 1, vers));
  const [element] = copie.splice(de, 1);
  copie.splice(cible, 0, element);
  return copie;
}

/** Profil demandé dans l'adresse : parcours, filière, niveau cible. */
export interface ProfilDemande {
  parcours: "integration" | "maintien";
  filiere: string;
  niveau: string;
}

/**
 * Profil porté par l'adresse d'une page (`?parcours=…&filiere=…&niveau=…`) ;
 * null s'il manque la filière ou le niveau, ou s'ils sont mal formés. Qu'un
 * ordre existe pour ce profil se vérifie en base, pas ici.
 */
export function lireProfilDemande(sp: { parcours?: unknown; filiere?: unknown; niveau?: unknown }): ProfilDemande | null {
  const filiere = typeof sp.filiere === "string" && /^[a-z0-9-]{1,40}$/.test(sp.filiere) ? sp.filiere : null;
  const niveau = typeof sp.niveau === "string" && /^[A-Za-z0-9-]{1,12}$/.test(sp.niveau) ? sp.niveau : null;
  if (!filiere || !niveau) return null;
  return { parcours: sp.parcours === "maintien" ? "maintien" : "integration", filiere, niveau };
}

/** Adresse qui garde le profil de page en page, comme `?programme=` pour un programme à la carte. */
export function requeteProfil(p: ProfilDemande): string {
  return `?parcours=${p.parcours}&filiere=${encodeURIComponent(p.filiere)}&niveau=${encodeURIComponent(p.niveau)}`;
}

/**
 * Ordre qui s'applique à un profil (question 56, choix a) : celui de
 * l'apprenant rattaché, s'il en a un pour ce profil, passe avant celui du
 * profil ; null sans l'un ni l'autre — le profil suit alors l'ordre général,
 * regroupé par bloc. `propre` dit si c'est l'ordre de l'apprenant.
 */
export function ordreApplicable(
  apprenant: readonly string[] | undefined,
  profil: readonly string[] | undefined,
): { ordre: readonly string[]; propre: boolean } | null {
  if (apprenant) return { ordre: apprenant, propre: true };
  if (profil) return { ordre: profil, propre: false };
  return null;
}
