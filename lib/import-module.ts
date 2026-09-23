import { plier } from "@/lib/import-format";

/**
 * Module de chaque question déposée (question 57, choix a, 23/09/2026).
 *
 * Deux voies, dans cet ordre :
 *   1. la ligne « Module : … » du texte — code du critère, identifiant ou
 *      titre du module — résolue ici ; un nom qui ne répond à aucun module,
 *      ou à plusieurs, laisse la question « à choisir » ;
 *   2. sans ligne, et sans module choisi au formulaire, une proposition : le
 *      module dont le titre, l'objectif et les questions validées partagent
 *      le plus de mots avec la question. Un mot rare parmi les modules pèse
 *      plus qu'un mot répandu (inverse de sa fréquence), un mot du titre
 *      compte double. La proposition n'est faite que nette — deux mots
 *      partagés au moins, assez de poids, et le double au moins du module
 *      suivant — sinon « à choisir ».
 * Les mots partagés sont montrés dans l'aperçu : la proposition se vérifie
 * avant l'ajout, et rien n'entre en base sans module.
 *
 * Tant que les modules n'ont qu'un titre (51 sur 53 au 23/09/2026), la
 * proposition manque souvent et deux titres voisins se départagent mal :
 * « à choisir » vaut mieux qu'un choix au hasard.
 *
 * Fichier pur : aucune dépendance serveur.
 */

export interface ModuleRepere {
  id: string;
  titre: string;
  /** Code du critère couvert ; vide si aucun. */
  critere: string;
}

/** Module et textes qui le décrivent : objectif, énoncés et propositions des questions validées. */
export interface CorpusModule extends ModuleRepere {
  textes: string[];
}

/** Clé de comparaison d'un nom : sans accents ni ponctuation, en minuscules. */
function cle(texte: string): string {
  return plier(texte)
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Nom court de chaque module, sans ambiguïté : le code de son critère s'il
 * est seul à le porter, sinon son identifiant. C'est ce nom que la liste du
 * prompt donne à l'assistant, et que la ligne « Module : » relit.
 */
export function reperesModules(modules: ModuleRepere[]): Map<string, string> {
  const porteurs = new Map<string, number>();
  for (const m of modules) if (m.critere) porteurs.set(cle(m.critere), (porteurs.get(cle(m.critere)) ?? 0) + 1);
  return new Map(modules.map((m) => [m.id, m.critere && porteurs.get(cle(m.critere)) === 1 ? m.critere : m.id]));
}

export type Resolution = { id: string; raison?: undefined } | { id: null; raison: string };

/**
 * Module que désigne une ligne « Module : … ». Sont essayés, sur la valeur
 * entière puis sur chacune de ses parties (« B1-05 — Sécurité incendie ») :
 * l'identifiant, qui décide seul ; puis le code du critère (« critère B1-05 »
 * compris) et le titre exact ; puis le début du titre s'il ne désigne qu'un
 * module.
 */
export function resoudreLigneModule(valeur: string, modules: ModuleRepere[]): Resolution {
  const brut = valeur
    .trim()
    .replace(/^[«"“(\[]+\s*|\s*[»"”)\].;]+$/g, "")
    .trim();
  const cles = [brut, ...brut.split(/\s+[—–-]\s+|\s*[:|]\s+/)].map(cle).filter(Boolean);
  // L'identifiant est unique : il décide seul. Sans cela, « critere-b5-06 »
  // se lirait aussi « critère B5-06 », que deux modules peuvent porter.
  const parId = modules.filter((m) => cles.includes(cle(m.id)));
  if (parId.length === 1) return { id: parId[0].id };
  const exacts = new Set<string>(parId.map((m) => m.id));
  const debuts = new Set<string>();
  for (const k of cles) {
    const kCritere = k.replace(/^critere\s+/, "");
    for (const m of modules) {
      const titre = cle(m.titre);
      if ((m.critere && cle(m.critere) === kCritere) || titre === k) exacts.add(m.id);
      else if (k.length >= 8 && titre.startsWith(k)) debuts.add(m.id);
    }
  }
  const trouves = exacts.size > 0 ? exacts : debuts;
  if (trouves.size === 1) return { id: [...trouves][0] };
  if (trouves.size === 0) return { id: null, raison: `aucun module ne répond à « ${brut} »` };
  const noms = reperesModules(modules);
  return {
    id: null,
    raison: `plusieurs modules répondent à « ${brut} » : ${[...trouves].map((id) => noms.get(id) ?? id).join(", ")}`,
  };
}

// ──────────────────────────────────────────────── proposition d'après les mots

/**
 * Mots vides : outils de la langue, vocabulaire de toute consigne de question,
 * et mots de procédure qui reviennent dans les titres sans rien dire du sujet
 * (« conduite à tenir en cas de », « règles », « gestion »…).
 */
