import "server-only";
import { compterSignalementsOuverts, totauxQuestions } from "@/content/banque-db";
import { compterFichesAVerifier } from "./fiches-db";
import { AUCUN_COMPTE, type ComptesAttente, type ProfilAcces } from "@/content/acces-rapide";
import { anciennetesQuiz, rapportsEnAttente, SANS_FILTRE, type RapportEnAttente } from "./pilotage-db";
import { quizAnciens } from "./pilotage";
import { maintien } from "@/content/habilitation";

/**
 * Compteurs de la file d'attente (paquet A, 21/09/2026).
 *
 * Tous proviennent des fonctions qui alimentent déjà les écrans
 * correspondants — `compterSignalementsOuverts()`, `totauxQuestions()`,
 * `compterFichesAVerifier()`, `rapportsEnAttente()`. C'est la seule façon de tenir le critère 2 de
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

  const [signalements, totaux, rapports, anciennetes, fichesAVerifier] = await Promise.all([
    compterSignalementsOuverts().catch(() => 0),
    // Chaque question une fois, même posée dans plusieurs modules (question 74).
    totauxQuestions().catch(() => ({ valides: 0, aVerifier: 0 })),
    conservation
      ? rapportsEnAttente(SANS_FILTRE).catch((): RapportEnAttente[] => [])
      : Promise.resolve<RapportEnAttente[]>([]),
    conservation
      ? anciennetesQuiz(SANS_FILTRE).catch(() => [])
      : Promise.resolve([]),
    compterFichesAVerifier().catch(() => 0),
  ]);

  // Questions et fiches de synthèse (question 59) : la banque montre les deux
  // sous le même filtre « à vérifier ».
  const contenusAVerifier = totaux.aVerifier + fichesAVerifier;

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

  // Question 49, choix b : un fait, pas une échéance. La périodicité est
  // celle de la fiche d'habilitation, identique sur les quatre métiers.
  const quizDepasses = quizAnciens(anciennetes, maintien.periodiciteMois).length;

  return {
    signalements,
    contenusAVerifier,
    rapportsAViser,
    verdictsAArbitrer,
    quizAnciens: quizDepasses,
  };
}
