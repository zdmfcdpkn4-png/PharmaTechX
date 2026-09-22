import { poser, type Legende } from "@/content/schema";
import { trousDuTexte } from "@/content/types";
import type { Reference, TypeQuestion } from "@/content/types";

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
 *
 * Une question de n'importe quel format peut porter une illustration :
 *
 *   Image : sas-habillage.jpg
 *
 * Le fichier est déposé avec le texte et apparié par son nom.
 *
 * Le mot-clé QCM ou QIM fixe le format ; sans lui, le format par défaut du
 * dépôt s'applique. Une question sans corrigé est importée quand même, toutes
 * ses propositions à Faux, et signalée : un tuteur tranche dans l'éditeur.
 * Toute question importée entre en base au statut « à vérifier », hors tirage
 * tant qu'un tuteur ou un administrateur ne l'a pas validée.
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
  /** Nom de fichier d'image annoncé (« Image : … ») — schéma ou illustration. */
  imageNom?: string;
  /** Schéma : numéro lu dans « SCHÉMA n. », pour apparier une image par rang. */
  numeroSchema?: number;
  justification: string;
  eliminatoire: boolean;
  /** Réservée à l'évaluation (question 18) : ligne « Réservée : oui ». */
  reservee: boolean;
  refs: Reference[];
  /** Un corrigé complet a-t-il été lu ? */
  corrigeDetecte: boolean;
  /** Ce que l'analyseur n'a pas pu trancher, en clair. */
  avertissements: string[];
}

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
const RE_IMAGE = /^(?:Image|Fichier|Figure)\s*[:–—-]\s*(\S+)\s*$/i;
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
const RE_DIFFICULTE = /^Difficult[ée]\s*[:–—-]\s*(base|interm[ée]diaire|avanc[ée]e?)\s*\.?\s*$/i;
/** Ligne numérotée d'une séquence ou d'un texte à trous : « 1. étape ». */
const RE_ELEMENT = /^(\d{1,2})\s*[.):–—-]\s*(.+)$/;
const RE_LEGENDE = /^(\d{1,2})\s*[.):–—-]\s*(.+?)\s*(?:\(\s*([\d\s.,;]+)\)\s*)?$/;
const RE_LETTRES = /\b[A-Ea-e]\b/g;
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
  numero?: number;
  enonce: string[];
  props: { lettre: string; texte: string; v: boolean | null }[];
  legendes: { texte: string; repere: Legende["repere"] | null }[];
  /** Séquence : étapes dans l'ordre juste. Texte à trous : vignettes attendues. */
  items: string[];
  /** Texte à trous : vignettes proposées en plus des attendues. */
  leurres: string[];
  imageNom?: string;
  justification: string[];
  /** Extrait du document qui tranche chaque proposition, par lettre. */
  extraits: { lettre: string; texte: string }[];
  pieges: string;
  difficulte: string;
  refs: Reference[];
  eliminatoire: boolean;
  reservee: boolean;
  corrige: boolean;
  dernier: "enonce" | "prop" | "justif" | "legende" | "item" | "rien";
}

function nouveau(genre: Brouillon["genre"], format: TypeQuestion, numero: number | undefined, tete: string): Brouillon {
  return {
    genre,
    format,
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
    corrige: false,
    dernier: "enonce",
  };
}

