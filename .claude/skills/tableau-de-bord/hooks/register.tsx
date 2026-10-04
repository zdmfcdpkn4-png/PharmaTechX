import { atom, read, update } from 'claude-code'
import type { Elements, EngineInterface, Register } from 'claude-code'

import type { Arme, Conseil, Contexte, Etape, Reglage, SousAgent, Tache } from '../types'
import {
  AIDE_MEMOIRE,
  CONSIGNE_MODELE,
  CONSIGNES_COMPACTAGE,
  CONTEXTE_VIDE,
  COULEURS,
  DESCRIPTION_CAP,
  MARQUE,
  NOM_REGIME,
  NOM_VITESSE,
  SCHEMA_CAP,
  TEXTE_RELAIS,
  altCadran,
  cadranSvg,
  consigne,
  couleurDe,
  ecarts,
  formatJetons,
  haikuPossible,
  itineraire,
  jaugeTexte,
  lireCap,
  memeContexte,
  niveauDe,
  nomReglage,
  texteSousAgent,
  voyants,
} from './logique'

type Moteur = EngineInterface
type TextEl = Elements['mobile']['Text']
type BoxEl = Elements['mobile']['Box']

const PANE = 'tableau-de-bord'
const TITRE = 'Tableau de bord'

const contexte = atom({ plugin: 'tableau-de-bord', key: 'contexte' } as const, CONTEXTE_VIDE)
const reglage = atom({ plugin: 'tableau-de-bord', key: 'reglage' } as const, { modele: null, effort: null } as Reglage)
const conseil = atom({ plugin: 'tableau-de-bord', key: 'conseil' } as const, null as Conseil | null)
const plan = atom({ plugin: 'tableau-de-bord', key: 'plan' } as const, [] as Etape[])
const taches = atom({ plugin: 'tableau-de-bord', key: 'taches' } as const, [] as Tache[])
const arme = atom({ plugin: 'tableau-de-bord', key: 'arme' } as const, null as Arme | null)
const aide = atom({ plugin: 'tableau-de-bord', key: 'aide' } as const, false)
const alerte = atom({ plugin: 'tableau-de-bord', key: 'alerte' } as const, 0)

function pourcent(c: Contexte): string {
  return c.percent === null ? '—' : `${c.percent} %`
}

/** Lit le remplissage (appel gratuit) ; avec le seuil, une estimation locale de /context. */
async function lireContexte($: Moteur, avecSeuil = false): Promise<Contexte> {
  const avant = await read($, contexte)
  const usage = avecSeuil ? await $.session.usage({ breakdown: 'summary' }) : await $.session.usage()
  const c = usage.context
  let seuilAuto = avant.seuilAuto
  if (avecSeuil) {
    const b = c.breakdown
    seuilAuto =
      b !== undefined && b.isAutoCompactEnabled && typeof b.autoCompactThreshold === 'number' && c.window > 0
        ? Math.round((100 * b.autoCompactThreshold) / c.window)
        : null
  }
  const nouveau: Contexte = {
    percent: c.percent ?? null,
    tokens: c.tokens ?? null,
    fenetre: c.window > 0 ? c.window : null,
    seuilAuto,
  }
  if (!memeContexte(avant, nouveau)) await update($, contexte, () => nouveau)
  $.ui.status(nouveau.percent === null ? undefined : `Contexte ${nouveau.percent} %`)
  return nouveau
}

/** Une alerte quand le niveau monte ; le niveau suit quand il redescend (compactage). */
async function alerter($: Moteur, c: Contexte): Promise<void> {
  const n = niveauDe(c.percent)
  const deja = await read($, alerte)
  if (n > deja) $.ui.toast(consigne(c), { timeoutMs: 8000 })
  if (n !== deja) await update($, alerte, () => n)
}

async function noterReglage($: Moteur, modele: string, effort: unknown): Promise<void> {
  const e = effort === undefined || effort === null ? null : String(effort)
  const r = await read($, reglage)
  if (r.modele !== modele || r.effort !== e) await update($, reglage, () => ({ modele, effort: e }))
}

let peutLister: boolean | null = null

