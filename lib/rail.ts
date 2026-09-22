/**
 * Règles de la barre de navigation, sans dépendance au navigateur : ce sont
 * elles qui décident quel sous-menu s'ouvre, donc elles qu'on teste.
 */

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
