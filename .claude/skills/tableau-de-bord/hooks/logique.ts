import type { Conseil, Contexte, Etape, EtatEtape, Regime, Reglage, SousAgent, Tache, Vitesse } from '../types'

/**
 * Seuils de remplissage du contexte, en % de la fenêtre. Ce sont des règles
 * d'usage, pas des mesures : à régler ici selon l'expérience.
 */
export const SEUILS = { surveiller: 50, compacter: 70, relais: 85 } as const

/** 0 confortable, 1 à surveiller, 2 compacter, 3 relais. */
export type Niveau = 0 | 1 | 2 | 3

export function niveauDe(percent: number | null): Niveau {
  if (percent === null) return 0
  if (percent >= SEUILS.relais) return 3
  if (percent >= SEUILS.compacter) return 2
  if (percent >= SEUILS.surveiller) return 1
  return 0
}

/** Teintes moyennes, lisibles sur fond clair comme sur fond sombre (3:1 au moins sur blanc). */
export const COULEURS = {
  vert: '#2e9e5b',
  jaune: '#a67c00',
  orange: '#d35f00',
  rouge: '#d93025',
  bleu: '#2f6fde',
  gris: '#8a8f98',
  aiguille: '#5f6368',
} as const

export function couleurDe(valeur: number): string {
  if (valeur >= SEUILS.relais) return COULEURS.rouge
  if (valeur >= SEUILS.compacter) return COULEURS.orange
  if (valeur >= SEUILS.surveiller) return COULEURS.jaune
  return COULEURS.vert
}

export const CONTEXTE_VIDE: Contexte = { percent: null, tokens: null, fenetre: null, seuilAuto: null }

export function memeContexte(a: Contexte, b: Contexte): boolean {
  return a.percent === b.percent && a.tokens === b.tokens && a.fenetre === b.fenetre && a.seuilAuto === b.seuilAuto
}

/** La consigne du moment, en mots simples. */
export function consigne(c: Contexte): string {
  const p = c.percent
  if (p === null) return 'Contexte pas encore mesuré : la jauge se remplit après la première réponse.'
  const n = niveauDe(p)
  const base =
    n === 0
      ? `Contexte à ${p} % : confortable, continuez.`
      : n === 1
        ? `Contexte à ${p} % : finissez la tâche en cours, puis compactez.`
        : n === 2
          ? `Contexte à ${p} % : compactez maintenant, entre deux tâches.`
          : `Contexte à ${p} % : préparez le relais vers une nouvelle conversation, ou compactez tout de suite.`
  if (c.seuilAuto !== null && p < c.seuilAuto && p >= c.seuilAuto - 10) {
    return `${base} Le compactage automatique part à ${c.seuilAuto} % : mieux vaut le lancer vous-même, avec des consignes.`
  }
  return base
}

/** 620 k, 1 M, 1,2 M : sans Intl, absent de l'environnement des mods. */
export function formatJetons(n: number | null): string {
  if (n === null) return '—'
  if (n >= 1_000_000) {
    const m = Math.round(n / 100_000) / 10
    return `${String(m).replace('.', ',')} M`
  }
  if (n >= 1000) return `${Math.round(n / 1000)} k`
  return String(n)
}

export const VITESSES: readonly Vitesse[] = ['haiku', 'sonnet', 'opus', 'fable']

export const NOM_VITESSE: Record<Vitesse, string> = {
  haiku: 'Haiku',
  sonnet: 'Sonnet',
  opus: 'Opus',
  fable: 'Fable',
}

export function vitesseDe(modele: string | null): Vitesse | null {
  const m = (modele ?? '').toLowerCase()
  if (m.includes('haiku')) return 'haiku'
  if (m.includes('sonnet')) return 'sonnet'
  if (m.includes('opus')) return 'opus'
  if (m.includes('fable') || m.includes('mythos')) return 'fable'
  return null
}

export const REGIMES: readonly Regime[] = ['low', 'medium', 'high', 'xhigh', 'max']

export const NOM_REGIME: Record<Regime, string> = {
  low: 'faible',
  medium: 'moyen',
  high: 'élevé',
  xhigh: 'très élevé',
  max: 'maximal',
}

export function regimeDe(effort: unknown): Regime | null {
  return typeof effort === 'string' && (REGIMES as readonly string[]).includes(effort) ? (effort as Regime) : null
}

export function nomReglage(r: Reglage): string {
  const v = vitesseDe(r.modele)
  const e = regimeDe(r.effort)
  return `${v ? NOM_VITESSE[v] : (r.modele ?? 'modèle inconnu')} · effort ${e ? NOM_REGIME[e] : (r.effort ?? 'inconnu')}`
}

/**
 * Haiku a une fenêtre de 200 k jetons (référence claude-api, 25/09/2026) :
 * au-delà de 150 k, la conversation n'y tient plus avec une marge de travail.
 */