/** La liste complète des tâches, si TaskList passe sans demande d'autorisation. */
async function rafraichirTaches($: Moteur): Promise<void> {
  try {
    if (peutLister === null) {
      const d = await $.tool.check({ tool: 'TaskList', input: {} })
      peutLister = d.decision === 'allow'
    }
    if (!peutLister) return
    const r = await $.tool.call({ tool: 'TaskList' })
    if (r.deny !== undefined || r.isError === true) return
    const res = r.result as { tasks?: { id: string; subject: string; status: string }[] } | undefined
    const liste = res?.tasks
    if (!Array.isArray(liste)) return
    await update($, taches, (avant) =>
      liste
        .filter((t) => t.status === 'pending' || t.status === 'in_progress' || t.status === 'completed')
        .map((t) => ({
          id: t.id,
          sujet: t.subject,
          statut: t.status as Tache['statut'],
          forme: avant.find((a) => a.id === t.id)?.forme ?? null,
        })),
    )
  } catch {
    peutLister = false
  }
}

/** Premier appui : arme le bouton dix secondes ; second appui : vrai. */
async function armer($: Moteur, action: Arme['action']): Promise<boolean> {
  const a = await read($, arme)
  if (a !== null && a.action === action) {
    await update($, arme, () => null)
    return true
  }
  await update($, arme, () => ({ action }))
  $.clock.after(10_000, () => {
    void update($, arme, (x) => (x !== null && x.action === action ? null : x))
  })
  return false
}

async function presserCompacter($: Moteur): Promise<void> {
  if (!(await armer($, 'compacter'))) return
  $.ui.toast('Compactage demandé : il part dès que Claude a fini son tour.', { timeoutMs: 6000 })
  void $.command.run({ command: 'compact', args: CONSIGNES_COMPACTAGE }).catch(() => {
    $.ui.toast('Compactage refusé : tapez /compact.', { timeoutMs: 6000 })
  })
}

async function presserRelais($: Moteur): Promise<void> {
  if (!(await armer($, 'relais'))) return
  $.ui.toast('Relais demandé : Claude le prépare au prochain tour.', { timeoutMs: 6000 })
  void $.prompt.submit({ text: TEXTE_RELAIS }).catch(() => {
    $.ui.toast('Demande de relais refusée.', { timeoutMs: 6000 })
  })
}

async function appliquer($: Moteur): Promise<void> {
  const c = await read($, conseil)
  if (c === null) return
  const r = await read($, reglage)
  const ctx = await read($, contexte)
  const ec = ecarts(c, r)
  const faits: string[] = []
  if (ec.modele) {
    if (c.modele === 'haiku' && !haikuPossible(ctx)) {
      $.ui.toast("Haiku ne tient que 200 k jetons : compactez d'abord.", { timeoutMs: 6000 })
    } else {
      faits.push(NOM_VITESSE[c.modele])
      void $.command
        .run({ command: 'model', args: c.modele })
        .then(async () => {
          // Le modèle réellement engagé, relu ; l'effort se relit au tour suivant.
          try {
            await noterReglage($, await $.session.model(), (await read($, reglage)).effort)
          } catch {
            /* relu au prochain tour */
          }
        })
        .catch(() => $.ui.toast(`/model ${c.modele} refusé.`, { timeoutMs: 6000 }))
    }
  }
  if (ec.effort) {
    faits.push(`effort ${NOM_REGIME[c.effort]}`)
    void $.command
      .run({ command: 'effort', args: c.effort })
      .catch(() => $.ui.toast(`/effort ${c.effort} refusé.`, { timeoutMs: 6000 }))
  }
  if (faits.length > 0) {
    $.ui.toast(`Réglage demandé : ${faits.join(' · ')}. Il s'applique au prochain tour.`, { timeoutMs: 6000 })
  }
}

function lancerSousAgent($: Moteur, s: SousAgent): void {
  $.ui.toast(`Demande envoyée : sous-agent ${s.type}.`, { timeoutMs: 4000 })
  void $.prompt.submit({ text: texteSousAgent(s) }).catch(() => {
    $.ui.toast('Demande refusée.', { timeoutMs: 6000 })
  })
}

