/**
 * Parcours d'un agent (question 103, choix a, 05/10/2026).
 *
 * Sur la fiche de l'agent (Équipe › Personnel), le tutorat ou l'administration
 * cochent, parmi les modules que son code de poste lui ouvre (question 101),
 * ceux de son parcours, les rangent, et en ferment certains. L'agent que la
 * session identifie — par le code de poste relié à son identifiant (question
 * 99), sinon par son rattachement — voit ce parcours dans cet ordre, qui reste
 * conseillé : il peut faire les modules autrement. Un module de son programme
 * que le parcours ne nomme pas ne lui est plus proposé ; un module fermé se
 * voit, grisé « Fermé par le tutorat », et ne s'ouvre pas tant que le tutorat
 * ne le rouvre pas. Le parcours passe avant l'ordre propre de l'écran Ordre
 * (question 56) et avant le programme à la carte du code ; sans parcours,
 * rien ne change.
 *
 * Module pur : testable sans base. La lecture et l'écriture sont dans
 * `content/parcours-agent-db.ts`, l'application au programme du code dans
 * `lib/programme-poste.ts`.
 */

export interface ParcoursAgent {
  /** Identifiants des modules du parcours, dans l'ordre conseillé. */
  modules: string[];
  /** Ceux d'entre eux que le tutorat tient fermés. */
  fermes: string[];
}

/**
 * Parcours relu depuis la base (deux colonnes JSON) : tout ce qui n'a pas la
 * forme attendue est écarté, un doublon ne compte qu'une fois, et un module
 * « fermé » qui n'est pas du parcours ne l'est de rien.
 */
export function lireParcours(modules: unknown, fermes: unknown): ParcoursAgent {
  const ids = Array.isArray(modules) ? modules.filter((x): x is string => typeof x === "string") : [];
  const retenus = [...new Set(ids)];
  const f = new Set(Array.isArray(fermes) ? fermes.filter((x): x is string => typeof x === "string") : []);
  return { modules: retenus, fermes: retenus.filter((id) => f.has(id)) };
}

/**
 * Parcours saisi sur la fiche : l'ordre de la liste rangée (`ordre`), gardé
 * aux seuls modules cochés (`coches`) et candidats — ceux que le code de poste
 * ouvre —, sans doublon ; un module coché que la liste omet se range à la
 * suite, dans l'ordre des candidats. Les modules fermés (`fermes`) sont pris
 * parmi ceux du parcours. Rien d'étranger n'est retenu ; vide quand rien n'est
 * coché.
 */
export function composerParcours(
  ordre: readonly unknown[],
  coches: readonly unknown[],
  fermes: readonly unknown[],
  candidats: readonly string[],
): ParcoursAgent {
  const permis = new Set(candidats);
  const choisis = new Set(coches.filter((x): x is string => typeof x === "string"));
  const vus = new Set<string>();
  const modules: string[] = [];
  for (const id of ordre) {
    if (typeof id !== "string" || !permis.has(id) || !choisis.has(id) || vus.has(id)) continue;
    vus.add(id);
    modules.push(id);
  }
  for (const id of candidats) {
    if (!choisis.has(id) || vus.has(id)) continue;
    vus.add(id);
    modules.push(id);
  }
  const aFermer = new Set(fermes.filter((x): x is string => typeof x === "string"));
  return { modules, fermes: modules.filter((id) => aFermer.has(id)) };
}

/**
 * Parcours appliqué à une liste de modules : ceux du parcours que la liste
 * contient (`presents`), dans l'ordre du parcours, et ceux qu'elle ne contient
 * plus (`absents`) — module dépublié, retiré, ou sorti du programme du code
 * depuis que le parcours a été fixé. Un module de la liste que le parcours ne
 * nomme pas n'y paraît pas.
 */
export function appliquerParcours<T extends { id: string }>(
  parcours: Pick<ParcoursAgent, "modules">,
  liste: readonly T[],
): { presents: T[]; absents: string[] } {
  const parId = new Map(liste.map((m) => [m.id, m]));
  const presents: T[] = [];
  const absents: string[] = [];
  for (const id of parcours.modules) {
    const m = parId.get(id);
    if (m) presents.push(m);
    else absents.push(id);
  }
  return { presents, absents };
}

/** Ce que le parcours fait du programme d'un code de poste (`lib/programme-poste.ts`). */
export interface ParcoursApplique<T extends { id: string }> {
  /** Modules du parcours encore au programme du code, dans l'ordre conseillé. */
  modules: T[];
  ids: Set<string>;
  /** Ceux que le tutorat tient fermés, parmi les présents. */
  fermes: Set<string>;
  /** Ce qui s'ouvre encore : les présents qui s'ouvraient déjà, moins les fermés. */
  ouverts: Set<string>;
  /** Modules du parcours que le programme du code ne contient plus : comptés, pas devinés. */
  absents: number;
}

/**
 * Le parcours appliqué au programme d'un code : il en garde les modules qu'il
 * nomme, dans son ordre ; un module fermé par le tutorat ne s'ouvre pas, un
 * module que le programme n'ouvrait pas (sans question) ne s'ouvre pas
 * davantage. Un parcours dont aucun module n'est plus au programme laisse
 * l'agent sans module ouvert : la fiche et « Mes modules » le disent plutôt
 * que de rouvrir ce que le tutorat n'a pas choisi.
 */
export function appliquerAuProgramme<T extends { id: string }>(
  programme: { modules: readonly T[]; ouverts: ReadonlySet<string> },
  parcours: ParcoursAgent,
): ParcoursApplique<T> {
  const { presents, absents } = appliquerParcours(parcours, programme.modules);
  const ids = new Set(presents.map((m) => m.id));
  const fermes = new Set(parcours.fermes.filter((id) => ids.has(id)));
  return {
    modules: presents,
    ids,
    fermes,
    ouverts: new Set(presents.filter((m) => programme.ouverts.has(m.id) && !fermes.has(m.id)).map((m) => m.id)),
    absents: absents.length,
  };
}
