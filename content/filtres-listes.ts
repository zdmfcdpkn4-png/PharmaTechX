/**
 * Ce que retient chaque liste filtrée (02/10/2026, question 91, choix a,
 * lot 3) : la lecture des paramètres de l'adresse et un prédicat par écran.
 * La page compose sa barre (`components/BarreFiltres.tsx`) et filtre avec ces
 * fonctions ; les tests lisent l'adresse de la même façon.
 *
 * Filière et niveau suivent la règle de la banque : une liste vide ne limite
 * rien. Un module du tronc commun, ou sans niveau coché, concerne donc chaque
 * filière et chaque niveau ; un code d'accès, lui, porte au plus une filière et
 * un niveau, et se retient sur eux seuls.
 */
import { correspond, lireChoix, lireJour, lireTexte, periode } from "./filtres";
import { MOTIFS_SIGNALEMENT, MOTIFS_SIGNALEMENT_FICHE } from "./signalements";

type Params = Record<string, unknown>;

/** Le profil vide ne limite rien ; sinon il faut y trouver la valeur, sans casse. */
function admet(liste: readonly string[], valeur: string): boolean {
  return !valeur || liste.length === 0 || liste.some((x) => x.toUpperCase() === valeur.toUpperCase());
}

// ──────────────────────────────────────────────────────────── codes d'accès

export const ROLES_CODE = ["poste", "tuteur", "admin"] as const;
export const ETATS_CODE = [
  { valeur: "actif", libelle: "Actifs" },
  { valeur: "revoque", libelle: "Révoqués" },
] as const;
/** Codes sans programme à la carte. */
export const SANS_PROGRAMME = "aucun";

export interface FiltreCodes {
  q: string;
  profil: string;
  etat: string;
  filiere: string;
  niveau: string;
  programme: string;
}

export function lireFiltreCodes(
  p: Params,
  ref: { filieres: readonly string[]; niveaux: readonly string[]; programmes: readonly number[] },
): FiltreCodes {
  return {
    q: lireTexte(p.q),
    profil: lireChoix(p.profil, ROLES_CODE),
    etat: lireChoix(p.etat, ETATS_CODE.map((x) => x.valeur)),
    filiere: lireChoix(p.filiere, ref.filieres),
    niveau: lireChoix(p.niveau, ref.niveaux),
    programme: lireChoix(p.programme, [SANS_PROGRAMME, ...ref.programmes.map(String)]),
  };
}

/** La recherche lit le libellé du profil : un code ne porte pas de nom, ni d'identifiant d'agent. */
export function codeRetenu(
  a: { role: string; libelle: string; filiere: string | null; niveau: string | null; programme_id: number | null; actif: boolean },
  f: FiltreCodes,
): boolean {
  return (
    correspond(a.libelle, f.q) &&
    (!f.profil || a.role === f.profil) &&
    (!f.etat || (f.etat === "actif") === a.actif) &&
    (!f.filiere || a.filiere === f.filiere) &&
    (!f.niveau || a.niveau === f.niveau) &&
    (!f.programme || (f.programme === SANS_PROGRAMME ? a.programme_id === null : String(a.programme_id) === f.programme))
  );
}

// ──────────────────────────────────────────────────────────────── rapports

export type EtapeRapport = "a_arbitrer" | "a_viser_tuteur" | "a_viser_pharmacien" | "clos" | "annule";
type StatutRapport = "emis" | "vise_tuteur" | "clos" | "annule";

/** Les étapes du circuit, dans son ordre. */
export const ETAPES_RAPPORT: readonly { valeur: EtapeRapport; libelle: string }[] = [
  { valeur: "a_arbitrer", libelle: "À arbitrer" },
  { valeur: "a_viser_tuteur", libelle: "À viser par le tuteur" },
  { valeur: "a_viser_pharmacien", libelle: "À viser par le pharmacien" },
  { valeur: "clos", libelle: "Clos" },
  { valeur: "annule", libelle: "Annulés" },
];

/**
 * L'étape d'un rapport : son statut et, pour un rapport émis, l'arbitrage
 * qu'il attend — score dans la bande de garde, pas encore arbitré.
 */
