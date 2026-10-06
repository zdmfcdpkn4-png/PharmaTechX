import "server-only";
import { cache } from "react";
import { composerProgramme, getTousModulesAvecDeposes } from "@/content/store";
import { lireProgramme, programmeDuCode } from "@/content/programmes-db";
import { modulesDuProgramme } from "@/content/programmes";
import { getReferentiel } from "@/content/referentiel-db";
import { comptesParModule } from "@/content/banque-db";
import { appliquerAuProgramme } from "@/content/parcours-agent";
import { lireParcoursAgent } from "@/content/parcours-agent-db";
import type { Module, TypeParcours } from "@/content/types";
import { listerAcces, type LigneAcces } from "./db";
import { agentRelieDeLaSession } from "./auth";
import { rattachement } from "./progression";
import { aDesQuestions, modulesDuCode, profilConnu, type ProfilDuCode } from "./profil-impose";

/**
 * Programme d'un code de poste (question 101, choix b, 05/10/2026) : ce qu'il
 * peut ouvrir. Hors de ce programme, la page d'un module, ses documents, son
 * évaluation et sa correction lui sont refusés ; le tutorat, l'administration
 * et le mode test ne sont pas concernés (`profilImpose`). Dans ce programme,
 * un module sans question lui reste fermé (05/10/2026, demande directe).
 *
 * Le parcours que le tutorat fixe à l'agent (question 103, choix a) s'applique
 * par-dessus : seuls ses modules restent proposés, dans son ordre, et ceux
 * qu'il tient fermés ne s'ouvrent pas (`parcours`). Depuis le 06/10/2026, le
 * parcours fait autorité : un module publié que le tutorat y ajoute hors du
 * programme du code entre au programme de l'agent, et s'ouvre comme les autres.
 */
export interface ProgrammePoste {
  /** Programme à la carte validé du code : il remplace la fiche (question 50). */
  idProgramme: number | null;
  /**
   * Modules du programme : ceux du programme à la carte validé du code, sinon
   * ceux de la fiche au profil du code, sur les deux parcours — l'agent choisit
   * encore entre Intégration et Maintien d'habilitation. « Mes modules » les
   * montre tous. Avec un parcours : les mêmes, plus les modules que le parcours
   * ajoute hors de ce programme (06/10/2026).
   */
  auProgramme: Set<string>;
  /** Les mêmes, dans l'ordre de « Mes modules » (programme à la carte, ou intégration puis maintien), sans doublon. */
  modules: Module[];
  /**
   * Modules ouverts : ceux du programme qui ont au moins une question, du code
   * ou validée en banque. Les autres se voient dans « Mes modules », grisés.
   * Avec un parcours : ses seuls modules, moins ceux que le tutorat ferme.
   */
  ouverts: Set<string>;
  /**
   * Fiche au profil du code, par parcours, dans l'ordre de « Mes modules » :
   * le module suivant s'y prend, jamais dans une liste d'un autre niveau ou
   * d'une autre filière. Vide quand un programme à la carte la remplace. Avec
   * un parcours : ses modules, dans son ordre, sur les deux parcours.
   */
  parParcours: Record<TypeParcours, Module[]>;
  /** Filière et niveau du code, ramenés au référentiel servi : ceux des documents généraux qu'il reçoit. */
  profil: ProfilDuCode;
  /** Parcours fixé par le tutorat à l'agent que la session identifie (question 103, choix a) ; null sans parcours. */
  parcours: ParcoursPoste | null;
}

export interface ParcoursPoste {
  /** Modules du parcours encore publiés, dans l'ordre conseillé : ceux du programme du code et ceux ajoutés hors périmètre. */
  modules: Module[];
  ids: Set<string>;
  /** Ceux que le tutorat tient fermés. */
  fermes: Set<string>;
  /** Modules du parcours qui ne sont plus publiés : comptés, pas devinés. */
  absents: number;
  modifiePar: string;
  modifieLe: string;
}

/** Questions validées en banque, par module ; lu une fois par requête. */
const questionsValidees = cache(async (): Promise<Record<string, number>> => {
  const comptes = await comptesParModule();
  return Object.fromEntries(Object.entries(comptes).map(([id, c]) => [id, c.valides]));
});

const lire = cache(async (acces: number | null, filiere: string | null, niveau: string | null): Promise<ProgrammePoste> => {
  const [{ filieres, niveaux }, idDuCode, validees] = await Promise.all([
    getReferentiel(),
    acces ? programmeDuCode(acces).catch(() => null) : Promise.resolve(null),
    questionsValidees(),
  ]);
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
      modules: presents,
      ouverts: lesQuestionsOuvrent(presents),
      parParcours: { integration: [], maintien: [] },
      profil,
      parcours: null,
    };
  }
  const [integration, maintien] = await Promise.all([composerProgramme("integration"), composerProgramme("maintien")]);
  const parParcours = { integration: modulesDuCode(integration, profil), maintien: modulesDuCode(maintien, profil) };
  const vus = new Set<string>();
  const fiche = [...parParcours.integration, ...parParcours.maintien].filter((m) => !vus.has(m.id) && Boolean(vus.add(m.id)));
  return {
    idProgramme: null,
    auProgramme: new Set(fiche.map((m) => m.id)),
    modules: fiche,
    ouverts: lesQuestionsOuvrent(fiche),
    parParcours,
    profil,
    parcours: null,
  };
});

