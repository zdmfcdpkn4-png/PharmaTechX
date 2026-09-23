import { poser, type Legende } from "@/content/schema";
import { lireNiveauQuestion, trousDuTexte } from "@/content/types";
import type { NiveauQuestion, Reference, TypeQuestion } from "@/content/types";
import { indiceFormat, type FormatChoix } from "@/lib/import-format";

/**
 * Import de questions depuis un texte — reprise, adaptée, de l'extraction
 * « sans IA » du Lecteur QIM · QCM (SPEC §6). L'analyseur n'invente rien :
 * les verdicts viennent du corrigé écrit dans le texte, sous trois formes :
 *
 *   QCM 1. Énoncé de la question
 *   A. Proposition (V)
 *   B. Proposition (F)
 *   Réponses : A C
 *   Justification : texte affiché après correction
 *   Source : ANSM — BPP 2023 — 21/07/2023 — https://…
 *   Éliminatoire : oui
 *   Réservée à l'évaluation : oui
 *   Obligatoire : oui
 *
 * Une question de n'importe quel format peut porter une illustration, et la
 * description lue à la place de l'image (séquence et texte à trous compris
 * depuis le 23/09/2026) :
 *
 *   Image : sas-habillage.jpg
 *   Description de l'image : Sas d'habillage vu depuis l'entrée.
 *
 * Le fichier est déposé avec le texte et apparié par son nom.
 *
 * Le mot-clé QCM ou QIM fixe le format ; sans lui, un intertitre « QCM » ou
 * « QIM » seul sur sa ligne vaut pour les questions qui suivent ; sans
 * intertitre, la consigne de l'énoncé (`lib/import-format.ts`) ; sinon, le
 * format par défaut du dépôt (question 58, choix a, 23/09/2026). L'origine du
 * format est gardée : l'aperçu la montre, et le format s'y change. Une
 * question sans corrigé est importée quand même, toutes ses propositions à
 * Faux, et signalée : un tuteur tranche dans l'éditeur.
 * Toute question importée entre en base au statut « à vérifier », hors tirage
 * tant qu'un tuteur ou un administrateur ne l'a pas validée.
 *
 * Une ligne « Module : B1-05 » (code du critère, identifiant ou titre du
 * module) vaut pour les questions qui suivent, jusqu'à la suivante ; écrite
 * dans une question, sans ligne vide avant elle, elle vaut aussi pour cette
 * question (question 57, choix a). L'analyseur ne fait que la lire : le
 * module est résolu, ou proposé, par `lib/import-module.ts`.
 *
 * Schéma à compléter :
 *
 *   SCHÉMA 1. Coupe d'un isolateur : légendez les éléments repérés.
 *   Image : isolateur-coupe.png
 *   1. sas de transfert (32, 24, 14, 5)
 *   2. filtre HEPA | filtre terminal (58, 19)
 *   Justification : …
 *
 * Les quatre nombres sont le rectangle du mot imprimé sur l'image (x, y,
 * largeur, hauteur, en % de l'image) ; deux nombres posent un repère sans
 * rien masquer. Une légende sans coordonnées est posée sur le bord gauche,
 * à retoucher dans l'éditeur.
 *
 * Séquence à ordonner et texte à trous (19/09/2026) :
 *
 *   SÉQUENCE 1. Remettez les étapes de l'habillage dans l'ordre.
 *   1. Hygiène des mains
 *   2. Surchaussures
 *   3. Combinaison
 *
 *   TEXTE 1. Le sas de {1} est en dépression par rapport à la {2}.
 *   1. transfert
 *   2. zone à atmosphère contrôlée
 *   Leurres : décontamination | couloir
 *
 * Les lignes numérotées d'une séquence sont les étapes dans l'ordre juste ;
 * celles d'un texte à trous sont les vignettes attendues, dans l'ordre des
 * marques `{1}`, `{2}`… de l'énoncé. Les leurres viennent s'ajouter au menu.
 *
 * Un texte JSON est accepté : soit l'export de ce site, soit une banque au
 * schéma 3.0 du pipeline du Lecteur QIM · QCM (`items[].propositions`).
 *
 * Ce fichier est pur (aucune dépendance serveur) : il est testable tel quel.
 */

export interface OptionImportee {
  id: string;
  texte: string;
  vrai: boolean;
}

export interface QuestionImportee {
  format: TypeQuestion;
  enonce: string;
  options: OptionImportee[];
  legendes: Legende[];
  /** Nom de fichier d'image annoncé (« Image : … ») — schéma ou illustration, tout type. */
  imageNom?: string;
  /** « Description de l'image : … » — lue à la place de l'image (texte alternatif). */
  imageAlt?: string;
  /** Schéma : numéro lu dans « SCHÉMA n. », pour apparier une image par rang. */
  numeroSchema?: number;
  justification: string;
  eliminatoire: boolean;
  /** Réservée à l'évaluation (question 18) : ligne « Réservée : oui ». */
  reservee: boolean;
  /** Posée à chaque évaluation qui peut conclure (question 63) : ligne « Obligatoire : oui ». */
  obligatoire: boolean;
  /** Ligne « Niveau : initial » (ou « Difficulté : … ») ; `null` si absente ou illisible. */
  niveauQuestion: NiveauQuestion | null;
  refs: Reference[];
  /** Un corrigé complet a-t-il été lu ? */
  corrigeDetecte: boolean;
  /** Corrigé lu dans les « (V) » / « (F) » des propositions, sans ligne « Réponses ». */
  corrigeParMarqueurs?: boolean;
  /** QCM ou QIM : d'où vient le format (mot-clé, intertitre, énoncé, défaut du dépôt). */
  origineFormat?: OrigineFormat;
  /** Valeur de la ligne « Module : » qui vaut pour cette question, telle qu'écrite. */
  moduleLigne?: string;
  /**
   * Ce que l'analyseur n'a pas pu trancher, en clair. Les avertissements qui
   * dépendent du format n'y sont pas : l'aperçu les recalcule
   * (`alertesFormat`), le format pouvant y être changé.
   */
  avertissements: string[];
}

