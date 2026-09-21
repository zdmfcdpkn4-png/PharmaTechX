import "server-only";
import { comptesParModule, compterSignalementsOuverts } from "@/content/banque-db";
import { AUCUN_COMPTE, type ComptesAttente, type ProfilAcces } from "@/content/acces-rapide";
import { rapportsEnAttente, SANS_FILTRE, type RapportEnAttente } from "./pilotage-db";

/**
 * Compteurs de la file d'attente (paquet A, 21/09/2026).
 *
 * Tous proviennent des fonctions qui alimentent déjà les écrans
 * correspondants — `compterSignalementsOuverts()`, `comptesParModule()`,
 * `rapportsEnAttente()`. C'est la seule façon de tenir le critère 2 de
 * `docs/ACCES-RAPIDE.md` : « les compteurs égalent ceux des écrans ». Une
 * requête écrite pour l'occasion aurait divergé au premier changement de
 * règle.
 *
 * Un compteur ne doit jamais empêcher une page de s'afficher : chaque appel
 * tombe sur zéro en cas d'échec, et le panneau s'ouvre quand même.
 */

/**
 * Le verdict brut est dans la bande de garde et personne n'a tranché : c'est
 * un arbitrage, pas un visa. Même règle que `peutArbitrer` dans
 * `app/admin/rapports/[id]/page.tsx`, calculée ici sur le verdict d'émission.
 */
function attendUnArbitrage(r: RapportEnAttente): boolean {
  return r.verdict_brut === "indetermine" && !r.arbitre;
}

export async function comptesAttente(
  profil: ProfilAcces,
  conservation: boolean,
): Promise<ComptesAttente> {
  if (profil === "poste") return AUCUN_COMPTE;

  const [signalements, parModule, rapports] = await Promise.all([
    compterSignalementsOuverts().catch(() => 0),
    comptesParModule().catch(
      () => ({}) as Record<string, { valides: number; aVerifier: number; reservees: number }>,
    ),
    conservation
      ? rapportsEnAttente(SANS_FILTRE).catch((): RapportEnAttente[] => [])
      : Promise.resolve<RapportEnAttente[]>([]),
  ]);

  const questionsAVerifier = Object.values(parModule).reduce((s, c) => s + c.aVerifier, 0);

  // Un signalement ouvert sur une question du tirage verrouille visa et
  // arbitrage : ces rapports n'appellent aucun acte tant qu'il n'est pas clos.
  const libres = rapports.filter((r) => !r.verrouille);
  const verdictsAArbitrer = libres.filter(attendUnArbitrage).length;
  const visables = libres.filter(
    (r) => !attendUnArbitrage(r) && r.verdict_brut !== "non_concluant",
  );
  // Le visa du pharmacien demande un code d'administration : un tuteur ne
  // compte pas des rapports qu'il ne peut pas viser.
  const rapportsAViser = visables.filter(
    (r) => r.statut === "emis" || (profil === "admin" && r.statut === "vise_tuteur"),
  ).length;

  return { signalements, questionsAVerifier, rapportsAViser, verdictsAArbitrer };
}
