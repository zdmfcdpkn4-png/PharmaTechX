import { expect, test } from 'claude-code/testing'

import {
  CONTEXTE_VIDE,
  cadranSvg,
  consigne,
  ecarts,
  formatJetons,
  haikuPossible,
  itineraire,
  jaugeTexte,
  lireCap,
  niveauDe,
  regimeDe,
  vitesseDe,
  voyants,
} from '../hooks/logique'

test('le niveau suit les seuils 50, 70 et 85 %', () => {
  expect(niveauDe(null)).toBe(0)
  expect(niveauDe(49)).toBe(0)
  expect(niveauDe(50)).toBe(1)
  expect(niveauDe(69)).toBe(1)
  expect(niveauDe(70)).toBe(2)
  expect(niveauDe(84)).toBe(2)
  expect(niveauDe(85)).toBe(3)
  expect(niveauDe(100)).toBe(3)
})

test('la consigne dit quoi faire, et prévient du compactage automatique', () => {
  expect(consigne(CONTEXTE_VIDE)).toContain('pas encore mesuré')
  expect(consigne({ ...CONTEXTE_VIDE, percent: 20 })).toContain('confortable')
  expect(consigne({ ...CONTEXTE_VIDE, percent: 55 })).toContain('finissez la tâche en cours')
  expect(consigne({ ...CONTEXTE_VIDE, percent: 72 })).toContain('compactez maintenant')
  expect(consigne({ ...CONTEXTE_VIDE, percent: 90 })).toContain('relais')
  expect(consigne({ ...CONTEXTE_VIDE, percent: 75, seuilAuto: 80 })).toContain('automatique part à 80 %')
  expect(consigne({ ...CONTEXTE_VIDE, percent: 60, seuilAuto: 80 })).not.toContain('automatique')
  expect(consigne({ ...CONTEXTE_VIDE, percent: 85, seuilAuto: 80 })).not.toContain('automatique')
})

test('les jetons se lisent en k et en M', () => {
  expect(formatJetons(null)).toBe('—')
  expect(formatJetons(950)).toBe('950')
  expect(formatJetons(620_400)).toBe('620 k')
  expect(formatJetons(1_000_000)).toBe('1 M')
  expect(formatJetons(1_240_000)).toBe('1,2 M')
})

test('modèle et effort sont reconnus par leur nom', () => {
  expect(vitesseDe('claude-opus-x-y')).toBe('opus')
  expect(vitesseDe('claude-sonnet-x-y')).toBe('sonnet')
  expect(vitesseDe('claude-haiku-x-y-aaaammjj')).toBe('haiku')
  expect(vitesseDe('claude-fable-x-y')).toBe('fable')
  expect(vitesseDe(null)).toBeNull()
  expect(regimeDe('xhigh')).toBe('xhigh')
  expect(regimeDe(3)).toBeNull()
  expect(regimeDe('fort')).toBeNull()
})

test('les écarts comparent le conseil au réglage ; Haiku refusé au-delà de 150 k', () => {
  const conseil = { analyse: 'a', modele: 'sonnet' as const, effort: 'medium' as const, pourquoi: 'p', sousAgents: [] }
  expect(ecarts(null, { modele: 'claude-opus-x-y', effort: 'high' })).toEqual({ modele: false, effort: false })
  expect(ecarts(conseil, { modele: 'claude-opus-x-y', effort: 'medium' })).toEqual({ modele: true, effort: false })
  expect(ecarts(conseil, { modele: 'claude-sonnet-x-y', effort: 'medium' })).toEqual({ modele: false, effort: false })
  expect(ecarts(conseil, { modele: null, effort: null })).toEqual({ modele: true, effort: true })
  expect(haikuPossible({ ...CONTEXTE_VIDE, tokens: 149_999 })).toBe(true)
  expect(haikuPossible({ ...CONTEXTE_VIDE, tokens: 150_000 })).toBe(false)
  expect(haikuPossible(CONTEXTE_VIDE)).toBe(true)
})

