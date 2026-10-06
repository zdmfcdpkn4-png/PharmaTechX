import { auNiveau, lireProfilDemande, type ProfilDemande } from "../content/ordres";

/**
 * Profil imposé à un code de poste (05/10/2026, demande directe : « un
 * utilisateur non tuteur et non administrateur ne doit avoir accès qu'à sa
 * progression et ses données, pas d'accès à la gestion des modules »).
 *
 * Les modules d'un poste sont ceux que le tutorat ou l'administration ont
 * donnés à son code : sa filière, son niveau, son programme à la carte. Le
 * poste ne les choisit plus — ni à l'écran (« Composer le programme », niveau
 * cible de l'évaluation), ni par l'adresse d'une page, ni par une requête
 * forgée : le serveur reprend ceux du code. Hors de ce programme, il n'ouvre
 * ni la page d'un module, ni ses documents, ni son évaluation (question 101,
 * choix b) : `lib/programme-poste.ts` en tient la liste.
 *
 * Choisissent encore leur profil : le tutorat et l'administration, qui gèrent ;
 * le mode test, où ils parcourent le site en apprenant d'un profil choisi
 * (23/09/2026) ; le site sans base, ouvert et sans code (question 13). Règles
 * pures, testées à part.
 */

export interface SessionProfil {
  role: "poste" | "tuteur" | "admin";
  filiere: string | null;
  niveau: string | null;
  essai?: unknown;
}

/** Filière et niveau portés par le code ; null quand le code n'en porte pas. */
export interface ProfilDuCode {
  filiere: string | null;
  niveau: string | null;
}

/**
 * Ouvre aussi les modules sans question : le tutorat et l'administration, qui
 * les gèrent. L'apprenant — code de poste, mode test, visiteur du site sans
 * base — n'ouvre qu'un module qui a des questions (05/10/2026, demande
 * directe) ; le mode test s'y plie, pour montrer ce que verra l'apprenant.
 */
export function accesLibre(session: Pick<SessionProfil, "role"> | null): boolean {
  return session?.role === "tuteur" || session?.role === "admin";
}

/**
 * Le module a des questions : celles du code, mises en situation comprises, et
 * celles validées en banque (`validees`, par module, rattachements compris).
 * Une question à vérifier ne compte pas : aucun tirage ne la pose.
 */
export function aDesQuestions(
  m: { id: string; questions: readonly unknown[]; misesEnSituation: readonly { questions: readonly unknown[] }[] },
  validees: Readonly<Record<string, number>>,
): boolean {
  return m.questions.length + m.misesEnSituation.reduce((n, s) => n + s.questions.length, 0) + (validees[m.id] ?? 0) > 0;
}

/**
 * Pourquoi un module est fermé à la session ; null : il s'ouvre.
 *  - `hors-programme` : hors du programme du code de poste (question 101) —
 *    et, quand le tutorat a fixé un parcours, hors de ce parcours aussi : un
 *    module qu'il y ajoute hors du périmètre du code est au programme de
 *    l'agent (06/10/2026, `lib/programme-poste.ts`) ;
 *  - `hors-parcours` : au programme, mais le parcours que le tutorat a fixé à
 *    l'agent ne le nomme pas (question 103, choix a) ;
 *  - `ferme-tutorat` : au parcours, mais le tutorat le tient fermé ;
 *  - `sans-question` : aucune question validée (05/10/2026).
 */
export type MotifFermeture = "hors-programme" | "hors-parcours" | "ferme-tutorat" | "sans-question";

/** Parcours fixé à l'agent par le tutorat (question 103, choix a) : ses modules, et ceux tenus fermés. */
export interface ParcoursDuPoste {
  ids: ReadonlySet<string>;
  fermes: ReadonlySet<string>;
}

/**
 * Fermeture d'un module pour la session. Le tutorat et l'administration ouvrent
 * tout. Un code de poste n'ouvre rien hors de son programme (question 101,
 * choix b), ni hors du parcours que le tutorat a fixé à l'agent, ni un module
 * que le tutorat tient fermé (question 103, choix a) ; tout apprenant — code
 * de poste, mode test, site sans base — n'ouvre qu'un module qui a des
 * questions (05/10/2026). `auProgramme` et `auParcours` valent vrai pour qui
 * n'a ni programme imposé ni parcours.
 */
export function motifFermeture(o: {
  libre: boolean;
  auProgramme: boolean;
  nbQuestions: number;
  auParcours?: boolean;
  fermeParLeTutorat?: boolean;
}): MotifFermeture | null {
  if (o.libre) return null;
  if (!o.auProgramme) return "hors-programme";
  if (o.auParcours === false) return "hors-parcours";
  if (o.fermeParLeTutorat) return "ferme-tutorat";
  return o.nbQuestions > 0 ? null : "sans-question";
}

/** Même règle, pour une route : le programme d'un code de poste, le parcours de l'agent et les modules ouverts. */
export function refusDuPoste(
  p: { auProgramme: ReadonlySet<string>; ouverts: ReadonlySet<string>; parcours?: ParcoursDuPoste | null },
  moduleId: string,
): MotifFermeture | null {
  if (!p.auProgramme.has(moduleId)) return "hors-programme";
  if (p.parcours && !p.parcours.ids.has(moduleId)) return "hors-parcours";
  if (p.parcours?.fermes.has(moduleId)) return "ferme-tutorat";
  return p.ouverts.has(moduleId) ? null : "sans-question";
}

/**
 * Même règle, pour une page : le programme du code quand la session en a un
 * (`p`), sinon les seules questions du module — mode test, site sans base.
 */