export type OrigineFormat = "mot-cle" | "intertitre" | "enonce" | "defaut";

export interface ResultatImport {
  questions: QuestionImportee[];
  avertissements: string[];
}

export interface OptionsImport {
  formatDefaut: "QCM" | "QIM";
}

export const MAX_QUESTIONS_IMPORT = 120;

const LETTRES = "ABCDE";
/** Identifiant d'un élément de séquence ou de vignette : a, b, c… puis o13, o14… */
function cleElement(i: number): string {
  return "abcdefghijkl"[i] ?? `o${i + 1}`;
}

const RE_QUESTION = /^(?:(QCM|QIM)|Q(?:uestion)?)?\s*(?:n\s*[°º]\s*)?(\d{1,3})\s*[.):–—-]\s*(.*)$/i;
const RE_SCHEMA = /^sch[ée]mas?\s*(?:n\s*[°º]\s*)?(\d{1,3})\s*[.):–—-]?\s*(.*)$/i;
const RE_PROP = /^([A-Ea-e])\s*[.):–—-]\s*(.+)$/;
/**
 * Verdict en fin de proposition : « (V) », « [F] », « Vrai », ou « V » isolé.
 * Le marqueur doit être un **jeton séparé** — précédé d'une espace ou d'une
 * parenthèse. Corrigé le 22/09/2026 : sans cette exigence, la dernière lettre
 * d'un mot finissant par « f » ou « v » était prise pour un verdict, et
 * « Le test est positif » devenait « Le test est positi », marqué Faux, sans
 * aucun avertissement. Reste ambigu, et seulement lui : un « V » ou un « F »
 * isolé qui ferait partie de la phrase (« le facteur V »). Le format du dépôt
 * écrit « (V) » entre parenthèses, ou porte le corrigé sur une ligne
 * « Réponses : ».
 */
const RE_VF = /(?:\s+|\s*[(\[]\s*)(V|F|Vrai|Faux)\s*[)\]]?\s*$/i;
const RE_CORRIGE = /^(?:R[ée]ponses?|Corrig[ée]s?|Solutions?|Bonnes? r[ée]ponses?)\s*[:–—-]?\s*(.*)$/i;
const RE_JUSTIF = /^(?:Justifications?|Explications?)\s*[:–—-]\s*(.*)$/i;
const RE_SOURCE = /^(?:Sources?|R[ée]f[ée]rences?)\s*[:–—-]\s*(.+)$/i;
const RE_ELIM = /^[EÉé]liminatoire\s*[:–—-]?\s*(oui|non|vrai|faux|yes|no)?\s*$/i;
const RE_RESERVEE = /^R[ée]serv[ée]e?(?:\s+[àa]\s+l['’][ée]valuation)?\s*[:–—-]?\s*(oui|non|vrai|faux|yes|no)?\s*$/i;
const RE_OBLIGATOIRE = /^Obligatoire\s*[:–—-]?\s*(oui|non|vrai|faux|yes|no)?\s*$/i;
const RE_IMAGE = /^(?:Image|Fichier|Figure)\s*[:–—-]\s*(\S+)\s*$/i;
/**
 * « Description de l'image : … » (23/09/2026) : ce que montre l'image, lu à la
 * place de l'image par un lecteur d'écran. Le libellé entier est exigé : un
 * « Description : » seul continuerait l'énoncé comme avant.
 */
const RE_DESCRIPTION_IMAGE = /^Description\s+de\s+l['’]\s?image\s*[:–—-]\s*(.+)$/i;
const RE_SEQUENCE = /^s[ée]quences?\s*(?:n\s*[°º]\s*)?(\d{1,3})\s*[.):–—-]?\s*(.*)$/i;
const RE_TEXTE = /^textes?(?:\s*[àa]\s*trous)?\s*(?:n\s*[°º]\s*)?(\d{1,3})\s*[.):–—-]?\s*(.*)$/i;
const RE_LEURRES = /^leurres?\s*[:–—-]\s*(.+)$/i;
/**
 * Lignes du prompt de génération (22/09/2026). Sans elles, une ligne
 * « Extrait A : « … » » placée sous sa proposition était **collée au texte de
 * la proposition** — l'apprenant aurait lu la phrase du document qui donne la
 * réponse. Elles vont désormais dans la justification, affichée après la
 * correction.
 */
const RE_EXTRAIT = /^Extraits?\s+([A-Ea-e])\s*[:–—-]\s*(.+)$/i;
const RE_PIEGES = /^Pi[èe]ges?\s*[:–—-]\s*(.+)$/i;
/** « Niveau : initial » — ou « Difficulté : … », le libellé du premier modèle ; « base » vaut « initial ». */
const RE_DIFFICULTE = /^(?:Niveau|Difficult[ée])\s*[:–—-]\s*(initial|base|interm[ée]diaire|avanc[ée]e?)\s*\.?\s*$/i;
/** Ligne numérotée d'une séquence ou d'un texte à trous : « 1. étape ». */
const RE_ELEMENT = /^(\d{1,2})\s*[.):–—-]\s*(.+)$/;
const RE_LEGENDE = /^(\d{1,2})\s*[.):–—-]\s*(.+?)\s*(?:\(\s*([\d\s.,;]+)\)\s*)?$/;
const RE_LETTRES = /\b[A-Ea-e]\b/g;
/** « Module : B1-05 » (question 57, choix a). */
const RE_MODULE = /^Modules?\s*[:–—-]\s*(.+)$/i;
/**
 * Intertitre « QCM » ou « QIM », seul sur sa ligne, numéroté ou non
 * (question 58, choix a) : il fixe le format des questions qui suivent sans
 * mot-clé. Avant, il était ignoré — ou collé au texte de la dernière
 * proposition quand aucune ligne vide ne le précédait.
 */