async function actualiser($: Moteur): Promise<void> {
  const c = await lireContexte($, true)
  await alerter($, c)
  await rafraichirTaches($)
  $.ui.toast('Tableau de bord actualisé.', { timeoutMs: 2500 })
}

function ouvrir($: Moteur): Promise<unknown> {
  return $.ui.open({ id: PANE, title: TITRE })
}

/** La jauge en caractères colorés (terminal, bandeau). */
function jauge(Box: BoxEl, Text: TextEl, percent: number | null, cases: number) {
  return (
    <Box flexDirection="row">
      {jaugeTexte(percent, cases).map((s) =>
        s.couleur === null ? <Text dimColor>{s.texte}</Text> : <Text color={s.couleur}>{s.texte}</Text>,
      )}
    </Box>
  )
}

export const register: Register = (on) => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'tableau',
      description: "Ouvre le tableau de bord : contexte, voyants, itinéraire, conseil de modèle et d'effort",
    })
    await $.tool.register({ name: 'cap', description: DESCRIPTION_CAP, inputSchema: SCHEMA_CAP })
    try {
      await noterReglage($, await $.session.model(), (await read($, reglage)).effort ?? undefined)
      const c = await lireContexte($, true)
      await update($, alerte, () => niveauDe(c.percent))
    } catch {
      /* la jauge se remplira au premier tour */
    }
    void rafraichirTaches($)
    void ouvrir($)
    return next(e)
  })

  on('command.run', { command: 'tableau' }, async ($) => {
    await ouvrir($)
    return { text: 'Tableau de bord ouvert.' }
  })

  on('prompt.compose', async ($, e, next) => {
    const r = await next(e)
    return { sections: [...r.sections, { id: 'tableau-de-bord', text: CONSIGNE_MODELE, scope: 'session' as const }] }
  })

  on('turn.step', async function* ($, e, next) {
    const principal = e.agentId === undefined
    if (principal) {
      try {
        await noterReglage($, e.model, e.effort)
      } catch {
        /* sans effet sur la requête */
      }
    }
    const reponse = yield* next(e)
    if (principal) {
      try {
        await lireContexte($)
      } catch {
        /* la jauge attendra le tour suivant */
      }
    }
    return reponse
  })

  on('turn.complete', async ($, e, next) => {
    const r = await next(e)
    if (e.agentId === undefined) {
      try {
        await alerter($, await lireContexte($))
      } catch {
        /* rien à annoncer */
      }
    }
    return r
  })

  on('session.compact', async ($, e, next) => {
    const r = await next(e)
    if (r.skip === undefined && e.trigger !== 'precompute') {
      const avant = await read($, contexte)
      const apres = typeof r.tokensAfter === 'number' ? r.tokensAfter : null
      if (apres !== null && avant.fenetre !== null) {
        const c: Contexte = { ...avant, tokens: apres, percent: Math.round((100 * apres) / avant.fenetre) }
        await update($, contexte, () => c)
        await update($, alerte, () => niveauDe(c.percent))
        $.ui.status(`Contexte ${c.percent} %`)
        $.ui.toast(`Compactage fait : contexte à environ ${c.percent} %.`, { timeoutMs: 6000 })
      } else {
        await update($, alerte, () => 0)
        $.ui.toast('Compactage fait : la jauge se remet à jour au prochain tour.', { timeoutMs: 6000 })
      }
    }
    return r
  })

  on('tool.call', { tool: 'TaskCreate' }, async ($, e, next) => {
    const r = await next(e)
    if (r.deny === undefined && r.isError !== true) {
      const t = (r.result as { task?: { id: string; subject: string } } | undefined)?.task
      if (t !== undefined) {
        const nouvelle: Tache = { id: t.id, sujet: t.subject, statut: 'pending', forme: e.activeForm ?? null }
        await update($, taches, (l) => [...l.filter((x) => x.id !== t.id), nouvelle])
      }
    }
    return r
  })

  on('tool.call', { tool: 'TaskUpdate' }, async ($, e, next) => {
    const r = await next(e)
    if (r.deny === undefined && r.isError !== true) {
      await update($, taches, (l) => {
        if (e.status === 'deleted') return l.filter((x) => x.id !== e.taskId)
        const trouve = l.find((x) => x.id === e.taskId)
        const base: Tache = trouve ?? { id: e.taskId, sujet: e.subject ?? `Tâche ${e.taskId}`, statut: 'pending', forme: null }
        const maj: Tache = {
          ...base,
          sujet: e.subject ?? base.sujet,
          statut: e.status ?? base.statut,
          forme: e.activeForm ?? base.forme,
        }
        return trouve !== undefined ? l.map((x) => (x.id === e.taskId ? maj : x)) : [...l, maj]
      })
    }
    return r
  })

  on('tool.call', { tool: 'mcp__tableau-de-bord__cap' }, async ($, e) => {
    const lu = lireCap(e as unknown as Record<string, unknown>)
    if (!lu.ok) return { result: `Refusé : ${lu.erreur}.` }
    await update($, conseil, () => lu.valeur.conseil)
    if (lu.valeur.plan !== null) {
      const p = lu.valeur.plan
      await update($, plan, () => p)
    }
    $.ui.toast(
      `Conseil : ${NOM_VITESSE[lu.valeur.conseil.modele]} · effort ${NOM_REGIME[lu.valeur.conseil.effort]}`,
      { timeoutMs: 5000 },
    )
    return { result: 'Tableau de bord mis à jour.' }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const ctx = await read($, contexte)
    const reg = await read($, reglage)
    const cons = await read($, conseil)
    const pl = await read($, plan)
    const ta = await read($, taches)
    const am = await read($, arme)
    const ai = await read($, aide)

    const n = niveauDe(ctx.percent)
    const ec = ecarts(cons, reg)
    const vs = voyants(ctx, cons, reg)
    const it = itineraire(pl, ta)
    const armeC = am !== null && am.action === 'compacter'
    const armeR = am !== null && am.action === 'relais'
    const couleurPct = ctx.percent === null ? COULEURS.gris : couleurDe(ctx.percent)

    const { Box, Text, Button, Markdown } = $.ui.resolve(e)
    const cadran =
      e.surface === 'terminal' ? (
        jauge(Box, Text, ctx.percent, 24)
      ) : (
        (() => {
          const { Svg } = $.ui.resolve(e)
          return <Svg source={cadranSvg(ctx.percent, ctx.seuilAuto)} alt={altCadran(ctx)} width={220} />
        })()
      )

    return (
      <Box flexDirection="column" gap={1}>
        <Box flexDirection="row" flexWrap="wrap" columnGap={3} rowGap={1} alignItems="center">
          {cadran}
          <Box flexDirection="column">
            <Text bold color={couleurPct}>
              Contexte {pourcent(ctx)}
            </Text>
            <Text dimColor>
              {formatJetons(ctx.tokens)} sur {formatJetons(ctx.fenetre)} jetons
            </Text>
            {ctx.seuilAuto !== null && <Text dimColor>Compactage automatique à {ctx.seuilAuto} %</Text>}
            <Text>Réglage : {nomReglage(reg)}</Text>
          </Box>
        </Box>

        <Box flexDirection="row" flexWrap="wrap" columnGap={2}>
          {vs.map((v) => (
            <Box key={`voyant-${v.cle}`} flexDirection="row">
              {v.allume ? <Text color={v.couleur}>●</Text> : <Text dimColor>○</Text>}
              <Text dimColor={!v.allume}> {v.nom}</Text>
            </Box>
          ))}
        </Box>

        <Text>{consigne(ctx)}</Text>
        <Box flexDirection="row" flexWrap="wrap" gap={1}>
          <Button
            key="compacter"
            label={armeC ? 'Confirmer : compacter' : 'Compacter'}
            hotkey="c"
            variant={n >= 2 || armeC ? 'primary' : 'secondary'}
            onPress={() => presserCompacter($)}
          />
          <Button
            key="relais"
            label={armeR ? 'Confirmer : relais' : 'Préparer le relais'}
            hotkey="r"
            variant={n >= 3 || armeR ? 'primary' : 'secondary'}
            onPress={() => presserRelais($)}
          />
        </Box>

        <Text bold>Prochaine analyse</Text>
        {cons === null ? (
          <Text dimColor>Claude donne ici son conseil avant chaque nouvelle analyse.</Text>
        ) : (
          <Box flexDirection="column">
            <Text>{cons.analyse}</Text>
            <Text color={COULEURS.bleu}>
              Conseil : {NOM_VITESSE[cons.modele]} · effort {NOM_REGIME[cons.effort]}
            </Text>
            <Text dimColor>{cons.pourquoi}</Text>
            {ec.modele || ec.effort ? (
              <Box flexDirection="row">
                <Button key="appliquer" label="Appliquer le conseil" hotkey="a" variant="primary" onPress={() => appliquer($)} />
              </Box>
            ) : (
              <Text color={COULEURS.vert}>Réglage déjà conforme au conseil.</Text>
            )}
            {cons.modele === 'haiku' && !haikuPossible(ctx) && (
              <Text color={COULEURS.orange}>Haiku ne tient que 200 k jetons : compactez avant de l'engager.</Text>
            )}
            {cons.sousAgents.length > 0 && <Text bold>Sous-agents conseillés</Text>}
            {cons.sousAgents.map((s, i) => (
              <Box key={`sous-agent-${i}`} flexDirection="row" flexWrap="wrap" columnGap={1}>
                <Text>
                  {s.type} : {s.pour}
                </Text>
                <Button key={`lancer-${i}`} label="Lancer" onPress={() => lancerSousAgent($, s)} />
              </Box>
            ))}
          </Box>
        )}

        <Text bold>Itinéraire{it.faites > 0 ? ` (${it.faites} tâches faites)` : ''}</Text>
        {it.lignes.length === 0 && <Text dimColor>Aucune étape en cours ni à faire.</Text>}
        {it.lignes.map((l) =>
          l.etat === 'en cours' ? (
            <Text color={COULEURS.bleu}>
              {MARQUE[l.etat]} {l.etape}
            </Text>
          ) : (
            <Text dimColor={l.etat === 'fait'}>
              {MARQUE[l.etat]} {l.etape}
            </Text>
          ),
        )}
        {it.reste > 0 && <Text dimColor>… et {it.reste} autres étapes</Text>}

        <Box flexDirection="row" flexWrap="wrap" gap={1}>
          <Button key="actualiser" label="Actualiser" hotkey="u" onPress={() => actualiser($)} />
          <Button
            key="aide"
            label={ai ? "Masquer l'aide-mémoire" : 'Aide-mémoire'}
            hotkey="m"
            onPress={() => update($, aide, (x) => !x)}
          />
          <Button key="fermer" label="Fermer" role="dismiss" onPress={() => $.ui.close({ id: PANE })} />
        </Box>
        {ai && <Markdown key="aide-memoire" text={AIDE_MEMOIRE} />}
      </Box>
    )
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const ctx = await read($, contexte)
    const reg = await read($, reglage)
    const cons = await read($, conseil)
    const am = await read($, arme)
    const n = niveauDe(ctx.percent)
    const ec = ecarts(cons, reg)
    const armeC = am !== null && am.action === 'compacter'
    const { Box, Text, Button } = $.ui.resolve(e)
    return (
      <Box flexDirection="row" flexWrap="wrap" columnGap={1} alignItems="center">
        <Text>Contexte</Text>
        {jauge(Box, Text, ctx.percent, 10)}
        <Text bold color={ctx.percent === null ? COULEURS.gris : couleurDe(ctx.percent)}>
          {pourcent(ctx)}
        </Text>
        <Text dimColor>· {nomReglage(reg)}</Text>
        {n >= 1 && <Text color={couleurDe(ctx.percent ?? 0)}>● {n >= 3 ? 'Relais' : 'Compacter'}</Text>}
        {cons !== null && (ec.modele || ec.effort) && (
          <Text color={COULEURS.bleu}>
            ● Conseil : {NOM_VITESSE[cons.modele]} · {NOM_REGIME[cons.effort]}
          </Text>
        )}
        <Button key="ouvrir" label="Tableau" hotkey="t" onPress={() => ouvrir($)} />
        {n >= 2 && (
          <Button
            key="bandeau-compacter"
            label={armeC ? 'Confirmer : compacter' : 'Compacter'}
            onPress={() => presserCompacter($)}
          />
        )}
      </Box>
    )
  })
}