const MOTS_VIDES = [
  "les", "des", "une", "aux", "est", "sont", "dans", "par", "pour", "sur", "avec", "sans", "sous", "entre",
  "vers", "chez", "que", "qui", "quoi", "dont", "ses", "leur", "leurs", "ils", "elle", "elles", "nous", "vous",
  "pas", "plus", "moins", "tout", "tous", "toute", "toutes", "cette", "ces", "cet", "celle", "celles", "ceux",
  "celui", "etre", "avoir", "fait", "faut", "doit", "doivent", "peut", "peuvent", "ont", "lors", "apres",
  "avant", "aussi", "ainsi", "donc", "car", "mais", "comme", "tres", "bien", "selon", "afin", "etc", "son",
  "nos", "vos", "notre", "votre", "lui", "eux", "ete", "une", "non", "oui", "ceci", "cela", "ici", "autre",
  "autres", "meme", "memes", "chaque", "seul", "seule", "deux", "trois",
  "quel", "quelle", "quels", "quelles", "lequel", "laquelle", "lesquels", "lesquelles", "parmi", "suivant",
  "suivante", "suivants", "suivantes", "proposition", "propositions", "reponse", "reponses", "vrai", "vraie",
  "vraies", "vrais", "faux", "fausse", "fausses", "exact", "exacte", "exactes", "juste", "justes", "correct",
  "correcte", "correctes", "inexacte", "inexactes", "indiquez", "indiquer", "concernant", "plusieurs",
  "possible", "possibles", "question", "questions", "enonce", "cochez", "choisissez", "premier", "premiere",
  "cas", "tenir", "conduite", "regle", "regles", "principe", "principes", "gestion", "realisation",
  "fonctionnement", "notion", "notions", "compris", "particulier", "particulieres", "specificite",
  "specificites", "utilise", "utilises", "adapte", "adaptes", "maitriser", "critere", "fiche", "habilitation",
  "echeant", "situation", "situations", "faire", "fait", "reste", "rester", "comment", "pourquoi",
];

/** Racine grossière : sans la marque du pluriel. */
function racine(mot: string): string {
  return mot.length > 4 && /[sx]$/.test(mot) ? mot.slice(0, -1) : mot;
}

const VIDES = new Set(MOTS_VIDES.map(racine));

/** Mots significatifs d'un texte : racine → forme lue (la première rencontrée, accents compris). */
export function motsSignificatifs(texte: string): Map<string, string> {
  const out = new Map<string, string>();
  const plie = plier(texte);
  const re = /[a-z0-9]+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(plie))) {
    const mot = m[0];
    if (mot.length < 3) continue;
    const r = racine(mot);
    if (VIDES.has(r)) continue;
    if (!out.has(r)) out.set(r, texte.slice(m.index, m.index + mot.length).toLowerCase());
  }
  return out;
}

interface ModuleIndexe {
  id: string;
  titre: Set<string>;
  reste: Set<string>;
}

export interface IndexModules {
  modules: ModuleIndexe[];
  /** Poids d'un mot : ln(nombre de modules / nombre de modules qui l'emploient). */
  poids: Map<string, number>;
}

export function indexerModules(corpus: CorpusModule[]): IndexModules {
  const modules: ModuleIndexe[] = corpus.map((m) => {
    const titre = new Set(motsSignificatifs(m.titre).keys());
    const reste = new Set<string>();
    for (const t of m.textes) for (const r of motsSignificatifs(t).keys()) if (!titre.has(r)) reste.add(r);
    return { id: m.id, titre, reste };
  });
  const frequence = new Map<string, number>();
  for (const m of modules) for (const r of new Set([...m.titre, ...m.reste])) frequence.set(r, (frequence.get(r) ?? 0) + 1);
  const n = Math.max(1, modules.length);
  const poids = new Map([...frequence].map(([r, f]) => [r, Math.log(n / f)]));
  return { modules, poids };
}

/**
 * Règles d'une proposition nette, étalonnées le 23/09/2026 sur les questions
 * des deux modules rédigés et sur des questions d'essai (voir DECISIONS.md) :
 * deux mots partagés au moins — un mot seul, « température », envoyait une
 * question de stabilité vers la surveillance des températures —, un poids
 * minimal, et le double au moins du module suivant.
 */
export const MOTS_MIN_PROPOSITION = 2;
export const SEUIL_PROPOSITION = 6;
export const ECART_PROPOSITION = 2;

export interface Candidat {
  id: string;
  score: number;
  /** Nombre de mots partagés. */
  nbMots: number;
  /** Mots de la question partagés avec le module, du plus lourd au plus léger, cinq au plus. */
  mots: string[];
}

export interface Proposition {
  /** Module proposé ; `null` : à choisir. */
  id: string | null;
  /** Les trois modules les plus proches, pour dire une hésitation. */
  candidats: Candidat[];
}

export function proposerModule(index: IndexModules, texte: string): Proposition {
  const mots = motsSignificatifs(texte);
  const candidats: Candidat[] = [];
  for (const m of index.modules) {
    const parts: { forme: string; poids: number }[] = [];
    for (const [r, forme] of mots) {
      const p = index.poids.get(r) ?? 0;
      if (p <= 0) continue;
      if (m.titre.has(r)) parts.push({ forme, poids: 2 * p });
      else if (m.reste.has(r)) parts.push({ forme, poids: p });
    }
    if (parts.length === 0) continue;
    parts.sort((a, b) => b.poids - a.poids);
    candidats.push({
      id: m.id,
      score: Math.round(parts.reduce((s, x) => s + x.poids, 0) * 100) / 100,
      nbMots: parts.length,
      mots: parts.slice(0, 5).map((x) => x.forme),
    });
  }
  candidats.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  const [premier, second] = candidats;
  const net =
    premier !== undefined &&
    premier.nbMots >= MOTS_MIN_PROPOSITION &&
    premier.score >= SEUIL_PROPOSITION &&
    (second === undefined || premier.score >= ECART_PROPOSITION * second.score);
  return { id: net ? premier.id : null, candidats: candidats.slice(0, 3) };
}
