/**
 * Justification par proposition (question 85, choix a, 01/10/2026).
 *
 * Comme dans les quiz de Flore (`Prop.j` et `Prop.ref`, dépôt Quiz-Flore),
 * chaque proposition d'un QCM ou d'une QIM porte sa justification, affichée
 * sous elle à la correction. Jusque-là, le dépôt mettait bout à bout, en un
 * seul texte sous la question, les extraits A à E et les pièges.
 *
 * La justification d'une proposition se compose de ce que le dépôt en dit,
 * une ligne par élément :
 *   - la justification écrite lettre par lettre (« Justification : », puis
 *     « B. Faux : c'est l'inverse. ») ;
 *   - l'extrait du document (« Extrait B : « … » »), la phrase qui confirme la
 *     proposition ou qu'elle contredit ;
 *   - le piège (« Pièges : B mauvaise attribution »), qui dit où était l'erreur.
 *
 * Une question déposée avant n'a qu'un texte : `repartirJustification` le
 * découpe pour l'éditeur (« Répartir sous les propositions »), qui le fait
 * relire avant d'enregistrer.
 *
 * Ce fichier est pur : l'éditeur, le dépôt et les tests s'en servent tels quels.
 */

/** Longueur d'une justification de proposition. */
export const JUSTIFICATION_PROPOSITION_MAX = 1000;

const LETTRES = "ABCDE";

/**
 * « … » Réponses : A D E » : le corrigé collé au bout d'une ligne d'extrait,
 * quand le copier-coller a fondu deux paragraphes du Word en un (banque du
 * pool, QIM 1 du module 1, 01/10/2026). Il restait dans l'extrait, et la
 * question passait sans corrigé, toutes ses propositions à Faux. `null` :
 * pas de corrigé collé ; `[]` : « Réponses : aucune ».
 */
export function separerCorrigeColle(texte: string): { texte: string; lettres: string[] } | null {
  const m = /^(.*[»"”])\s*R[ée]ponses?\s*[:–—-]\s*(aucune?|[A-E](?:\s*(?:[,;]|et)?\s*[A-E])*)\s*\.?\s*$/i.exec(texte.trim());
  if (!m) return null;
  return { texte: m[1].trim(), lettres: /^aucune?$/i.test(m[2]) ? [] : [...new Set(m[2].toUpperCase().match(/[A-E]/g) ?? [])] };
}

/** Justification d'une proposition : une ligne par élément, dans cet ordre. */
export function composerJustification(e: { justification?: string; extrait?: string; piege?: string }): string {
  const lignes: string[] = [];
  const justification = e.justification?.trim();
  if (justification) lignes.push(justification);
  const extrait = e.extrait?.trim();
  if (extrait) lignes.push(`Extrait : ${extrait}`);
  const piege = e.piege?.trim().replace(/\.$/, "");
  if (piege) lignes.push(`Piège : ${piege}.`);
  return lignes.join("\n");
}

/**
 * Ligne « Pièges : B mauvaise attribution, C inversion » : le piège de chaque
 * lettre, et ce qui ne se range sous aucune (« aucun », un piège sans lettre
 * ou d'une lettre sans proposition).
 */
export function lirePieges(texte: string, lettres: readonly string[]): { parLettre: Map<string, string>; reste: string[] } {
  const connues = new Set(lettres.map((l) => l.toUpperCase()));
  const parLettre = new Map<string, string>();
  const reste: string[] = [];
  const morceaux = texte
    .trim()
    .replace(/\.$/, "")
    .split(/\s*[,;]\s*(?=[A-E](?:\s|[.:)–—-]))/);
  for (const brut of morceaux) {
    const morceau = brut.trim();
    if (!morceau) continue;
    const m = /^([A-E])\s*[.:)–—-]?\s+(.+)$/.exec(morceau);
    if (m && connues.has(m[1])) {
      const avant = parLettre.get(m[1]);
      parLettre.set(m[1], avant ? `${avant}, ${m[2].trim()}` : m[2].trim());
    } else {
      reste.push(morceau);
    }
  }
  return { parLettre, reste };
}