test('les voyants s’allument selon le niveau et le conseil', () => {
  const conseil = {
    analyse: 'a',
    modele: 'sonnet' as const,
    effort: 'medium' as const,
    pourquoi: 'p',
    sousAgents: [{ type: 'Explore', pour: 'chercher' }],
  }
  const allumes = (p: number | null) =>
    voyants({ ...CONTEXTE_VIDE, percent: p }, conseil, { modele: 'claude-opus-x-y', effort: 'medium' })
      .filter((v) => v.allume)
      .map((v) => v.cle)
  expect(allumes(10)).toEqual(['conseil', 'sous-agent'])
  expect(allumes(60)).toEqual(['compacter', 'conseil', 'sous-agent'])
  expect(allumes(90)).toEqual(['compacter', 'relais', 'conseil', 'sous-agent'])
})

test('lireCap borne et refuse ce qui sort du cadre', () => {
  expect(lireCap({}).ok).toBe(false)
  expect(lireCap({ analyse: 'x', modele: 'gpt', effort: 'low', pourquoi: 'p' }).ok).toBe(false)
  expect(lireCap({ analyse: 'x', modele: 'opus', effort: 'fort', pourquoi: 'p' }).ok).toBe(false)
  expect(lireCap({ analyse: 'x', modele: 'opus', effort: 'high' }).ok).toBe(false)
  const lu = lireCap({
    analyse: '  Mettre à jour   l’audit ',
    modele: 'opus',
    effort: 'high',
    pourquoi: 'Décision qui engage.',
    sous_agents: [{ type: 'Explore', pour: 'trouver les fichiers' }, { type: 'Plan' }, 4],
    plan: [
      { etape: 'Lire', etat: 'fait' },
      { etape: 'Écrire', etat: 'en cours' },
      { etape: 'Vérifier', etat: 'peut-être' },
    ],
  })
  expect(lu.ok).toBe(true)
  if (lu.ok) {
    expect(lu.valeur.conseil.analyse).toBe('Mettre à jour l’audit')
    expect(lu.valeur.conseil.sousAgents).toEqual([{ type: 'Explore', pour: 'trouver les fichiers' }])
    expect(lu.valeur.plan).toEqual([
      { etape: 'Lire', etat: 'fait' },
      { etape: 'Écrire', etat: 'en cours' },
    ])
  }
})

test('l’itinéraire prend le plan, sinon les tâches dans l’ordre de la route', () => {
  const taches = [
    { id: '1', sujet: 'A', statut: 'completed' as const, forme: null },
    { id: '2', sujet: 'B', statut: 'completed' as const, forme: null },
    { id: '3', sujet: 'C', statut: 'completed' as const, forme: null },
    { id: '4', sujet: 'D', statut: 'pending' as const, forme: null },
    { id: '5', sujet: 'E', statut: 'in_progress' as const, forme: 'Écriture de E' },
  ]
  const it = itineraire([], taches)
  expect(it.faites).toBe(3)
  expect(it.lignes).toEqual([
    { etape: 'B', etat: 'fait' },
    { etape: 'C', etat: 'fait' },
    { etape: 'Écriture de E', etat: 'en cours' },
    { etape: 'D', etat: 'à faire' },
  ])
  const plan = [{ etape: 'Une', etat: 'à faire' as const }]
  expect(itineraire(plan, taches).lignes).toEqual(plan)
  expect(itineraire([], taches, 2).reste).toBe(2)
})

test('la jauge en caractères a toujours ses cases, colorées jusqu’au remplissage', () => {
  const total = (p: number | null) =>
    jaugeTexte(p, 20)
      .map((s) => s.texte)
      .join('')
  expect(total(null)).toBe('░'.repeat(20))
  expect(total(50)).toBe('█'.repeat(10) + '░'.repeat(10))
  expect(total(100)).toBe('█'.repeat(20))
  const couleurs = jaugeTexte(100, 20).map((s) => s.couleur)
  expect(couleurs).toEqual(['#2e9e5b', '#a67c00', '#d35f00', '#d93025'])
})

test('le cadran est un SVG valide, sans NaN, aiguille comprise', () => {
  for (const p of [null, 0, 37, 72, 100]) {
    const svg = cadranSvg(p, 80)
    expect(svg.startsWith('<svg')).toBe(true)
    expect(svg.endsWith('</svg>')).toBe(true)
    expect(svg).not.toContain('NaN')
    expect(svg).toContain('stroke-dasharray')
  }
  expect(cadranSvg(30, null)).not.toContain('stroke-dasharray')
})
