/**
 * Règles de la barre de navigation, sans dépendance au navigateur : ce sont
 * elles qui décident quel sous-menu s'ouvre, donc elles qu'on teste.
 */

export type IdGroupe = "formation" | "reperes" | "administration" | "rgpd";

/**
 * Le groupe qui porte la page courante s'ouvre de lui-même, dans la barre
 * latérale (19/09/2026) comme dans le Menu (choix b du 23/09/2026) : une seule
 * règle, pour que les deux surfaces ouvrent le même groupe.
 */
export function groupePorteLaPage(id: IdGroupe, chemin: string): boolean {
  if (id === "administration") return chemin.startsWith("/admin");
  if (id === "reperes") return chemin.startsWith("/reperes");
  if (id === "rgpd") return chemin.startsWith("/donnees-personnelles");
  return chemin === "/" || chemin.startsWith("/module");
}

/** Chemin d'un lien, sans ancre ni paramètres. */
export function cheminDe(href: string): string {
  return href.split(/[?#]/)[0] || "/";
}

/**
 * La page courante relève-t-elle de ce lien ? Égalité, ou sous-chemin —
 * sauf pour une racine de section (`/`, `/admin`), qui sinon engloberait
 * toute la section : « Accès » (`/admin`) ouvrirait « Réglages » sur chaque
 * page d'administration.
 */
export function relevePage(
  chemin: string,
  href: string,
  racines: readonly string[] = ["/", "/admin"],
): boolean {
  const c = cheminDe(href);
  if (chemin === c) return true;
  if (racines.includes(c)) return false;
  return chemin.startsWith(`${c}/`);
}