const RE_INTERTITRE =
  /^(?:(?:partie|section|s[ée]rie)\s+\w{1,4}\s*[.:–—-]?\s*)?(?:(?:[IVX]{1,4}|\d{1,2})\s*[.):–—-]\s*)?(QCM|QIM|questions?\s+[àa]\s+choix\s+multiples?|questions?\s+[àa]\s+interpr[ée]tations?\s+multiples?)s?\s*:?$/i;
const RE_DECOR = /\*\*|__|`/g;
const RE_PUCE = /^[\s>*•·#-]+(?=\S)/;

function sansDecor(ligne: string): string {
  return ligne.replace(RE_DECOR, "").replace(RE_PUCE, "").trim();
}

/** « ANSM — BPP 2023 — 21/07/2023 — https://… — LD 1 » → référence structurée. */
export function lireReference(texte: string): Reference {
  const parts = texte.split(/\s+[—–|]\s+/).map((x) => x.trim()).filter(Boolean);
  const url = parts.find((p) => /^https?:\/\//i.test(p));
  const reste = parts.filter((p) => p !== url);
  if (reste.length >= 2) {
    const [source, libelle, date, localisation] = reste;
    return {
      source,
      libelle,
      date: date ?? "",
      ...(url ? { url } : {}),
      ...(localisation ? { localisation } : {}),
    };
  }
  return { source: "", libelle: reste[0] ?? texte.trim(), date: "", ...(url ? { url } : {}) };
}

function place(brut: string | undefined): Legende["repere"] | null {
  if (!brut) return null;
  const n = brut
    .split(/[;,\s]+/)
    .filter((x) => x !== "")
    .map((x) => Number(x.replace(",", ".")));
  if (n.some((v) => !Number.isFinite(v) || v < 0 || v > 100)) return null;
  if (n.length === 2) return { x: n[0], y: n[1] };
  if (n.length === 4) {
    const cache = { x: n[0], y: n[1], w: n[2], h: n[3] };
    return { x: Math.round((cache.x + cache.w / 2) * 10) / 10, y: Math.round((cache.y + cache.h / 2) * 10) / 10, cache };
  }
  return null;
}

interface Brouillon {
  genre: "question" | "schema" | "sequence" | "trous";
  format: TypeQuestion;
  /** QCM ou QIM écrit devant la question. */
  formatMotCle?: FormatChoix;
  /** Dernier intertitre « QCM » ou « QIM » lu avant la question. */
  formatIntertitre?: FormatChoix;
  moduleLigne?: string;
  /** Un verdict « (V) » / « (F) » a été lu en fin de proposition. */
  marqueurs: boolean;
  numero?: number;
  enonce: string[];
  props: { lettre: string; texte: string; v: boolean | null }[];
  legendes: { texte: string; repere: Legende["repere"] | null }[];
  /** Séquence : étapes dans l'ordre juste. Texte à trous : vignettes attendues. */
  items: string[];
  /** Texte à trous : vignettes proposées en plus des attendues. */
  leurres: string[];
  imageNom?: string;
  imageAlt?: string;
  justification: string[];
  /** Extrait du document qui tranche chaque proposition, par lettre. */
  extraits: { lettre: string; texte: string }[];
  pieges: string;
  difficulte: string;
  refs: Reference[];
  eliminatoire: boolean;
  reservee: boolean;
  obligatoire: boolean;
  corrige: boolean;
  dernier: "enonce" | "prop" | "justif" | "legende" | "item" | "rien";
}

/** Ce qui, lu avant l'en-tête d'une question, vaut pour elle. */
interface Contexte {
  formatMotCle?: FormatChoix;
  formatIntertitre?: FormatChoix;
  moduleLigne?: string;
}

function nouveau(
  genre: Brouillon["genre"],
  format: TypeQuestion,
  numero: number | undefined,
  tete: string,
  contexte: Contexte,
): Brouillon {
  return {
    genre,
    format,
    ...contexte,
    marqueurs: false,
    numero,
    enonce: tete ? [tete] : [],
    props: [],
    legendes: [],
    items: [],
    leurres: [],
    justification: [],
    extraits: [],
    pieges: "",
    difficulte: "",
    refs: [],
    eliminatoire: false,
    reservee: false,
    obligatoire: false,
    corrige: false,
    dernier: "enonce",
  };
}

/**
 * Justification d'un QCM ou d'une QIM : la ligne « Justification » si elle
 * existe, puis les extraits du document dans l'ordre des lettres, puis les
 * pièges. Tout est affiché à l'apprenant après la correction — l'extrait lui
 * montre la phrase qui tranche, le piège lui dit où était l'erreur. Le niveau,
 * lui, est un champ de la question depuis le 22/09/2026.
 */
function justificationAssemblee(b: Brouillon): string {
  const parts: string[] = [];
  const libre = b.justification.join(" ").trim();
  if (libre) parts.push(libre);
  const extraits = [...b.extraits]
    .sort((x, y) => x.lettre.localeCompare(y.lettre))
    .map((x) => `${x.lettre} : ${x.texte}`);
  if (extraits.length) parts.push(`${extraits.join(" ; ")}.`);
  if (b.pieges) parts.push(`Pièges : ${b.pieges.replace(/\.$/, "")}.`);
  return parts.join(" ");
}

function finaliser(b: Brouillon, defaut: OptionsImport["formatDefaut"]): QuestionImportee | null {
  const avertissements: string[] = [];
  const enonce = b.enonce.join(" ").replace(/\s+/g, " ").trim();
  // Un schéma trouve son image au rang même sans ligne « Image » ; une autre
  // question, jamais : sa description resterait sans objet.
  if (b.imageAlt && !b.imageNom && b.genre !== "schema") {
    avertissements.push("Description d'image sans ligne « Image : » : ignorée, l'image se choisit dans l'éditeur.");
  }

  if (b.genre === "sequence") {
    if (b.items.length < 2) return null;
    return {
      format: "ORD",
      enonce: enonce || "Remettez ces étapes dans l'ordre.",
      // L'ordre de la liste est la réponse : il est relu tel quel.
      options: b.items.map((t, i) => ({ id: cleElement(i), texte: t, vrai: true })),
      legendes: [],
      imageNom: b.imageNom,
      imageAlt: b.imageAlt,
      justification: b.justification.join(" ").trim(),
      eliminatoire: b.eliminatoire,
      reservee: b.reservee,
      obligatoire: b.obligatoire,
      niveauQuestion: lireNiveauQuestion(b.difficulte),
      refs: b.refs,
      corrigeDetecte: true,
      moduleLigne: b.moduleLigne,
      avertissements,
    };
  }

  if (b.genre === "trous") {
    const numeros = trousDuTexte(enonce);
    if (numeros.length === 0) {
      avertissements.push("Aucune marque de trou ({1}, {2}…) dans l'énoncé : question ignorée.");
      return null;
    }
    if (b.items.length !== numeros.length) {
      avertissements.push(
        `${numeros.length} trou(s) dans l'énoncé, ${b.items.length} vignette(s) attendue(s) : à compléter dans l'éditeur.`,
      );
    }
    const attendues = b.items.slice(0, numeros.length);
    if (attendues.length === 0) return null;
    const options = [
      ...attendues.map((t, i) => ({ id: cleElement(i), texte: t, vrai: true })),
      ...b.leurres.map((t, i) => ({ id: cleElement(attendues.length + i), texte: t, vrai: false })),
    ];
    return {
      format: "TAT",
      enonce,
      options,
      legendes: [],
      imageNom: b.imageNom,
      imageAlt: b.imageAlt,
      justification: b.justification.join(" ").trim(),
      eliminatoire: b.eliminatoire,
      reservee: b.reservee,
      obligatoire: b.obligatoire,
      niveauQuestion: lireNiveauQuestion(b.difficulte),
      refs: b.refs,
      corrigeDetecte: attendues.length === numeros.length,
      moduleLigne: b.moduleLigne,
      avertissements,
    };
  }

  if (b.genre === "schema") {
    if (b.legendes.length === 0) return null;
    let sansPlace = 0;
    const legendes: Legende[] = b.legendes.map((l, k) => {
      let repere = l.repere;
      if (!repere) {
        sansPlace++;
        // Bord gauche, réparties sur la hauteur : à retoucher dans l'éditeur.
        repere = poser(8, 10 + (80 * k) / Math.max(1, b.legendes.length - 1 || 1), 1.5);
      }
      return { id: LETTRES[k]?.toLowerCase() ?? `l${k + 1}`, attendu: l.texte, repere };
    });
    if (sansPlace) avertissements.push(`${sansPlace} légende${sansPlace > 1 ? "s" : ""} sans coordonnées, à poser dans l'éditeur.`);
    if (!b.imageNom) avertissements.push("Image à choisir dans l'éditeur.");
    return {
      format: "SCH",
      enonce: enonce || "Légendez ce schéma.",
      options: [],
      legendes,
      imageNom: b.imageNom,
      imageAlt: b.imageAlt,
      numeroSchema: b.numero,
      justification: b.justification.join(" ").trim(),
      eliminatoire: b.eliminatoire,
      reservee: b.reservee,
      obligatoire: b.obligatoire,
      niveauQuestion: lireNiveauQuestion(b.difficulte),
      refs: b.refs,
      corrigeDetecte: true,
      moduleLigne: b.moduleLigne,
      avertissements,
    };
  }
  if (b.props.length < 2) return null;
  if (!enonce) avertissements.push("Énoncé vide.");
  // Mot-clé, puis intertitre, puis consigne de l'énoncé, puis défaut du dépôt.
  const indice = indiceFormat(enonce);
  const [format, origineFormat]: [FormatChoix, OrigineFormat] = b.formatMotCle
    ? [b.formatMotCle, "mot-cle"]
    : b.formatIntertitre
      ? [b.formatIntertitre, "intertitre"]
      : indice.format
        ? [indice.format, "enonce"]
        : [defaut, "defaut"];
  const manquants = b.props.filter((p) => p.v === null).length;
  const corrige = manquants === 0;
  if (!corrige) {
    avertissements.push(
      manquants === b.props.length
        ? "Aucun corrigé lu : toutes les propositions ont été mises à Faux, à trancher."
        : `${manquants} proposition${manquants > 1 ? "s" : ""} sans verdict, mise${manquants > 1 ? "s" : ""} à Faux.`,
    );
  }
  const options: OptionImportee[] = b.props.map((p) => ({ id: p.lettre.toLowerCase(), texte: p.texte, vrai: p.v === true }));
  // Extraits : chaque proposition doit être tranchée par une phrase du
  // document. Une lettre sans proposition, ou une proposition sans extrait
  // quand les autres en ont, se signale au relecteur des quatre yeux.
  if (b.extraits.length > 0) {
    const lettres = new Set(b.props.map((p) => p.lettre));
    const orphelins = b.extraits.filter((x) => !lettres.has(x.lettre)).map((x) => x.lettre);
    if (orphelins.length) avertissements.push(`Extrait sans proposition : ${orphelins.join(", ")}.`);
    const couvertes = new Set(b.extraits.map((x) => x.lettre));
    const nues = b.props.filter((p) => !couvertes.has(p.lettre)).map((p) => p.lettre);
    if (nues.length) {
      avertissements.push(
        `Proposition${nues.length > 1 ? "s" : ""} ${nues.join(", ")} sans extrait : vérifier qu'elle${nues.length > 1 ? "s sont tranchées" : " est tranchée"} par le document.`,
      );
    }
  }
  // Les avertissements propres au QCM dépendent du format : ils sont dans
  // `alertesFormat` (lib/import-format.ts), recalculés par l'aperçu.
  return {
    format,
    origineFormat,
    enonce,
    options,
    legendes: [],
    imageNom: b.imageNom,
    imageAlt: b.imageAlt,
    numeroSchema: b.numero,
    justification: justificationAssemblee(b),
    eliminatoire: b.eliminatoire,
    reservee: b.reservee,
    obligatoire: b.obligatoire,
    niveauQuestion: lireNiveauQuestion(b.difficulte),
    refs: b.refs,
    corrigeDetecte: corrige,
    corrigeParMarqueurs: b.marqueurs && !b.corrige,
    moduleLigne: b.moduleLigne,
    avertissements,
  };
}