export function etapeRapport(r: { statut: StatutRapport; verdictBrut: string; arbitre: boolean }): EtapeRapport {
  if (r.statut === "emis") return r.verdictBrut === "indetermine" && !r.arbitre ? "a_arbitrer" : "a_viser_tuteur";
  if (r.statut === "vise_tuteur") return "a_viser_pharmacien";
  return r.statut;
}

/** Le statut en base d'une étape, que la requête filtre ; les deux premières sont des rapports émis. */
export function statutDeLEtape(e: EtapeRapport | ""): StatutRapport | undefined {
  if (!e) return undefined;
  if (e === "a_arbitrer" || e === "a_viser_tuteur") return "emis";
  if (e === "a_viser_pharmacien") return "vise_tuteur";
  return e;
}

export const VERDICTS_RAPPORT = ["acquis", "non_acquis", "non_concluant", "indetermine"] as const;

export interface FiltreRapports {
  /** Partie du numéro ou de l'identifiant d'agent. */
  q: string;
  etape: EtapeRapport | "";
  module: string;
  /** Jours de Paris, inclus. */
  du: string;
  au: string;
  verdict: string;
}

export function lireFiltreRapports(p: Params, modules: readonly string[]): FiltreRapports {
  const [du, au] = periode(lireJour(p.du), lireJour(p.au));
  return {
    q: lireTexte(p.q, 40),
    etape: lireChoix(p.etape, ETAPES_RAPPORT.map((x) => x.valeur)) as EtapeRapport | "",
    module: lireChoix(p.module, modules),
    du,
    au,
    verdict: lireChoix(p.verdict, VERDICTS_RAPPORT),
  };
}

/** Ce que la requête ne filtre pas : l'étape fine d'un rapport émis, et le verdict retenu après arbitrage. */
export function rapportRetenu(r: { etape: EtapeRapport; verdict: string }, f: FiltreRapports): boolean {
  return (!f.etape || r.etape === f.etape) && (!f.verdict || r.verdict === f.verdict);
}

// ─────────────────────────────────────────────────────────── signalements

export const ETATS_SIGNALEMENT = [
  { valeur: "ouvert", libelle: "Ouverts" },
  { valeur: "clos", libelle: "Clos (traités ou rejetés)", puce: "clos" },
] as const;
export const OBJETS_SIGNALEMENT = [
  { valeur: "question", libelle: "Une question" },
  { valeur: "fiche", libelle: "Une fiche de synthèse" },
] as const;
/** Les motifs des deux formulaires, questions puis fiches, sans doublon. */
export const MOTIFS_FILTRE: readonly string[] = [...new Set<string>([...MOTIFS_SIGNALEMENT, ...MOTIFS_SIGNALEMENT_FICHE])];

export interface FiltreSignalements {
  etat: string;
  motif: string;
  objet: string;
  module: string;
}

export function lireFiltreSignalements(p: Params, modules: readonly string[]): FiltreSignalements {
  return {
    etat: lireChoix(p.etat, ETATS_SIGNALEMENT.map((x) => x.valeur)),
    motif: lireChoix(p.motif, MOTIFS_FILTRE),
    objet: lireChoix(p.objet, OBJETS_SIGNALEMENT.map((x) => x.valeur)),
    module: lireChoix(p.module, modules),
  };
}

export function signalementRetenu(
  s: { statut: string; motif: string; depot_id: number | null; module_id: string },
  f: FiltreSignalements,
): boolean {
  return (
    (!f.etat || (f.etat === "ouvert") === (s.statut === "ouvert")) &&
    (!f.motif || s.motif === f.motif) &&
    (!f.objet || (f.objet === "fiche") === (s.depot_id !== null)) &&
    (!f.module || s.module_id === f.module)
  );
}

// ──────────────────────────────────────────────────────── modules déposés

export const STATUTS_FILTRE_MODULE = ["brouillon", "publie", "retire"] as const;

export interface FiltreModules {
  q: string;
  statut: string;
  bloc: string;
  filiere: string;
  niveau: string;
}