export const HAIKU_PLAFOND = 150_000

export function haikuPossible(c: Contexte): boolean {
  return c.tokens === null || c.tokens < HAIKU_PLAFOND
}

/** Ce que le conseil changerait au réglage ; un réglage inconnu compte comme différent. */
export function ecarts(conseil: Conseil | null, reglage: Reglage): { modele: boolean; effort: boolean } {
  if (conseil === null) return { modele: false, effort: false }
  return {
    modele: vitesseDe(reglage.modele) !== conseil.modele,
    effort: regimeDe(reglage.effort) !== conseil.effort,
  }
}

export type Voyant = { cle: string; nom: string; allume: boolean; couleur: string; aide: string }

export function voyants(c: Contexte, conseil: Conseil | null, reglage: Reglage): Voyant[] {
  const n = niveauDe(c.percent)
  const ec = ecarts(conseil, reglage)
  return [
    {
      cle: 'compacter',
      nom: 'Compacter',
      allume: n >= 1,
      couleur: n >= 2 ? COULEURS.orange : COULEURS.jaune,
      aide: n >= 2 ? 'à faire maintenant' : n === 1 ? 'à la fin de la tâche' : 'éteint',
    },
    { cle: 'relais', nom: 'Relais', allume: n >= 3, couleur: COULEURS.rouge, aide: n >= 3 ? 'nouvelle conversation conseillée' : 'éteint' },
    {
      cle: 'conseil',
      nom: 'Conseil',
      allume: ec.modele || ec.effort,
      couleur: COULEURS.bleu,
      aide: ec.modele || ec.effort ? 'réglage à changer' : 'réglage conforme',
    },
    {
      cle: 'sous-agent',
      nom: 'Sous-agent',
      allume: (conseil?.sousAgents.length ?? 0) > 0,
      couleur: COULEURS.vert,
      aide: (conseil?.sousAgents.length ?? 0) > 0 ? 'conseillé' : 'éteint',
    },
  ]
}

export const ETATS: readonly EtatEtape[] = ['fait', 'en cours', 'à faire']

export const MARQUE: Record<EtatEtape, string> = { fait: '✓', 'en cours': '▶', 'à faire': '○' }

/**
 * L'itinéraire : le plan donné par Claude s'il existe ; sinon les tâches,
 * les deux dernières faites, puis en cours, puis à faire.
 */
export function itineraire(
  plan: readonly Etape[],
  taches: readonly Tache[],
  max = 8,
): { lignes: Etape[]; reste: number; faites: number } {
  const faites = taches.filter((t) => t.statut === 'completed').length
  const toutes: Etape[] =
    plan.length > 0
      ? [...plan]
      : [
          ...taches
            .filter((t) => t.statut === 'completed')
            .slice(-2)
            .map((t) => ({ etape: t.sujet, etat: 'fait' as const })),
          ...taches
            .filter((t) => t.statut === 'in_progress')
            .map((t) => ({ etape: t.forme ?? t.sujet, etat: 'en cours' as const })),
          ...taches.filter((t) => t.statut === 'pending').map((t) => ({ etape: t.sujet, etat: 'à faire' as const })),
        ]
  return { lignes: toutes.slice(0, max), reste: Math.max(0, toutes.length - max), faites }
}

export type Lecture<T> = { ok: true; valeur: T } | { ok: false; erreur: string }

function texte(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null
  const t = v.replace(/\s+/g, ' ').trim()
  return t === '' ? null : t.slice(0, max)
}

/** Lit et borne ce que Claude passe à l'outil cap. */
export function lireCap(entree: Record<string, unknown>): Lecture<{ conseil: Conseil; plan: Etape[] | null }> {
  const analyse = texte(entree.analyse, 160)
  if (analyse === null) return { ok: false, erreur: 'analyse manquante' }
  const modele = entree.modele
  if (typeof modele !== 'string' || !(VITESSES as readonly string[]).includes(modele)) {
    return { ok: false, erreur: 'modele : haiku, sonnet, opus ou fable' }
  }
  const effort = regimeDe(entree.effort)
  if (effort === null) return { ok: false, erreur: 'effort : low, medium, high, xhigh ou max' }
  const pourquoi = texte(entree.pourquoi, 240)
  if (pourquoi === null) return { ok: false, erreur: 'pourquoi manquant' }

  const sousAgents: SousAgent[] = []
  if (Array.isArray(entree.sous_agents)) {
    for (const s of entree.sous_agents.slice(0, 4)) {
      const o = (s ?? {}) as Record<string, unknown>
      const type = texte(o.type, 40)
      const pour = texte(o.pour, 160)
      if (type !== null && pour !== null) sousAgents.push({ type, pour })
    }
  }

  let plan: Etape[] | null = null
  if (Array.isArray(entree.plan)) {
    plan = []
    for (const s of entree.plan.slice(0, 12)) {
      const o = (s ?? {}) as Record<string, unknown>
      const etape = texte(o.etape, 120)
      const etat = o.etat
      if (etape !== null && typeof etat === 'string' && (ETATS as readonly string[]).includes(etat)) {
        plan.push({ etape, etat: etat as EtatEtape })
      }
    }
  }

  return { ok: true, valeur: { conseil: { analyse, modele: modele as Vitesse, effort, pourquoi, sousAgents }, plan } }
}

