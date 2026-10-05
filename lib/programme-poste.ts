import "server-only";
import { cache } from "react";
import { composerProgramme, getTousModulesAvecDeposes } from "@/content/store";
import { lireProgramme, programmeDuCode } from "@/content/programmes-db";
import { modulesDuProgramme } from "@/content/programmes";
import { getReferentiel } from "@/content/referentiel-db";
import { comptesParModule } from "@/content/banque-db";
import type { Module, TypeParcours } from "@/content/types";
import { aDesQuestions, modulesDuCode, profilConnu, type ProfilDuCode } from "./profil-impose";

/**
 * Programme d'un code de poste (question 101, choix b, 05/10/2026) : ce qu'il
 * peut ouvrir. Hors de ce programme, la page d'un module, ses documents, son
 * évaluation et sa correction lui sont refusés ; le tutorat, l'administration
 * et le mode test ne sont pas concernés (`profilImpose`). Dans ce programme,
 * un module sans question lui reste fermé (05/10/2026, demande directe).
 */
export interface ProgrammePoste {
  /** Programme à la carte validé du code : il remplace la fiche (question 50). */
  idProgramme: number | null;
  /**
   * Modules du programme : ceux du programme à la carte validé du code, sinon
   * ceux de la fiche au profil du code, sur les deux parcours — l'agent choisit
   * encore entre Intégration et Maintien d'habilitation. « Mes modules » les
   * montre tous.
   */
  auProgramme: Set<string>;
  /**
   * Modules ouverts : ceux du programme qui ont au moins une question, du code
   * ou validée en banque. Les autres se voient dans « Mes modules », grisés.
   */
  ouverts: Set<string>;
  /**
   * Fiche au profil du code, par parcours, dans l'ordre de « Mes modules » :
   * le module suivant s'y prend, jamais dans une liste d'un autre niveau ou
   * d'une autre filière. Vide quand un programme à la carte la remplace.
   */
  parParcours: Record<TypeParcours, Module[]>;
  /** Filière et niveau du code, ramenés au référentiel servi : ceux des documents généraux qu'il reçoit. */
  profil: ProfilDuCode;
}

const lire = cache(async (acces: number | null, filiere: string | null, niveau: string | null): Promise<ProgrammePoste> => {
  const [{ filieres, niveaux }, idDuCode, comptes] = await Promise.all([
    getReferentiel(),
    acces ? programmeDuCode(acces).catch(() => null) : Promise.resolve(null),
    comptesParModule(),
  ]);
  const validees = Object.fromEntries(Object.entries(comptes).map(([id, c]) => [id, c.valides]));
  const lesQuestionsOuvrent = (modules: Module[]) => new Set(modules.filter((m) => aDesQuestions(m, validees)).map((m) => m.id));
  const profil = profilConnu(
    { filiere, niveau },
    filieres.filter((f) => f.id !== "socle").map((f) => f.id),
    niveaux.map((n) => String(n.code)),
  );
  const programme = idDuCode ? await lireProgramme(idDuCode).catch(() => null) : null;
  if (programme?.statut === "valide") {
    const { presents } = modulesDuProgramme(programme, await getTousModulesAvecDeposes({ publiesSeulement: true }));
    return {
      idProgramme: programme.id,
      auProgramme: new Set(presents.map((m) => m.id)),
      ouverts: lesQuestionsOuvrent(presents),
      parParcours: { integration: [], maintien: [] },
      profil,
    };
  }
  const [integration, maintien] = await Promise.all([composerProgramme("integration"), composerProgramme("maintien")]);
  const parParcours = { integration: modulesDuCode(integration, profil), maintien: modulesDuCode(maintien, profil) };
  const fiche = [...parParcours.integration, ...parParcours.maintien];
  return {
    idProgramme: null,
    auProgramme: new Set(fiche.map((m) => m.id)),
    ouverts: lesQuestionsOuvrent(fiche),
    parParcours,
    profil,
  };
});

/** Programme du code de la session ; lu une fois par requête. */
export function programmeDuPoste(session: { acces?: number | null }, impose: ProfilDuCode): Promise<ProgrammePoste> {
  return lire(session.acces ?? null, impose.filiere, impose.niveau);
}