/** Programme d'un code de poste, tel que le code l'ouvre, sans parcours d'agent ; lu une fois par requête. */
export function programmeDuCodeDePoste(acces: number | null, filiere: string | null, niveau: string | null): Promise<ProgrammePoste> {
  return lire(acces, filiere, niveau);
}

/**
 * Catalogue des modules publiés — ceux du code et les déposés publiés —, et
 * ceux d'entre eux qui ont des questions : c'est là qu'un parcours prend un
 * module hors du périmètre du code (06/10/2026). Lu une fois par requête.
 */
const catalogueOuvert = cache(async (): Promise<{ modules: Module[]; ouverts: Set<string> }> => {
  const [modules, validees] = await Promise.all([getTousModulesAvecDeposes({ publiesSeulement: true }), questionsValidees()]);
  return { modules, ouverts: new Set(modules.filter((m) => aDesQuestions(m, validees)).map((m) => m.id)) };
});

/**
 * Agent que la session identifie (question 103, choix a) : celui du code de
 * poste relié à son identifiant (question 99), sinon celui du rattachement.
 * null sous un code partagé sans rattachement, et en mode test : le parcours
 * ne s'applique alors pas.
 */
const agentIdentifie = cache(async (): Promise<number | null> => {
  const relie = await agentRelieDeLaSession().catch(() => null);
  if (relie) return relie.id;
  const ratt = await rattachement().catch(() => null);
  return ratt?.agentId ?? null;
});

const avecParcours = cache(async (acces: number | null, filiere: string | null, niveau: string | null): Promise<ProgrammePoste> => {
  const base = await lire(acces, filiere, niveau);
  const agentId = await agentIdentifie();
  const enregistre = agentId ? await lireParcoursAgent(agentId).catch(() => null) : null;
  if (!enregistre || enregistre.modules.length === 0) return base;
  const applique = appliquerAuProgramme(base, enregistre, await catalogueOuvert());
  const ajoutes = applique.modules.filter((m) => applique.horsPerimetre.has(m.id));
  return {
    ...base,
    // Le parcours fait autorité (06/10/2026) : un module qu'il ajoute hors du programme du code y entre.
    auProgramme: new Set([...base.auProgramme, ...applique.ids]),
    modules: [...base.modules, ...ajoutes],
    ouverts: applique.ouverts,
    parParcours: { integration: applique.modules, maintien: applique.modules },
    parcours: {
      modules: applique.modules,
      ids: applique.ids,
      fermes: applique.fermes,
      absents: applique.absents,
      modifiePar: enregistre.modifiePar,
      modifieLe: enregistre.modifieLe,
    },
  };
});

/** Programme du code de la session, parcours de l'agent compris ; lu une fois par requête. */
export function programmeDuPoste(session: { acces?: number | null }, impose: ProfilDuCode): Promise<ProgrammePoste> {
  return avecParcours(session.acces ?? null, impose.filiere, impose.niveau);
}

/**
 * Candidats au parcours d'un agent, pour sa fiche (question 103, choix a) :
 * les modules que lui ouvrent ses codes de poste reliés et actifs (question
 * 99), dans l'ordre de « Mes modules », sans doublon — son périmètre —, puis
 * les autres modules publiés, `horsPerimetre`, que le tutorat peut ajouter au
 * besoin (06/10/2026) ; `ouverts` dit lesquels ont des questions. Sans code
 * relié, rien : le parcours se compose à partir des modules d'un code.
 */
export async function candidatsDuParcours(
  agentId: number,
): Promise<{ codes: LigneAcces[]; modules: Module[]; horsPerimetre: Module[]; ouverts: Set<string> }> {
  const codes = (await listerAcces()).filter((c) => c.role === "poste" && c.agent_id === agentId && c.actif);
  const programmes = await Promise.all(codes.map((c) => lire(c.id, c.filiere, c.niveau)));
  const vus = new Set<string>();
  const modules: Module[] = [];
  const ouverts = new Set<string>();
  for (const p of programmes) {
    for (const m of p.modules) {
      if (vus.has(m.id)) continue;
      vus.add(m.id);
      modules.push(m);
    }
    for (const id of p.ouverts) ouverts.add(id);
  }
  if (codes.length === 0) return { codes, modules, horsPerimetre: [], ouverts };
  const catalogue = await catalogueOuvert();
  for (const id of catalogue.ouverts) ouverts.add(id);
  return { codes, modules, horsPerimetre: catalogue.modules.filter((m) => !vus.has(m.id)), ouverts };
}