/**
 * Justification d'un QCM ou d'une QIM : la ligne « Justification » si elle
 * existe, puis les extraits du document dans l'ordre des lettres, puis les
 * pièges et la difficulté. Tout est affiché à l'apprenant après la
 * correction — l'extrait lui montre la phrase qui tranche, le piège lui dit
 * où était l'erreur.
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
  if (b.difficulte) parts.push(`Difficulté : ${b.difficulte}.`);
  return parts.join(" ");
}

function finaliser(b: Brouillon, defaut: OptionsImport["formatDefaut"]): QuestionImportee | null {
  const avertissements: string[] = [];
  const enonce = b.enonce.join(" ").replace(/\s+/g, " ").trim();

  if (b.genre === "sequence") {
    if (b.items.length < 2) return null;
    return {
      format: "ORD",
      enonce: enonce || "Remettez ces étapes dans l'ordre.",
      // L'ordre de la liste est la réponse : il est relu tel quel.
      options: b.items.map((t, i) => ({ id: cleElement(i), texte: t, vrai: true })),
      legendes: [],
      justification: b.justification.join(" ").trim(),
      eliminatoire: b.eliminatoire,
      reservee: b.reservee,
      refs: b.refs,
      corrigeDetecte: true,
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
      justification: b.justification.join(" ").trim(),
      eliminatoire: b.eliminatoire,
      reservee: b.reservee,
      refs: b.refs,
      corrigeDetecte: attendues.length === numeros.length,
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
      numeroSchema: b.numero,
      justification: b.justification.join(" ").trim(),
      eliminatoire: b.eliminatoire,
      reservee: b.reservee,
      refs: b.refs,
      corrigeDetecte: true,
      avertissements,
    };
  }
  if (b.props.length < 2) return null;
  if (!enonce) avertissements.push("Énoncé vide.");
  const format = b.format === "SCH" ? defaut : b.format;
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
  if (format === "QCM" && !options.some((o) => o.vrai) && corrige) {
    avertissements.push("QCM sans aucune proposition vraie : vérifier le corrigé.");
  }
  if (format === "QCM" && options.filter((o) => o.vrai).length > 1 && !/plusieurs/i.test(enonce)) {
    avertissements.push("Plusieurs réponses vraies : l'énoncé devrait mentionner « plusieurs réponses ».");
  }
  return {
    format,
    enonce,
    options,
    legendes: [],
    imageNom: b.imageNom,
    numeroSchema: b.numero,
    justification: justificationAssemblee(b),
    eliminatoire: b.eliminatoire,
    reservee: b.reservee,
    refs: b.refs,
    corrigeDetecte: corrige,
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

  for (const brut of texte.replace(/\r\n?/g, "\n").split("\n")) {
    const ligne = sansDecor(brut);
    if (!ligne) {
      if (courant) courant.dernier = "rien";
      continue;
    }

    const s = RE_SCHEMA.exec(ligne);
    if (s) {
      clore();
      courant = nouveau("schema", "SCH", Number(s[1]), s[2].trim());
      continue;
    }
    const seq = RE_SEQUENCE.exec(ligne);
    if (seq) {
      clore();
      courant = nouveau("sequence", "ORD", Number(seq[1]), seq[2].trim());
      continue;
    }
    const tat = RE_TEXTE.exec(ligne);
    if (tat) {
      clore();
      courant = nouveau("trous", "TAT", Number(tat[1]), tat[2].trim());
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
      const fmt = (q[1]?.toUpperCase() as "QCM" | "QIM" | undefined) ?? options.formatDefaut;
      courant = nouveau("question", fmt, Number(q[2]), q[3].trim());
      continue;
    }
    if (!courant) continue;

    if (courant.genre === "sequence" || courant.genre === "trous") {
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
      if (courant.dernier === "enonce") courant.enonce.push(ligne);
      else if (courant.dernier === "justif") courant.justification.push(ligne);
      continue;
    }

    if (courant.genre === "schema") {
      const im = RE_IMAGE.exec(ligne);
      if (im) {
        courant.imageNom = im[1];
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
      courant.difficulte = df[1].toLowerCase();
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
  references?: unknown;
  refs?: unknown;
  legendes?: unknown;
  bonnesReponses?: unknown;
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
    const format: TypeQuestion = fmtBrut === "QIM" || fmtBrut === "SCH" ? fmtBrut : fmtBrut === "QCM" ? "QCM" : options.formatDefaut;
    const enonce = chaine(q.enonce).trim();
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
      questions.push({ format, enonce: enonce || "Légendez ce schéma.", options: [], legendes, justification: chaine(q.justification), eliminatoire: q.eliminatoire === true, reservee: q.reservee === true, refs: referencesDe(q), corrigeDetecte: true, avertissements: ["Image à choisir dans l'éditeur."] });
      continue;
    }
    const opts = optionsDe(q);
    if (opts.length < 2) {
      avertissements.push(`Question « ${enonce.slice(0, 50)} » ignorée : moins de deux propositions.`);
      continue;
    }
    if (!opts.some((o) => o.vrai) && format === "QCM") avert.push("QCM sans proposition vraie : vérifier le corrigé.");
    questions.push({ format, enonce, options: opts, legendes: [], justification: chaine(q.justification), eliminatoire: q.eliminatoire === true, reservee: q.reservee === true, refs: referencesDe(q), corrigeDetecte: true, avertissements: avert });
  }
  if (questions.length === 0) avertissements.push("Aucune question reconnue dans le JSON.");
  return { questions, avertissements };
}
