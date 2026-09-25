import type { ArbitrageRapport, ExclusionQuestion, LigneRepertoire, LigneVisa, RapportComplet } from "./rapports";
import { decider, verdictFinal, LIBELLES_COURTS_VERDICT, type Decision, type Verdict } from "./decision";

/**
 * Registre et répertoire — les fichiers de traçabilité du modèle métrologique
 * (« archive_campagne_<date>.csv », « repertoire_metrologie_<date>.csv »,
 * « campagne_<date>.json »), transposés aux rapports d'évaluation.
 *
 * CSV : séparateur « ; », guillemets doublés, fin de ligne CRLF, marque
 * d'ordre UTF-8 en tête — le format que le tableur français ouvre sans
 * assistant d'import. [à préciser] si un autre outil consomme ces fichiers.
 * Un texte qui commence comme une formule est neutralisé (`champCsv`).
 */

export const SEPARATEUR_CSV = ";";

/**
 * Début de texte qu'un tableur lirait comme une formule, blancs de tête
 * compris : `=`, `+`, `-`, `@` ou leur variante pleine chasse (page « CSV
 * Injection » de l'OWASP).
 */
const FORMULE = /^\s*[=+\-@＝＋－＠]/;

export function champCsv(v: unknown): string {
  if (v === null || v === undefined) return "";
  // Un nombre s'écrit tel quel, virgule décimale : « -1,5 » reste un nombre.
  if (typeof v === "number") return String(v).replace(".", ",");
  // Injection de formule (question 79, choix a, 25/09/2026) : motifs, titres,
  // libellés et énoncés viennent de saisies libres. Un texte qui commence comme
  // une formule est précédé d'une tabulation, dans une cellule entre guillemets :
  // la parade que l'OWASP donne pour résister à Excel même après un nouvel
  // enregistrement du fichier, où une apostrophe de tête se perd.
  const texte = String(v);
  const s = FORMULE.test(texte) ? `\t${texte}` : texte;
  return /[;"\r\n\t]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function csv(colonnes: string[], lignes: Record<string, unknown>[]): string {
  const tete = colonnes.join(SEPARATEUR_CSV);
  const corps = lignes.map((l) => colonnes.map((c) => champCsv(l[c])).join(SEPARATEUR_CSV));
  return "﻿" + [tete, ...corps].join("\r\n") + "\r\n";
}

function dateLisible(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Paris" });
}

function dateIso(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}

/** Décision d'un rapport telle qu'elle est enregistrée (exclusions fixées, sinon aucune). */
export function decisionEnregistree(r: {
  resultat: RapportComplet["resultat"];
  arbitrage: ArbitrageRapport | null;
  exclusions: ExclusionQuestion[] | null;
}): { decision: Decision; verdictFinal: Verdict } {
  const decision = decider(r.resultat.detail, r.resultat.seuilReussite, {
    exclues: (r.exclusions ?? []).map((e) => e.questionId),
    minQuestions: r.resultat.minQuestions,
    bande: r.resultat.bareme?.bande,
  });
  return { decision, verdictFinal: verdictFinal(decision, r.arbitrage) };
}

export const COLONNES_REGISTRE = [
  "numero",
  "statut",
  "emis_le",
  "agent",
  "critere",
  "module_id",
  "module_titre",
  "tirage",
  "nb_questions",
  "nb_reservees",
  "nb_exclues",
  "score",
  "seuil",
  "bande_basse",
  "bande_haute",
  "echec_eliminatoire",
  "verdict_brut",
  "verdict_final",
  "arbitrage_verdict",
  "arbitrage_motif",
  "arbitrage_profil",
  "arbitrage_le",
  "visa_apprenant_le",
  "visa_tuteur_profil",
  "visa_tuteur_le",
  "visa_pharmacien_profil",
  "visa_pharmacien_le",
  "annule_le",
  "annule_motif",
  "empreinte",
];

const STATUTS_LISIBLES: Record<string, string> = {
  emis: "émis",
  vise_tuteur: "visé tuteur",
  clos: "clos",
  annule: "annulé",
};

/** Profil de session d'un visa ou d'un arbitrage : libellé du code, sinon le rôle. */
function profil(v: { role_session: string; libelle_session: string } | null | undefined): string {
  if (!v) return "";
  return v.libelle_session || v.role_session;
}

/** Une ligne de registre par rapport — l'agent y figure par son identifiant, jamais par un nom. */
export function ligneRegistre(r: RapportComplet): Record<string, unknown> {
  const { decision, verdictFinal: vf } = decisionEnregistree(r);
  const visa = (q: LigneVisa["qualite"]) => r.visas.find((v) => v.qualite === q);
  return {
    numero: r.numero,
    statut: STATUTS_LISIBLES[r.statut] ?? r.statut,
    emis_le: dateLisible(r.emis_le),
    agent: r.agent_identifiant,
    critere: r.critere_id ?? "",
    module_id: r.module_id,
    module_titre: r.module_titre,
    tirage: r.tirage,
    nb_questions: decision.nbQuestions,
    nb_reservees: r.resultat.reservees?.posees ?? "",
    nb_exclues: decision.nbExclues,
    score: decision.score,
    seuil: decision.seuil,
    bande_basse: decision.bandeBasse,
    bande_haute: decision.bandeHaute,
    echec_eliminatoire: decision.echecEliminatoire ? "oui" : "non",
    verdict_brut: LIBELLES_COURTS_VERDICT[decision.verdictBrut],
    verdict_final: LIBELLES_COURTS_VERDICT[vf],
    arbitrage_verdict: r.arbitrage ? LIBELLES_COURTS_VERDICT[r.arbitrage.verdict] : "",
    arbitrage_motif: r.arbitrage?.motif ?? "",
    arbitrage_profil: profil(r.arbitrage),
    arbitrage_le: dateLisible(r.arbitrage?.le),
    visa_apprenant_le: dateLisible(visa("apprenant")?.signe_le),
    visa_tuteur_profil: profil(visa("tuteur")),
    visa_tuteur_le: dateLisible(visa("tuteur")?.signe_le),
    visa_pharmacien_profil: profil(visa("pharmacien")),
    visa_pharmacien_le: dateLisible(visa("pharmacien")?.signe_le),
    annule_le: dateLisible(r.annule_le),
    annule_motif: r.annule_motif ?? "",
    empreinte: r.empreinte,
  };
}

export function csvRegistre(rapports: RapportComplet[]): string {
  return csv(COLONNES_REGISTRE, rapports.map(ligneRegistre));
}

/** Nom et fonction portés à l'édition d'un rapport : jamais enregistrés, hors sceau. */
export interface EditionRapport {
  nom: string;
  qualite: string;
  le: Date;
}

/**
 * Le rapport entier, de quoi refaire la décision hors de l'outil. Le nom, s'il
 * est porté à l'édition, y figure à part, hors du contenu scellé.
 */
export function jsonArchive(r: RapportComplet, edition?: EditionRapport | null): string {
  const { decision, verdictFinal: vf } = decisionEnregistree(r);
  return JSON.stringify(
    {
      format: "formation-pharmacotechnie/rapport/2",
      numero: r.numero,
      statut: r.statut,
      emis_le: dateIso(r.emis_le),
      agent: { identifiant: r.agent_identifiant },
      edition: edition?.nom
        ? { nom: edition.nom, qualite: edition.qualite, le: edition.le.toISOString(), hors_sceau: true }
        : null,
      module: { id: r.module_id, titre: r.module_titre, critere: r.critere_id },
      tirage: r.tirage,
      empreinte: r.empreinte,
      decision: { ...decision, verdictFinal: vf },
      arbitrage: r.arbitrage,
      exclusions: r.exclusions ?? [],
      visas: r.visas.map((v) => ({
        qualite: v.qualite,
        role_session: v.role_session,
        libelle_session: v.libelle_session,
        commentaire: v.commentaire,
        empreinte: v.empreinte,
        signe_le: dateIso(v.signe_le),
        signature_incrustee: Boolean(v.signature_id),
      })),
      annulation: r.annule_le ? { le: dateIso(r.annule_le), motif: r.annule_motif } : null,
      resultat: r.resultat,
    },
    null,
    2,
  );
}

export const COLONNES_REPERTOIRE = [
  "agent",
  "agent_etat",
  "critere",
  "module_titre",
  "dernier_rapport",
  "emis_le",
  "statut",
  "score",
  "verdict_final",
  "nb_rapports",
  "nb_clos",
];

export function ligneRepertoire(l: LigneRepertoire): Record<string, unknown> {
  const { decision, verdictFinal: vf } = decisionEnregistree(l);
  return {
    agent: l.agent_identifiant,
    agent_etat: l.agent_actif ? "actif" : "clos",
    critere: l.critere,
    module_titre: l.module_titre,
    dernier_rapport: l.numero,
    emis_le: dateLisible(l.emis_le),
    statut: STATUTS_LISIBLES[l.statut] ?? l.statut,
    score: decision.score,
    verdict_final: LIBELLES_COURTS_VERDICT[vf],
    nb_rapports: l.nb_rapports,
    nb_clos: l.nb_clos,
  };
}

export function csvRepertoire(lignes: LigneRepertoire[]): string {
  return csv(COLONNES_REPERTOIRE, lignes.map(ligneRepertoire));
}

/** Nom de fichier daté, à la manière des dépôts de la console (« archive_campagne_<date> »). */
export function nomDate(prefixe: string, extension: string, date = new Date()): string {
  return `${prefixe}_${date.toISOString().slice(0, 10)}.${extension}`;
}