export function lireFiltreModules(
  p: Params,
  ref: { blocs: readonly number[]; filieres: readonly string[]; niveaux: readonly string[] },
): FiltreModules {
  return {
    q: lireTexte(p.q),
    statut: lireChoix(p.statut, STATUTS_FILTRE_MODULE),
    bloc: lireChoix(p.bloc, ref.blocs.map(String)),
    filiere: lireChoix(p.filiere, ref.filieres),
    niveau: lireChoix(p.niveau, ref.niveaux),
  };
}

/** `bloc` : celui du critère s'il y en a un, sinon celui du module ; la page le calcule. */
export function moduleDeposeRetenu(
  m: { id: string; titre: string; objectif: string; critere_id: string | null; statut: string; bloc: number | null; filieres: readonly string[]; niveaux: readonly string[] },
  f: FiltreModules,
): boolean {
  return (
    correspond(`${m.titre} ${m.objectif} ${m.critere_id ?? ""} ${m.id}`, f.q) &&
    (!f.statut || m.statut === f.statut) &&
    (!f.bloc || String(m.bloc) === f.bloc) &&
    admet(m.filieres, f.filiere) &&
    admet(m.niveaux, f.niveau)
  );
}

// ─────────────────────────────────────────────────────────────── documents

/** Rattachement : un document général, ou celui d'un module (son identifiant). */
export const DOCUMENTS_GENERAUX = "general";

export interface FiltreDocuments {
  q: string;
  nature: string;
  module: string;
  filiere: string;
  niveau: string;
}

export function lireFiltreDocuments(
  p: Params,
  ref: { natures: readonly string[]; modules: readonly string[]; filieres: readonly string[]; niveaux: readonly string[] },
): FiltreDocuments {
  return {
    q: lireTexte(p.q),
    nature: lireChoix(p.nature, ref.natures),
    module: lireChoix(p.module, [DOCUMENTS_GENERAUX, ...ref.modules]),
    filiere: lireChoix(p.filiere, ref.filieres),
    niveau: lireChoix(p.niveau, ref.niveaux),
  };
}

/**
 * Le profil d'un document général est le sien ; celui d'un document rattaché,
 * le profil de son module (`profilDuModule`) — introuvable, il ne limite rien.
 */
export function documentRetenu(
  d: { titre: string; nature: string; module_id: string | null; filieres: readonly string[]; niveaux: readonly string[] },
  f: FiltreDocuments,
  profilDuModule: (id: string) => { postes: readonly string[]; niveaux: readonly string[] } | undefined,
): boolean {
  const profil = d.module_id ? (profilDuModule(d.module_id) ?? { postes: [], niveaux: [] }) : { postes: d.filieres, niveaux: d.niveaux };
  return (
    correspond(d.titre, f.q) &&
    (!f.nature || d.nature === f.nature) &&
    (!f.module || (f.module === DOCUMENTS_GENERAUX ? d.module_id === null : d.module_id === f.module)) &&
    admet(profil.postes, f.filiere) &&
    admet(profil.niveaux, f.niveau)
  );
}

// ─────────────────────────────────────────────── personnel (lot 3b)

export interface FiltrePersonnel {
  /** Partie d'un identifiant d'agent ; le paramètre garde son nom d'avant, `agent`. */
  agent: string;
  critere: string;
  verdict: string;
}

export function lireFiltrePersonnel(p: Params, criteres: readonly string[]): FiltrePersonnel {
  return {
    agent: lireTexte(p.agent, 40),
    critere: lireChoix(p.critere, criteres),
    verdict: lireChoix(p.verdict, VERDICTS_RAPPORT),
  };
}

/**
 * Une ligne du répertoire : le dernier rapport d'un agent sur un critère.
 * `identifiant` : la recherche lue comme un identifiant (« ag 1 » vaut AG-001),
 * telle que la page la normalise.
 */
export function ligneRepertoireRetenue(
  l: { agent_identifiant: string; critere: string; verdict: string },
  f: FiltrePersonnel,
  identifiant: string,
): boolean {
  return (
    (!identifiant || l.agent_identifiant.includes(identifiant)) &&
    (!f.critere || l.critere === f.critere) &&
    (!f.verdict || l.verdict === f.verdict)
  );
}

// ──────────────────────────────────────────── programmes à la carte (lot 3b)

export const STATUTS_FILTRE_PROGRAMME = ["brouillon", "valide", "retire"] as const;

