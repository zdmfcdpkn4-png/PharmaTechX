import Link from "next/link";

/**
 * L'encadré jaune d'un élément à compléter (02/10/2026). Pour
 * l'administration, il mène à son champ dans Réglages › À compléter ; pour
 * les autres profils, il reste un simple marqueur.
 */
export function ACompleter({ cle, admin, texte = "[à compléter]" }: { cle: string; admin?: boolean; texte?: string }) {
  const marque = <code className="a-preciser">{texte}</code>;
  if (!admin) return marque;
  return (
    <Link href={`/admin/complements#${cle}`} className="a-completer-lien">
      {marque}
      <span className="lecture-seule"> — renseigner</span>
    </Link>
  );
}
