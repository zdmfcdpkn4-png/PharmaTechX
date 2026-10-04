import { expect, mock, test } from 'claude-code/testing'

const PANE = {
  component: 'Pane' as const,
  requestId: 'tableau-de-bord',
  props: {
    title: 'Tableau de bord',
    isFocused: false,
    bodyColumns: 60,
    placement: 'inline' as const,
    scroll: { offset: 0, bodyRows: 60 },
    view: {},
  },
}

const BANDEAU = {
  component: 'AbovePrompt' as const,
  props: {
    hasSurvey: false,
    isWorking: false,
    maxRows: 6,
    bodyColumns: 100,
    scroll: { offset: 0, bodyRows: 6 },
    view: {},
  },
}

const PLUGIN = 'tableau-de-bord'

test('le panneau se dessine sur chaque surface', async ($) => {
  for (const surface of ['terminal', 'desktop', 'vscode', 'mobile'] as const) {
    const ui = await $.ui.mount({ plugin: PLUGIN, surface, ...PANE })
    expect(await ui.find({ key: 'compacter' })).toBeDefined()
    expect(await ui.find({ key: 'relais' })).toBeDefined()
    expect(await ui.find({ key: 'actualiser' })).toBeDefined()
    expect(await ui.find({ key: 'fermer' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Contexte —/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Claude donne ici son conseil/ })).toBeDefined()
    if (surface === 'terminal') expect(await ui.find({ type: 'Svg' })).toBeUndefined()
    else expect(await ui.find({ type: 'Svg' })).toBeDefined()
    await ui.unmount()
  }
})

test('le bandeau se dessine sur le terminal et le bureau', async ($) => {
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: PLUGIN, surface, ...BANDEAU })
    expect(await ui.find({ key: 'ouvrir' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Contexte/ })).toBeDefined()
    await ui.unmount()
  }
})

test('l’aide-mémoire s’ouvre puis se referme', async ($) => {
  for (const surface of ['terminal', 'desktop', 'mobile'] as const) {
    const ui = await $.ui.mount({ plugin: PLUGIN, surface, ...PANE })
    expect(await ui.find({ key: 'aide-memoire' })).toBeUndefined()
    await ui.press({ key: 'aide' })
    expect(await ui.find({ key: 'aide-memoire' })).toBeDefined()
    await ui.press({ key: 'aide' })
    expect(await ui.find({ key: 'aide-memoire' })).toBeUndefined()
    await ui.unmount()
  }
})

test('compacter demande une confirmation, puis lance /compact avec des consignes', async ($, on) => {
  mock.clock(on)
  const lancees: { command: string; args: string }[] = []
  on('command.run', async (_$, e) => {
    lancees.push({ command: e.command, args: e.args })
    return { text: '' }
  })
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', ...PANE })
  await ui.press({ key: 'compacter' })
  expect((await ui.find({ key: 'compacter' }))?.props.label).toBe('Confirmer : compacter')
  expect(lancees).toEqual([])
  await ui.press({ key: 'compacter' })
  expect(lancees.map((l) => l.command)).toEqual(['compact'])
  expect(lancees[0]?.args).toContain('consignes permanentes')
  expect((await ui.find({ key: 'compacter' }))?.props.label).toBe('Compacter')
  await ui.unmount()
})

test('sans confirmation, le bouton se désarme au bout de dix secondes', async ($, on) => {
  const horloge = mock.clock(on)
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', ...PANE })
  await ui.press({ key: 'compacter' })
  expect((await ui.find({ key: 'compacter' }))?.props.label).toBe('Confirmer : compacter')
  await horloge.advance(9_000)
  expect((await ui.find({ key: 'compacter' }))?.props.label).toBe('Confirmer : compacter')
  await horloge.advance(1_000)
  expect((await ui.find({ key: 'compacter' }))?.props.label).toBe('Compacter')
  await ui.unmount()
})

test('le conseil de Claude s’affiche, et « Appliquer » lance /model puis /effort', async ($, on) => {
  const lancees: string[] = []
  on('command.run', async (_$, e) => {
    lancees.push(`${e.command} ${e.args}`)
    return { text: '' }
  })
  const reponse = await $.tool.call({
    tool: 'mcp__tableau-de-bord__cap',
    analyse: 'Relire les tests du mod',
    modele: 'sonnet',
    effort: 'medium',
    pourquoi: 'Travail courant, sans enjeu de décision.',
    sous_agents: [{ type: 'Explore', pour: 'trouver les fichiers de test' }],
    plan: [
      { etape: 'Écrire le mod', etat: 'fait' },
      { etape: 'Tester le mod', etat: 'en cours' },
      { etape: 'Le présenter', etat: 'à faire' },
    ],
  })
  expect(reponse.result).toBe('Tableau de bord mis à jour.')
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', ...PANE })
  expect(await ui.find({ type: 'Text', text: /Relire les tests du mod/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Conseil : Sonnet · effort moyen/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /▶ Tester le mod/ })).toBeDefined()
  expect(await ui.find({ key: 'lancer-0' })).toBeDefined()
  await ui.press({ key: 'appliquer' })
  expect(lancees).toEqual(['model sonnet', 'effort medium'])
  await ui.unmount()
})

test('un conseil hors cadre est refusé et ne change rien', async ($) => {
  const reponse = await $.tool.call({ tool: 'mcp__tableau-de-bord__cap', analyse: 'x', modele: 'gpt', effort: 'low', pourquoi: 'p' })
  expect(String(reponse.result)).toContain('Refusé')
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', ...PANE })
  expect(await ui.find({ type: 'Text', text: /Claude donne ici son conseil/ })).toBeDefined()
  await ui.unmount()
})