/**
 * Texte unique d'une question déposée avant la question 85, découpé pour
 * l'éditeur : l'extrait et le piège de chaque lettre vont à sa proposition,
 * le reste demeure la justification de la question. `null` : rien à répartir.
 *
 * Le découpage suit la forme que le dépôt écrivait jusqu'au 01/10/2026 :
 * justification libre, « Extrait du document : … », puis les extraits
 * « A : … ; B : … » dans l'ordre des lettres, puis « Pièges : … ». Un texte
 * retouché à la main peut s'en écarter : l'éditeur fait relire la coupe avant
 * l'enregistrement. Une justification écrite lettre par lettre (« A. Vrai… »)
 * n'est pas découpée : elle reste à la question.
 */
export function repartirJustification(
  texte: string,
  lettres: readonly string[],
): { question: string; propositions: Record<string, string>; corrige?: string[] } | null {
  const connues = lettres.map((l) => l.toUpperCase()).filter((l) => LETTRES.includes(l));
  if (connues.length === 0) return null;
  let corps = texte.trim();

  // Les pièges ferment le texte.
  let pieges: { parLettre: Map<string, string>; reste: string[] } = { parLettre: new Map(), reste: [] };
  const lignePieges = [...corps.matchAll(/(?:^|\s)Pi[èe]ges?\s*:\s*/g)].at(-1);
  if (lignePieges?.index !== undefined) {
    pieges = lirePieges(corps.slice(lignePieges.index + lignePieges[0].length), connues);
    corps = corps.slice(0, lignePieges.index).trim();
  }

  // Les extraits « A : … ; B : … » : le dernier bloc du texte restant.
  const extraits = new Map<string, string>();
  let corrige: string[] | undefined;
  const morceaux = corps.split(/ ; (?=[A-E] : )/);
  const debuts = [...morceaux[0].matchAll(morceaux.length > 1 ? /(?:^|\s)([A-E]) : /g : /(?:^|[.!?»]\s+)([A-E]) : /g)];
  const premier = debuts.at(-1);
  if (premier?.index !== undefined) {
    const debut = premier.index + premier[0].length - `${premier[1]} : `.length;
    const segments = [morceaux[0].slice(debut), ...morceaux.slice(1)].map((s) => ({ lettre: s[0], texte: s.slice(4).trim() }));
    const rangs = segments.map((s) => connues.indexOf(s.lettre));
    const ordonnes = rangs.every((r, k) => r >= 0 && (k === 0 || r > rangs[k - 1]));
    if (ordonnes) {
      const dernier = segments[segments.length - 1];
      dernier.texte = dernier.texte.replace(/\.$/, "").trim();
      for (const s of segments) {
        // Un corrigé collé au bout d'un extrait en sort (`separerCorrigeColle`).
        const colle = separerCorrigeColle(s.texte);
        if (colle) {
          s.texte = colle.texte;
          corrige = colle.lettres;
        }
        if (s.texte) extraits.set(s.lettre, s.texte);
      }
      corps = morceaux[0].slice(0, debut).trim();
    }
  }

  if (extraits.size === 0 && pieges.parLettre.size === 0) return null;
  const propositions: Record<string, string> = {};
  for (const l of connues) {
    const j = composerJustification({ extrait: extraits.get(l), piege: pieges.parLettre.get(l) });
    if (j) propositions[l] = j;
  }
  const question = [corps, pieges.reste.length > 0 ? `Pièges : ${pieges.reste.join(", ")}.` : ""].filter(Boolean).join(" ");
  return { question, propositions, ...(corrige ? { corrige } : {}) };
}

/**
 * Justification de chaque proposition présentée, par identifiant, pour la
 * correction : le serveur la renvoie dans l'ordre des propositions, par leur
 * texte, comme les réponses attendues (`content/marques.ts`). Deux
 * propositions de même texte rendraient le rapprochement ambigu : `null`.
 */
export function justificationsParOption(
  options: readonly { id: string; texte: string }[],
  propositions: readonly string[] | undefined,
  justifications: readonly string[] | undefined,
): Record<string, string> | null {
  if (!propositions || !justifications) return null;
  if (new Set(options.map((o) => o.texte)).size !== options.length) return null;
  const out: Record<string, string> = {};
  for (const o of options) {
    const k = propositions.indexOf(o.texte);
    const j = k >= 0 ? justifications[k]?.trim() : "";
    if (j) out[o.id] = j;
  }
  return out;
}