export type Segment = { texte: string; couleur: string | null }

/** La jauge en caractères, pour le terminal : une case par 100 / cases %. */
export function jaugeTexte(percent: number | null, cases = 20): Segment[] {
  const segments: Segment[] = []
  for (let i = 0; i < cases; i++) {
    const milieu = ((i + 0.5) * 100) / cases
    const plein = percent !== null && milieu <= percent
    const couleur = plein ? couleurDe(milieu) : null
    const car = plein ? '█' : '░'
    const dernier = segments[segments.length - 1]
    if (dernier !== undefined && dernier.couleur === couleur) dernier.texte += car
    else segments.push({ texte: car, couleur })
  }
  return segments
}

function f(n: number): string {
  return (Math.round(n * 10) / 10).toString()
}

/**
 * Le cadran, comme un compte-tours : zones vert, jaune, orange, rouge,
 * allumées jusqu'au remplissage, aiguille, repère du compactage automatique.
 */
export function cadranSvg(percent: number | null, seuilAuto: number | null): string {
  const cx = 120
  const cy = 118
  const r = 92
  const ep = 16
  const pt = (v: number, rayon = r): [number, number] => {
    const a = Math.PI * (1 - Math.min(100, Math.max(0, v)) / 100)
    return [cx + rayon * Math.cos(a), cy - rayon * Math.sin(a)]
  }
  const arc = (v1: number, v2: number, couleur: string, opacite: number): string => {
    const [x1, y1] = pt(v1)
    const [x2, y2] = pt(v2)
    return `<path d="M${f(x1)} ${f(y1)} A${r} ${r} 0 0 1 ${f(x2)} ${f(y2)}" fill="none" stroke="${couleur}" stroke-width="${ep}" stroke-opacity="${opacite}"/>`
  }
  const zones: [number, number, string][] = [
    [0, SEUILS.surveiller, COULEURS.vert],
    [SEUILS.surveiller, SEUILS.compacter, COULEURS.jaune],
    [SEUILS.compacter, SEUILS.relais, COULEURS.orange],
    [SEUILS.relais, 100, COULEURS.rouge],
  ]
  const parts: string[] = []
  for (const [a, b, c] of zones) parts.push(arc(a, b, c, 0.22))
  if (percent !== null && percent > 0) {
    for (const [a, b, c] of zones) {
      if (percent > a) parts.push(arc(a, Math.min(b, percent), c, 1))
    }
  }
  for (let v = 0; v <= 100; v += 10) {
    const [x1, y1] = pt(v, r - ep / 2 - 2)
    const [x2, y2] = pt(v, r - ep / 2 - (v % 50 === 0 ? 10 : 6))
    parts.push(`<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" stroke="${COULEURS.gris}" stroke-width="${v % 50 === 0 ? 2 : 1}"/>`)
  }
  for (const v of [0, 50, 100]) {
    const [x, y] = pt(v, r - ep / 2 - 22)
    parts.push(
      `<text x="${f(x)}" y="${f(y + 4)}" font-family="system-ui, sans-serif" font-size="11" fill="${COULEURS.gris}" text-anchor="middle">${v}</text>`,
    )
  }
  if (seuilAuto !== null) {
    const [x1, y1] = pt(seuilAuto, r + ep / 2 + 4)
    const [x2, y2] = pt(seuilAuto, r - ep / 2 - 4)
    parts.push(
      `<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" stroke="${COULEURS.aiguille}" stroke-width="2" stroke-dasharray="3 2"/>`,
    )
  }
  const v = percent ?? 0
  const [nx, ny] = pt(v, r - ep - 6)
  parts.push(
    `<line x1="${cx}" y1="${cy}" x2="${f(nx)}" y2="${f(ny)}" stroke="${COULEURS.aiguille}" stroke-width="4" stroke-linecap="round"/>`,
  )
  parts.push(`<circle cx="${cx}" cy="${cy}" r="8" fill="${COULEURS.aiguille}"/>`)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 132" width="240" height="132">${parts.join('')}</svg>`
}

export function altCadran(c: Contexte): string {
  return c.percent === null
    ? 'Jauge du contexte : pas encore mesurée'
    : `Jauge du contexte : ${c.percent} % de la fenêtre${c.seuilAuto !== null ? `, compactage automatique à ${c.seuilAuto} %` : ''}`
}

