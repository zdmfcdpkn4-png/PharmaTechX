import "server-only";
import { composerProgramme, comptesQuestionsBase, getModule, getTousModulesAvecDeposes } from "@/content/store";
import { modeConservation } from "./config";
import { baseConfiguree } from "./db";
import { dernierEnCours, rattachement } from "./progression";
import type { Session } from "./auth";
import { questionsRenseignees } from "@/content/en-cours";
import { lireModuleDepose } from "@/content/modules-db";
import { getReferentiel } from "@/content/referentiel-db";
import { listerProgrammes, programmeDuCode } from "@/content/programmes-db";
import { modulesDuProgramme, type Programme } from "@/content/programmes";
import { auNiveau, chronologie, cleProfil, ordreApplicable, requeteProfil } from "@/content/ordres";
import { ordresDeLAgent, ordresDuParcours } from "@/content/ordres-db";
import type { Module } from "@/content/types";
import type { EtapeReprise } from "@/components/Reprendre";
import { badgeEffectif } from "@/content/badges";
import { accesLibre, profilImpose } from "./profil-impose";
import { programmeDuPoste } from "./programme-poste";

/**
 * Programme d'arrivée d'un poste, pour l'accueil (question 91, choix a) : le
 * même que celui sur lequel s'ouvre le programme (`app/page.tsx`) sans
 * paramètre d'adresse — le programme à la carte du code de poste, ou le socle
 * et la filière du code, au niveau du code, dans l'ordre de la fiche, du profil
 * (question 55) ou de l'apprenant rattaché (question 56). « Reprendre » et le
 * chemin de l'accueil désignent ainsi le même module. Une règle changée ici se
 * change aussi dans `app/page.tsx`, et réciproquement.
 */
export async function arriveeDuPoste(session: Session | null): Promise<{
  programme: EtapeReprise[];
  evaluation: { moduleId: string; titre: string; detail: string } | null;
  requete: string;
  /** Apprenant : seul un module qui a des questions s'ouvre et se propose (05/10/2026, demande directe). */
  questionsRequises: boolean;
}> {
  const parcours = "integration";
  const conservation = modeConservation();
  const { filieres, niveaux } = await getReferentiel();
  const [enBase, composition, ratt, valides] = await Promise.all([
    comptesQuestionsBase(),
    composerProgramme(parcours),
    conservation === "pseudonyme" ? rattachement() : Promise.resolve(null),
    baseConfiguree() ? listerProgrammes("valide").catch((): Programme[] => []) : Promise.resolve<Programme[]>([]),
  ]);
  const etape = (m: Module): EtapeReprise => ({
    id: m.id,
    titre: m.titre,
    evaluable:
      m.questions.length + m.misesEnSituation.reduce((s, x) => s + x.questions.length, 0) + (enBase[m.id] ?? 0) > 0,
    redige: m.redige,
    badge: badgeEffectif(m.badge, m.titre, m.objectif),
  });

  const questionsRequises = !accesLibre(session);
  const enCoursLu = ratt ? await dernierEnCours(ratt.agentId).catch(() => null) : null;
  // Question 101 (choix b) : une évaluation laissée en plan sur un module hors du programme du code ne se
  // reprend pas d'ici ; sa page le refuserait.
  const impose = profilImpose(session, baseConfiguree());
  const enCours =
    enCoursLu &&
    impose &&
    session &&
    !(await programmeDuPoste(session, impose).then((p) => p.ouverts.has(enCoursLu.moduleId), () => true))
      ? null
      : enCoursLu;
  const evaluation = enCours
    ? {
        moduleId: enCours.moduleId,
        titre:
          getModule(enCours.moduleId)?.titre ??
          (await lireModuleDepose(enCours.moduleId).catch(() => null))?.titre ??
          enCours.moduleId,
        detail: `${questionsRenseignees(enCours.etat)} sur ${enCours.etat.questionIds.length} questions`,
      }
    : null;

  // Programme à la carte du code de poste, s'il est validé.
  const idDuCode = session?.acces && baseConfiguree() ? await programmeDuCode(session.acces).catch(() => null) : null;
  const ouvert = idDuCode ? (valides.find((x) => x.id === idDuCode) ?? null) : null;
  if (ouvert) {
    const catalogue = await getTousModulesAvecDeposes({ publiesSeulement: true });
    return {
      programme: modulesDuProgramme(ouvert, catalogue).presents.map(etape),
      evaluation,
      requete: `?programme=${ouvert.id}`,
      questionsRequises,
    };
  }

  // Socle et filière du code, au niveau du code.
  const filiere = filieres.some((f) => f.id !== "socle" && f.id === session?.filiere) ? session!.filiere! : "";
  const niveau = niveaux.some((n) => n.code === session?.niveau) ? session!.niveau! : "";
  const auNiveauCible = (liste: Module[]) => (niveau ? liste.filter((m) => auNiveau(m, niveau)) : liste);
  const profil = [...auNiveauCible(composition.troncCommun), ...auNiveauCible(filiere ? (composition.parFiliere[filiere] ?? []) : [])];
  const cle = filiere && niveau ? cleProfil(filiere, niveau) : "";
  const [ordresProfil, ordresApprenant]: Record<string, string[]>[] =
    cle && baseConfiguree()
      ? await Promise.all([
          ordresDuParcours(parcours).catch(() => ({})),
          ratt ? ordresDeLAgent(ratt.agentId, parcours).catch(() => ({})) : Promise.resolve({}),
        ])
      : [{}, {}];
  const ordre = cle ? ordreApplicable(ordresApprenant[cle], ordresProfil[cle]) : null;
  return {
    programme: (ordre ? chronologie(profil, ordre.ordre) : profil).map(etape),
    evaluation,
    requete: ordre ? requeteProfil({ parcours, filiere, niveau }) : "",
    questionsRequises,
  };
}
