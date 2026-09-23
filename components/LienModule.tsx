import Link from "next/link";

/**
 * Nom d'un module, cliquable pour l'ouvrir (tâche 69, recommandation retenue
 * le 23/09/2026 : « pouvoir cliquer sur un module pour l'ouvrir »).
 *
 * `id` nul : le nom reste du texte. C'est à l'écran appelant de le décider,
 * lui seul sait si le module existe encore et s'il s'ouvre pour ce lecteur —
 * un module inconnu, retiré ou non publié mènerait l'apprenant à une page
 * introuvable. `requete` porte le programme ou le profil, comme les cartes de
 * l'accueil, pour que « Module suivant » suive le même ordre.
 */
export function LienModule({
  id,
  requete = "",
  children,
}: {
  id: string | null | undefined;
  requete?: string;
  children: React.ReactNode;
}) {
  if (!id) return <>{children}</>;
  return <Link href={`/module/${id}${requete}`}>{children}</Link>;
}