/** Applique une ligne « Réponses : A C » ou « aucune ». */
function appliquerCorrige(b: Brouillon, contenu: string): void {
  // « Réponses vraies : aucune », « Réponses exactes : A C » : le qualificatif
  // et son séparateur ne font pas partie du corrigé.
  const nu = contenu.trim().replace(/^(?:vraies?|exactes?|justes?)\s*[:–—-]?\s*/i, "");
  if (/^aucune?\b/i.test(nu)) {
    b.props.forEach((p) => (p.v = false));
    b.corrige = true;
    return;
  }
  const lettres = new Set((nu.match(RE_LETTRES) ?? []).map((l) => l.toUpperCase()));
  if (lettres.size === 0) return;
  b.props.forEach((p) => (p.v = lettres.has(p.lettre)));
  b.corrige = true;
}

/** Analyse un texte déposé. */
export function analyserTexte(texte: string, options: OptionsImport): ResultatImport {
  const json = analyserJson(texte, options);
  if (json) return json;

  const avertissements: string[] = [];
  const questions: QuestionImportee[] = [];
  let courant: Brouillon | null = null;

  const clore = () => {
    if (!courant) return;
    const q = finaliser(courant, options.formatDefaut);
    if (q) questions.push(q);
    else avertissements.push(`Bloc « ${courant.enonce.join(" ").slice(0, 60) || "sans énoncé"} » ignoré : moins de deux propositions.`);
    courant = null;
  };

  // Ce qui vaut pour les questions à venir : dernier intertitre de format,
  // dernière ligne « Module : ».
  let formatIntertitre: FormatChoix | undefined;
  let moduleLigne: string | undefined;
  let apresLigneVide = true;

  for (const brut of texte.replace(/\r\n?/g, "\n").split("\n")) {
    const ligne = sansDecor(brut);
    if (!ligne) {
      if (courant) courant.dernier = "rien";
      apresLigneVide = true;
      continue;
    }
    const detachee = apresLigneVide;
    apresLigneVide = false;

    const it = RE_INTERTITRE.exec(ligne);
    if (it) {
      formatIntertitre = /qim|interpr/i.test(it[1]) ? "QIM" : "QCM";
      if (courant) courant.dernier = "rien";
      continue;
    }
    const mod = RE_MODULE.exec(ligne);
    if (mod) {
      moduleLigne = mod[1].trim();
      // Écrite dans une question, sans ligne vide avant elle, la ligne est de
      // cette question — comme « Niveau » ou « Source » — et des suivantes.
      if (courant && !detachee) courant.moduleLigne = moduleLigne;
      if (courant) courant.dernier = "rien";
      continue;
    }

    const s = RE_SCHEMA.exec(ligne);
    if (s) {
      clore();
      courant = nouveau("schema", "SCH", Number(s[1]), s[2].trim(), { moduleLigne });
      continue;
    }
    const seq = RE_SEQUENCE.exec(ligne);
    if (seq) {
      clore();
      courant = nouveau("sequence", "ORD", Number(seq[1]), seq[2].trim(), { moduleLigne });
      continue;
    }
    const tat = RE_TEXTE.exec(ligne);
    if (tat) {
      clore();
      courant = nouveau("trous", "TAT", Number(tat[1]), tat[2].trim(), { moduleLigne });
      continue;
    }
    const q = RE_QUESTION.exec(ligne);
    // Une ligne numérotée sans mot-clé appartient au bloc en cours : c'est une
    // légende, une étape ou une vignette, pas une nouvelle question.
    const dansUnBloc =
      courant !== null &&
      courant.genre !== "question" &&
      !q?.[1] &&
      (RE_LEGENDE.test(ligne) || RE_ELEMENT.test(ligne));
    if (q && !dansUnBloc) {
      clore();
      const motCle = q[1]?.toUpperCase() as FormatChoix | undefined;
      courant = nouveau("question", motCle ?? options.formatDefaut, Number(q[2]), q[3].trim(), {
        formatMotCle: motCle,
        formatIntertitre,
        moduleLigne,
      });
      continue;
    }
    if (!courant) continue;

    if (courant.genre === "sequence" || courant.genre === "trous") {
      const niv = RE_DIFFICULTE.exec(ligne);
      if (niv) {
        courant.difficulte = niv[1];
        courant.dernier = "rien";
        continue;
      }
      // Illustration d'une séquence ou d'un texte à trous (23/09/2026) : les
      // deux formats, venus après le 19/09, ne lisaient pas la ligne « Image ».
      const imSeq = RE_IMAGE.exec(ligne);
      if (imSeq) {
        courant.imageNom = imSeq[1];
        courant.dernier = "rien";
        continue;
      }
      const diSeq = RE_DESCRIPTION_IMAGE.exec(ligne);
      if (diSeq) {
        courant.imageAlt = diSeq[1].trim();
        courant.dernier = "rien";
        continue;
      }
      const el = RE_ELEMENT.exec(ligne);
      if (el) {
        courant.items.push(el[2].trim());
        courant.dernier = "item";
        continue;
      }
      const leu = RE_LEURRES.exec(ligne);
      if (leu) {
        for (const t of leu[1].split("|")) {
          const nu = t.trim();
          if (nu) courant.leurres.push(nu);
        }
        courant.dernier = "rien";
        continue;
      }
      const j = RE_JUSTIF.exec(ligne);
      if (j) {
        courant.justification.push(j[1].trim());
        courant.dernier = "justif";
        continue;
      }
      const src = RE_SOURCE.exec(ligne);
      if (src) {
        courant.refs.push(lireReference(src[1]));
        courant.dernier = "rien";
        continue;
      }
      const e = RE_ELIM.exec(ligne);
      if (e) {
        courant.eliminatoire = !e[1] || /^(oui|vrai|yes)$/i.test(e[1]);
        courant.dernier = "rien";
        continue;
      }
      const rv = RE_RESERVEE.exec(ligne);
      if (rv) {
        courant.reservee = !rv[1] || /^(oui|vrai|yes)$/i.test(rv[1]);
        courant.dernier = "rien";
        continue;
      }
      const ob = RE_OBLIGATOIRE.exec(ligne);
      if (ob) {
        courant.obligatoire = !ob[1] || /^(oui|vrai|yes)$/i.test(ob[1]);
        courant.dernier = "rien";
        continue;
      }
      if (courant.dernier === "enonce") courant.enonce.push(ligne);
      else if (courant.dernier === "justif") courant.justification.push(ligne);
      continue;
    }

    if (courant.genre === "schema") {
      const niv = RE_DIFFICULTE.exec(ligne);
      if (niv) {
        courant.difficulte = niv[1];
        courant.dernier = "rien";
        continue;
      }
      const im = RE_IMAGE.exec(ligne);
      if (im) {
        courant.imageNom = im[1];
        continue;
      }
      const diSch = RE_DESCRIPTION_IMAGE.exec(ligne);
      if (diSch) {
        courant.imageAlt = diSch[1].trim();
        courant.dernier = "rien";
        continue;
      }
      const j = RE_JUSTIF.exec(ligne);
      if (j) {
        courant.justification.push(j[1].trim());
        courant.dernier = "justif";
        continue;
      }
      const src = RE_SOURCE.exec(ligne);
      if (src) {
        courant.refs.push(lireReference(src[1]));
        courant.dernier = "rien";
        continue;
      }
      const l = RE_LEGENDE.exec(ligne);
      if (l) {
        courant.legendes.push({ texte: l[2].trim(), repere: place(l[3]) });
        courant.dernier = "legende";
        continue;
      }
      if (courant.dernier === "enonce") courant.enonce.push(ligne);
      else if (courant.dernier === "justif") courant.justification.push(ligne);
      continue;
    }

    const ex = RE_EXTRAIT.exec(ligne);
    if (ex) {
      courant.extraits.push({ lettre: ex[1].toUpperCase(), texte: ex[2].trim() });
      courant.dernier = "rien";
      continue;
    }
    const pg = RE_PIEGES.exec(ligne);
    if (pg) {
      courant.pieges = pg[1].trim();
      courant.dernier = "rien";
      continue;
    }
    const df = RE_DIFFICULTE.exec(ligne);
    if (df) {
      courant.difficulte = df[1];
      courant.dernier = "rien";
      continue;
    }
    const p = RE_PROP.exec(ligne);
    if (p && courant.props.length < 5) {
      const lettre = p[1].toUpperCase();
      let t = p[2].trim();
      let v: boolean | null = null;
      const vf = RE_VF.exec(t);
      if (vf && t.length > vf[0].length) {
        v = /^v/i.test(vf[1]);
        t = t.slice(0, t.length - vf[0].length).trim();
        courant.marqueurs = true;
      }
      if (lettre !== LETTRES[courant.props.length]) {
        avertissements.push(`Proposition « ${lettre} » hors séquence dans la question ${courant.numero ?? "?"}.`);
      }
      courant.props.push({ lettre: LETTRES[courant.props.length] ?? lettre, texte: t, v });
      courant.dernier = "prop";
      continue;
    }
    const img = RE_IMAGE.exec(ligne);
    if (img) {
      // Illustration d'un QCM ou d'une QIM : même ligne que pour un schéma.
      courant.imageNom = img[1];
      courant.dernier = "rien";
      continue;
    }
    const di = RE_DESCRIPTION_IMAGE.exec(ligne);
    if (di) {
      courant.imageAlt = di[1].trim();
      courant.dernier = "rien";
      continue;
    }
    const c = RE_CORRIGE.exec(ligne);
    if (c) {
      appliquerCorrige(courant, c[1]);
      courant.dernier = "rien";
      continue;
    }
    const j = RE_JUSTIF.exec(ligne);
    if (j) {
      courant.justification.push(j[1].trim());
      courant.dernier = "justif";
      continue;
    }
    const src = RE_SOURCE.exec(ligne);
    if (src) {
      courant.refs.push(lireReference(src[1]));
      courant.dernier = "rien";
      continue;
    }
    const e = RE_ELIM.exec(ligne);
    if (e) {
      courant.eliminatoire = !e[1] || /^(oui|vrai|yes)$/i.test(e[1]);
      courant.dernier = "rien";
      continue;
    }
    const rv = RE_RESERVEE.exec(ligne);
    if (rv) {
      courant.reservee = !rv[1] || /^(oui|vrai|yes)$/i.test(rv[1]);
      courant.dernier = "rien";
      continue;
    }
    const ob = RE_OBLIGATOIRE.exec(ligne);
    if (ob) {
      courant.obligatoire = !ob[1] || /^(oui|vrai|yes)$/i.test(ob[1]);
      courant.dernier = "rien";
      continue;
    }
    if (courant.dernier === "enonce") courant.enonce.push(ligne);
    else if (courant.dernier === "prop") {
      const derniere = courant.props[courant.props.length - 1];
      derniere.texte = `${derniere.texte} ${ligne}`.trim();
    } else if (courant.dernier === "justif") courant.justification.push(ligne);
  }
  clore();

  if (questions.length > MAX_QUESTIONS_IMPORT) {
    avertissements.push(`Dépôt limité à ${MAX_QUESTIONS_IMPORT} questions : les suivantes sont ignorées.`);
    questions.length = MAX_QUESTIONS_IMPORT;
  }
  if (questions.length === 0) avertissements.push("Aucune question reconnue.");
  return { questions, avertissements };
}