export interface FiltreProgrammes {
  q: string;
  statut: string;
}

export function lireFiltreProgrammes(p: Params): FiltreProgrammes {
  return { q: lireTexte(p.q), statut: lireChoix(p.statut, STATUTS_FILTRE_PROGRAMME) };
}

/** La recherche lit le nom, le destinataire et le motif. */
export function programmeRetenu(x: { nom: string; destinataire: string; motif: string; statut: string }, f: FiltreProgrammes): boolean {
  return correspond(`${x.nom} ${x.destinataire} ${x.motif}`, f.q) && (!f.statut || x.statut === f.statut);
}

// ──────────────────────────────────────────── mises en situation (lot 3b)

export interface FiltreSituations {
  q: string;
  module: string;
}

export function lireFiltreSituations(p: Params, modules: readonly string[]): FiltreSituations {
  return { q: lireTexte(p.q), module: lireChoix(p.module, modules) };
}

/** La recherche lit le titre et la vignette. */
export function situationRetenue(s: { titre: string; contexte: string; module_id: string }, f: FiltreSituations): boolean {
  return correspond(`${s.titre} ${s.contexte}`, f.q) && (!f.module || s.module_id === f.module);
}

// ─────────────────────────────────────── rattachement des modules (lot 3b)

export interface FiltreRattachement {
  q: string;
  bloc: string;
  filiere: string;
  niveau: string;
}

export function lireFiltreRattachement(
  p: Params,
  ref: { blocs: readonly number[]; filieres: readonly string[]; niveaux: readonly string[] },
): FiltreRattachement {
  return {
    q: lireTexte(p.q),
    bloc: lireChoix(p.bloc, ref.blocs.map(String)),
    filiere: lireChoix(p.filiere, ref.filieres),
    niveau: lireChoix(p.niveau, ref.niveaux),
  };
}

/** Un module du code, tel qu'il est réglé (filières et niveaux : le réglage s'il y en a un, sinon la fiche). */
export function moduleRegleRetenu(
  m: { critere: string; titre: string; bloc: number | null; filieres: readonly string[]; niveaux: readonly string[] },
  f: FiltreRattachement,
): boolean {
  return (
    correspond(`${m.critere} ${m.titre}`, f.q) &&
    (!f.bloc || String(m.bloc) === f.bloc) &&
    admet(m.filieres, f.filiere) &&
    admet(m.niveaux, f.niveau)
  );
}

// ───────────────────────────────────────────────── filières, niveaux (lot 3b)

export interface FiltreReferentiel {
  q: string;
  metier: string;
}

export function lireFiltreReferentiel(p: Params, metiers: readonly string[]): FiltreReferentiel {
  return { q: lireTexte(p.q), metier: lireChoix(p.metier, metiers) };
}

/** `texte` : ce que la recherche lit (libellé, code, description) ; `metier` : celui de la filière ou du niveau. */
export function entreeReferentielRetenue(e: { texte: string; metier: string }, f: FiltreReferentiel): boolean {
  return correspond(e.texte, f.q) && (!f.metier || e.metier === f.metier);
}

// ──────────────────────────────────────── Repères, programme complet (lot 3b)

export interface FiltreProgrammeComplet {
  q: string;
  bloc: string;
  /** `1` : les critères obligatoires seulement. */
  obligatoires: string;
}

export function lireFiltreProgrammeComplet(p: Params, blocs: readonly number[]): FiltreProgrammeComplet {
  return { q: lireTexte(p.q), bloc: lireChoix(p.bloc, blocs.map(String)), obligatoires: lireChoix(p.obligatoires, ["1"]) };
}

/** Un critère de la fiche, ou un module hors fiche publié (sans code, jamais obligatoire). */
export function critereProgrammeRetenu(
  c: { code: string; libelle: string; sousSection: string | null; bloc: number; obligatoire: boolean },
  f: FiltreProgrammeComplet,
): boolean {
  return (
    correspond(`${c.code} ${c.libelle} ${c.sousSection ?? ""}`, f.q) &&
    (!f.bloc || String(c.bloc) === f.bloc) &&
    (!f.obligatoires || c.obligatoire)
  );
}
