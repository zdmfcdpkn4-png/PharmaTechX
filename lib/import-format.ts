/**
 * Format d'une question déposée, lu dans son énoncé (question 58, choix a,
 * 23/09/2026).
 *
 * Un QCM et une QIM ne se distinguent pas par leur corrigé : tous deux portent
 * des propositions vraies et fausses. Ce qui les sépare est la consigne —
 * cocher les bonnes propositions (QCM, noté tout ou rien) ou juger chacune
 * (QIM, barème à la discordance) — et elle ne se lit que dans l'énoncé.
 *
 * Tournures reconnues, prises des modules rédigés et des deux prompts :
 *   - QIM : « vraies ou fausses », « chaque proposition », « indépendamment »,
 *     « indiquer la ou les propositions exactes » (la consigne des QIM des
 *     modules rédigés) ;
 *   - QCM : « lesquelles », « laquelle », « plusieurs réponses », « une seule
 *     réponse », « cochez »… ; plus faiblement, un énoncé qui pose une
 *     question (« Quel est… ? »), la forme des QCM des modules rédigés.
 * Aucune tournure, ou les deux à la fois : l'énoncé ne dit rien.
 *
 * Le danger est le QCM à rebours, « lesquelles sont fausses ? » : ses lettres
 * à cocher sont les propositions fausses. Enregistré en QIM, il ferait juger
 * ces lettres vraies — corrigé à l'envers, sans que rien ne se voie.
 *
 * Fichier pur, lu par l'analyseur du dépôt et par son aperçu.
 */

export type FormatChoix = "QCM" | "QIM";

export interface IndiceFormat {
  /** Format que suggère l'énoncé ; `null` s'il ne dit rien, ou dit les deux. */
  format: FormatChoix | null;
  /** Tournure nette (« lesquelles », « vraies ou fausses ») ; sinon, seulement une question posée. */
  net: boolean;
  /** L'énoncé demande les propositions fausses (« lesquelles sont fausses ? »). */
  aRebours: boolean;
  /** La tournure qui a décidé, telle qu'écrite dans l'énoncé ; vide si aucune. */
  motif: string;
}

/**
 * Minuscules sans accents, **à longueur égale** : chaque caractère donne un
 * caractère, pour qu'une position trouvée ici désigne le même passage du
 * texte d'origine — les mots montrés à l'écran gardent leurs accents.
 */
export function plier(texte: string): string {
  let out = "";
  for (let i = 0; i < texte.length; i++) {
    const c = texte[i];
    if (c === "’" || c === "'") {
      out += " ";
      continue;
    }
    const base = c.normalize("NFD")[0] ?? c;
    out += base.toLowerCase()[0] ?? base;
  }
  return out;
}

const QIM_NET: RegExp[] = [
  /\bvrai(?:e|es|s)?\s+ou\s+fau(?:x|sse|sses)\b/,
  /\bexacte?s?\s+ou\s+inexacte?s?\b/,
  /\bchaque\s+proposition\b/,
  /\bindependamment\b/,
  /\bindiqu(?:er|ez)\s+(?:la\s+ou\s+les|les)\s+propositions?\s+(?:exactes?|vraies?|justes?|correctes?)\b/,
];

const QCM_NET: RegExp[] = [
  /\b(?:lesquel(?:le)?s|laquelle|lequel)\b/,
  /\bplusieurs\s+reponses?\b/,
  /\bune\s+seule\s+reponse\b/,
  /\breponses?\s+possibles?\b/,
  /\b(?:cochez|cocher|choisissez|selectionnez|entourez)\b/,
];

const A_REBOURS = /\b(?:fausses?|faux|inexactes?|incorrectes?|erronees?)\b/;

function premier(regles: RegExp[], plie: string, texte: string): string | null {
  for (const r of regles) {
    const m = r.exec(plie);
    if (m) return texte.slice(m.index, m.index + m[0].length);
  }
  return null;
}

/** Ce que l'énoncé dit du format. */
export function indiceFormat(enonce: string): IndiceFormat {
  const plie = plier(enonce);
  const qim = premier(QIM_NET, plie, enonce);
  const qcm = premier(QCM_NET, plie, enonce);
  if (qim && qcm) return { format: null, net: false, aRebours: false, motif: "" };
  if (qim) return { format: "QIM", net: true, aRebours: false, motif: qim };
  const aRebours = A_REBOURS.test(plie);
  if (qcm) return { format: "QCM", net: true, aRebours, motif: qcm };
  if (plie.includes("?")) return { format: "QCM", net: false, aRebours, motif: "?" };
  return { format: null, net: false, aRebours: false, motif: "" };
}

/** Ce que l'aperçu doit savoir d'une question pour juger son format. */
export interface QuestionAJuger {
  format: string;
  enonce: string;
  options: { vrai: boolean }[];
  corrigeDetecte: boolean;
  /** Corrigé lu dans les « (V) » / « (F) » des propositions, sans ligne « Réponses ». */
  corrigeParMarqueurs?: boolean;
}

/**
 * Avertissements qui dépendent du format — recalculés dans l'aperçu à chaque
 * changement de format, pour qu'un avertissement ne survive pas à sa
 * correction.
 */
export function alertesFormat(q: QuestionAJuger): string[] {
  if (q.format !== "QCM" && q.format !== "QIM") return [];
  const out: string[] = [];
  const indice = indiceFormat(q.enonce);
  if (q.format === "QIM" && indice.aRebours) {
    out.push(
      "L'énoncé demande les propositions fausses, comme un QCM « lesquelles sont fausses ? » : en QIM, ses lettres à cocher seraient jugées vraies — corrigé à l'envers. Passer en QCM, ou réécrire le corrigé.",
    );
  } else if (q.format === "QIM" && indice.format === "QCM" && indice.net) {
    out.push(`L'énoncé est tourné comme un QCM (« ${indice.motif} ») : vérifier le format.`);
  } else if (q.format === "QCM" && indice.format === "QIM") {
    out.push(`L'énoncé demande de juger chaque proposition, comme une QIM (« ${indice.motif} ») : vérifier le format.`);
  }
  if (q.format === "QCM") {
    const vraies = q.options.filter((o) => o.vrai).length;
    if (vraies === 0 && q.corrigeDetecte) out.push("QCM sans aucune proposition vraie : vérifier le corrigé.");
    if (vraies > 1 && !/plusieurs/i.test(q.enonce)) {
      out.push("Plusieurs réponses vraies : l'énoncé devrait mentionner « plusieurs réponses ».");
    }
    // Un « (F) » posé par un humain sur une proposition fausse veut dire
    // « fausse », pas « à ne pas cocher » : sur un QCM à rebours, le site
    // ferait cocher les propositions vraies.
    if (indice.aRebours && q.corrigeParMarqueurs) {
      out.push(
        "QCM « lesquelles sont fausses ? » corrigé par (V) / (F) : le site fait cocher les (V). Si (V) marque ici les propositions vraies, le corrigé est à l'envers — préférer « Réponses : » suivi des lettres à cocher.",
      );
    }
  }
  return out;
}