// ─────────────────────────────────────────────────────────────────── JSON

interface QuestionJson {
  format?: unknown;
  type?: unknown;
  enonce?: unknown;
  options?: unknown;
  propositions?: unknown;
  justification?: unknown;
  eliminatoire?: unknown;
  reservee?: unknown;
  obligatoire?: unknown;
  /** « initial », « intermédiaire », « avancé » — sous l'un de ces trois noms. */
  niveau?: unknown;
  niveauQuestion?: unknown;
  difficulte?: unknown;
  references?: unknown;
  refs?: unknown;
  legendes?: unknown;
  bonnesReponses?: unknown;
  /** Module, comme la ligne « Module : » d'un texte : code du critère, identifiant ou titre. */
  module?: unknown;
  moduleId?: unknown;
}

function chaine(v: unknown, defaut = ""): string {
  return typeof v === "string" ? v : defaut;
}

function optionsDe(q: QuestionJson): OptionImportee[] {
  const brut = Array.isArray(q.options) ? q.options : Array.isArray(q.propositions) ? q.propositions : [];
  const bonnes = new Set(Array.isArray(q.bonnesReponses) ? q.bonnesReponses.map(String) : []);
  return brut.slice(0, 5).map((o: unknown, k: number) => {
    const obj = (o && typeof o === "object" ? o : {}) as Record<string, unknown>;
    const id = chaine(obj.id, LETTRES[k].toLowerCase()).toLowerCase();
    const vrai =
      typeof obj.vrai === "boolean" ? obj.vrai : typeof obj.verdict === "boolean" ? obj.verdict : bonnes.has(id);
    return { id, texte: chaine(obj.texte, typeof o === "string" ? o : ""), vrai };
  });
}