export function fermetureDeLaPage(
  p: { auProgramme: ReadonlySet<string>; parcours?: ParcoursDuPoste | null } | null,
  o: { libre: boolean; moduleId: string; nbQuestions: number },
): MotifFermeture | null {
  return motifFermeture({
    libre: o.libre,
    auProgramme: p ? p.auProgramme.has(o.moduleId) : true,
    auParcours: p?.parcours ? p.parcours.ids.has(o.moduleId) : true,
    fermeParLeTutorat: p?.parcours?.fermes.has(o.moduleId) ?? false,
    nbQuestions: o.nbQuestions,
  });
}

/** Ce qu'une route répond à un module fermé, en une phrase. */
export const LIBELLES_FERMETURE: Record<MotifFermeture, string> = {
  "hors-programme": "Module hors de votre programme.",
  "hors-parcours": "Module hors de votre parcours.",
  "ferme-tutorat": "Module fermé par votre tuteur.",
  "sans-question": "Module sans question validée : il n'est pas ouvert.",
};

/** null : la session choisit son profil. Sinon, le profil que porte son code. */
export function profilImpose(session: SessionProfil | null, base: boolean): ProfilDuCode | null {
  if (!base || !session || session.role !== "poste" || session.essai) return null;
  return { filiere: session.filiere ?? null, niveau: session.niveau ?? null };
}

/**
 * Profil d'une page de module ou d'évaluation (questions 55 et 62) : celui de
 * l'adresse pour qui choisit ; pour un poste, celui du code, l'adresse ne
 * gardant que le parcours. null sans filière ou sans niveau.
 */
export function profilDeLaPage(
  impose: ProfilDuCode | null,
  sp: { parcours?: unknown; filiere?: unknown; niveau?: unknown },
): ProfilDemande | null {
  if (!impose) return lireProfilDemande(sp);
  return lireProfilDemande({ parcours: sp.parcours, filiere: impose.filiere ?? undefined, niveau: impose.niveau ?? undefined });
}

/**
 * Programme à la carte ouvert (question 50) : pour un poste, celui de son code,
 * quel que soit celui que demande l'adresse ; pour qui choisit, celui de
 * l'adresse, sinon celui du code quand aucun parcours n'est demandé.
 */
export function programmeVise(
  impose: boolean,
  demande: number | null,
  duCode: number | null,
  parcoursDemande: boolean,
): number | null {
  if (impose) return duCode;
  return demande ?? (parcoursDemande ? null : duCode);
}

/**
 * Profil du code ramené au référentiel servi, comme à l'écran du programme :
 * une filière ou un niveau que le référentiel ne connaît plus ne compte pas.
 */
export function profilConnu(p: ProfilDuCode, filieres: readonly string[], niveaux: readonly string[]): ProfilDuCode {
  return {
    filiere: p.filiere && filieres.includes(p.filiere) ? p.filiere : null,
    niveau: p.niveau && niveaux.includes(p.niveau) ? p.niveau : null,
  };
}

/**
 * Programme de fiche d'un code de poste (question 101, choix b, 05/10/2026) :
 * le socle puis la filière du code, à son niveau — tous les niveaux sans
 * niveau, le socle seul sans filière —, dans l'ordre reçu, sans doublon.
 * C'est ce que montre « Mes modules » ; hors de ce programme, un code de poste
 * n'ouvre ni la page d'un module, ni ses documents, ni son évaluation.
 */
export function modulesDuCode<T extends { id: string; niveaux: readonly string[] }>(
  programme: { troncCommun: readonly T[]; parFiliere: Record<string, readonly T[]> },
  profil: ProfilDuCode,
): T[] {
  const auNiveauDuCode = (l: readonly T[]) => (profil.niveau ? l.filter((m) => auNiveau(m, profil.niveau!)) : [...l]);
  const vus = new Set<string>();
  return [
    ...auNiveauDuCode(programme.troncCommun),
    ...auNiveauDuCode(profil.filiere ? (programme.parFiliere[profil.filiere] ?? []) : []),
  ].filter((m) => !vus.has(m.id) && Boolean(vus.add(m.id)));
}

/**
 * Document général proposé à un profil (question 10) : un document sans
 * filière ni niveau l'est à tous ; sinon il suit la filière et le niveau.
 * Même règle que l'écran du programme, appliquée au serveur pour un poste.
 */
export function documentDuProfil(
  d: { filieres: readonly string[]; niveaux: readonly string[] },
  filiere: string,
  niveau: string,
): boolean {
  return (
    (d.filieres.length === 0 || (filiere !== "" && d.filieres.includes(filiere))) &&
    (d.niveaux.length === 0 || niveau === "" || d.niveaux.includes(niveau))
  );
}

/**
 * Fichier déposé servi à un code de poste (question 101, choix b) : il faut
 * qu'un document validé le porte et soit à son programme — celui d'un module
 * ouvert, ou un document général de son profil. Un fichier qu'aucun document
 * validé ne porte ne lui est pas servi.
 */
export function fichierOuvert(
  documents: readonly { module_id: string | null; filieres: readonly string[]; niveaux: readonly string[]; statut: string }[],
  ouverts: ReadonlySet<string>,
  profil: ProfilDuCode,
): boolean {
  return documents.some(
    (d) =>
      d.statut === "valide" &&
      (d.module_id ? ouverts.has(d.module_id) : documentDuProfil(d, profil.filiere ?? "", profil.niveau ?? "")),
  );
}