export const CONSIGNES_COMPACTAGE =
  "Garde la demande en cours, les décisions prises, les consignes permanentes de l'utilisateur, l'état des tâches (fait, en cours, à faire), les fichiers et commits utiles."

export const TEXTE_RELAIS =
  "Prépare le relais vers une nouvelle conversation : objectif, état d'avancement, décisions, consignes permanentes, fichiers et commits utiles, prochaines étapes, puis le premier message à coller dans la nouvelle conversation. Écris-le dans un fichier que je peux ouvrir."

export function texteSousAgent(s: SousAgent): string {
  return `Lance un sous-agent ${s.type} pour : ${s.pour}`
}

/** Ce que l'outil cap dit au modèle. */
export const DESCRIPTION_CAP =
  "Met à jour le tableau de bord de l'utilisateur : l'analyse qui commence (ou la suivante), le modèle et l'effort conseillés pour elle, les sous-agents utiles et le plan en étapes simples. Repères : Haiku pour une lecture en masse par un sous-agent (fenêtre de 200 k) ; Sonnet pour le travail courant ; Opus pour un travail exigeant (audit, sécurité, décision) ; Fable pour le plus difficile, à un coût 2,5 fois celui d'Opus. Effort : low pour le simple, medium pour le courant, high et au-delà quand la rigueur prime. Changer de modèle fait repartir le cache de la conversation."

export const SCHEMA_CAP: Record<string, unknown> = {
  type: 'object',
  properties: {
    analyse: { type: 'string', description: "L'analyse en une ligne de mots simples." },
    modele: { type: 'string', enum: ['haiku', 'sonnet', 'opus', 'fable'] },
    effort: { type: 'string', enum: ['low', 'medium', 'high', 'xhigh', 'max'] },
    pourquoi: { type: 'string', description: 'Une phrase : pourquoi ce modèle et cet effort.' },
    sous_agents: {
      type: 'array',
      description: 'Les sous-agents utiles, quatre au plus.',
      items: {
        type: 'object',
        properties: {
          type: { type: 'string', description: 'Explore, Plan, general-purpose…' },
          pour: { type: 'string', description: 'Ce qu’il ferait, en une ligne.' },
        },
        required: ['type', 'pour'],
      },
    },
    plan: {
      type: 'array',
      description: 'Le plan en étapes courtes, en français simple, douze au plus.',
      items: {
        type: 'object',
        properties: {
          etape: { type: 'string' },
          etat: { type: 'string', enum: ['fait', 'en cours', 'à faire'] },
        },
        required: ['etape', 'etat'],
      },
    },
  },
  required: ['analyse', 'modele', 'effort', 'pourquoi'],
}

/** Ce que la section du prompt système demande au modèle. */
export const CONSIGNE_MODELE =
  "Tableau de bord de l'utilisateur (mod « tableau-de-bord ») : quand une nouvelle analyse commence, et à la fin d'un tour quand la suivante est connue, appelle l'outil mcp__tableau-de-bord__cap (charge-le avec ToolSearch s'il est différé). Donne l'analyse en une ligne de mots simples, le modèle conseillé (haiku, sonnet, opus ou fable), l'effort conseillé (low, medium, high, xhigh ou max), une phrase qui justifie ce choix, les sous-agents utiles s'il y en a, et le plan en étapes courtes avec leur état (fait, en cours, à faire). Ne l'appelle pas pour une réponse brève qui ne change pas d'analyse, ni depuis un sous-agent."

/** L'aide-mémoire du panneau : repères de la référence claude-api (modèles au 25/09/2026). */
export const AIDE_MEMOIRE = [
  '| Travail | Modèle | Effort |',
  '| --- | --- | --- |',
  '| Réponse brève, reformulation, mise en forme | Sonnet | faible |',
  '| Modification ciblée du code, tests | Sonnet ou Opus | moyen |',
  '| Audit, sécurité, décision réglementaire, architecture | Opus | élevé |',
  '| Problème très difficile, long travail autonome | Fable (coût × 2,5 / Opus) | élevé à très élevé |',
  '| Lecture en masse par un sous-agent | Haiku (200 k au plus) | faible |',
  '',
  '**Sous-agents** : Explore pour chercher dans de nombreux fichiers ; Plan pour concevoir une mise en œuvre ; général pour une recherche en plusieurs étapes ; plusieurs en parallèle pour des volets indépendants.',
  '',
  "Changer de modèle en cours de conversation fait repartir le cache : faites-le entre deux analyses. Les seuils de la jauge (50, 70 et 85 %) sont des règles d'usage, pas des mesures.",
  '',
  'Source : référence claude-api livrée avec Claude Code 2.1.289 (tarifs et fenêtres au 25/09/2026).',
].join('\n')