function referencesDe(q: QuestionJson): Reference[] {
  const brut = Array.isArray(q.references) ? q.references : Array.isArray(q.refs) ? q.refs : [];
  return brut
    .map((r: unknown) => {
      if (typeof r === "string") return lireReference(r);
      const o = (r && typeof r === "object" ? r : {}) as Record<string, unknown>;
      return {
        source: chaine(o.source),
        libelle: chaine(o.libelle, chaine(o.fichier)),
        date: chaine(o.date),
        ...(typeof o.url === "string" ? { url: o.url } : {}),
        ...(typeof o.localisation === "string" ? { localisation: o.localisation } : {}),
      };
    })
    .filter((r) => r.libelle);
}

function analyserJson(texte: string, options: OptionsImport): ResultatImport | null {
  const t = texte.trim();
  if (!t.startsWith("{") && !t.startsWith("[")) return null;
  let brut: unknown;
  try {
    brut = JSON.parse(t);
  } catch {
    return { questions: [], avertissements: ["Le texte ressemble à du JSON mais ne se lit pas."] };
  }
  const liste: unknown[] = Array.isArray(brut)
    ? brut
    : brut && typeof brut === "object" && Array.isArray((brut as { items?: unknown }).items)
      ? ((brut as { items: unknown[] }).items)
      : brut && typeof brut === "object" && Array.isArray((brut as { questions?: unknown }).questions)
        ? ((brut as { questions: unknown[] }).questions)
        : [];
  const avertissements: string[] = [];
  const questions: QuestionImportee[] = [];
  for (const item of liste.slice(0, MAX_QUESTIONS_IMPORT)) {
    const q = (item && typeof item === "object" ? item : {}) as QuestionJson;
    const fmtBrut = chaine(q.format, chaine(q.type)).toUpperCase();
    const enonce = chaine(q.enonce).trim();
    // Format écrit, sinon consigne de l'énoncé, sinon défaut du dépôt (question 58).
    const indice = indiceFormat(enonce);
    const [format, origineFormat]: [TypeQuestion, OrigineFormat] =
      fmtBrut === "QIM" || fmtBrut === "SCH" || fmtBrut === "QCM"
        ? [fmtBrut, "mot-cle"]
        : indice.format
          ? [indice.format, "enonce"]
          : [options.formatDefaut, "defaut"];
    const moduleLigne = chaine(q.module, chaine(q.moduleId)).trim() || undefined;
    const avert: string[] = [];
    if (format === "SCH") {
      const legs = (Array.isArray(q.legendes) ? q.legendes : []) as Record<string, unknown>[];
      const legendes: Legende[] = legs.map((l, k) => {
        const rep = (l.repere && typeof l.repere === "object" ? l.repere : { x: 8, y: 10 + 80 * k / Math.max(1, legs.length - 1 || 1) }) as Legende["repere"];
        return { id: chaine(l.id, LETTRES[k]?.toLowerCase() ?? `l${k + 1}`), attendu: chaine(l.attendu, chaine(l.texte)), repere: rep };
      });
      if (legendes.length === 0) {
        avertissements.push(`Schéma « ${enonce.slice(0, 50)} » ignoré : aucune légende.`);
        continue;
      }
      questions.push({ format, enonce: enonce || "Légendez ce schéma.", options: [], legendes, justification: chaine(q.justification), eliminatoire: q.eliminatoire === true, reservee: q.reservee === true, obligatoire: q.obligatoire === true, niveauQuestion: lireNiveauQuestion(q.niveau ?? q.niveauQuestion ?? q.difficulte), refs: referencesDe(q), corrigeDetecte: true, moduleLigne, avertissements: ["Image à choisir dans l'éditeur."] });
      continue;
    }
    const opts = optionsDe(q);
    if (opts.length < 2) {
      avertissements.push(`Question « ${enonce.slice(0, 50)} » ignorée : moins de deux propositions.`);
      continue;
    }
    // « QCM sans proposition vraie » : dans `alertesFormat`, recalculé par l'aperçu.
    questions.push({ format, origineFormat, enonce, options: opts, legendes: [], justification: chaine(q.justification), eliminatoire: q.eliminatoire === true, reservee: q.reservee === true, obligatoire: q.obligatoire === true, niveauQuestion: lireNiveauQuestion(q.niveau ?? q.niveauQuestion ?? q.difficulte), refs: referencesDe(q), corrigeDetecte: true, moduleLigne, avertissements: avert });
  }
  if (questions.length === 0) avertissements.push("Aucune question reconnue dans le JSON.");
  return { questions, avertissements };
}
