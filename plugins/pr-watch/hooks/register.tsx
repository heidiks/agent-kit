import { atom, read, update } from 'claude-code'
import type { EngineInterface, PluginOptions, Register, Timer } from 'claude-code'

import type { BandStyle, Tone, WatchedPr } from '../types'
import { adoKey, applyCheck, describe, ICONS, mergeLists, overallState, parsePrId, pollDelay, SPINNER } from './ado'
import { githubKey, parseGithubRef } from './github'
import { checkPr, currentBranchSeeds, investigatePrompt, isEnabled, type Io, type Seed, type Settings } from './providers'
import { BAND_STYLES, LEGACY_STYLES, renderBand, tally, toneOf } from './view'

const TICK_MS = 5_000
const SPINNER_MS = 120
const STORE_KEY = 'prs'
const STYLE_KEY = 'style'
const prs = atom({ plugin: 'pr-watch', key: 'prs' } as const, [])
const frame = atom({ plugin: 'pr-watch', key: 'frame' } as const, 0)
const isCollapsed = atom({ plugin: 'pr-watch', key: 'isCollapsed' } as const, false)
const isHidden = atom({ plugin: 'pr-watch', key: 'isHidden' } as const, false)
const style = atom({ plugin: 'pr-watch', key: 'style' } as const, 'table' as BandStyle)
const tone = atom({ plugin: 'pr-watch', key: 'tone' } as const, 'unknown' as Tone)

let spinner: Timer | undefined
let isRefreshing = false
const nextAt = new Map<string, number>()

function ioOf($: EngineInterface): Io {
  return {
    run: argv => $.process.run(argv, { timeoutMs: 60_000 }),
    now: () => $.clock.now(),
  }
}

function readSettings(options: PluginOptions): Settings {
  const hosts = String(options.githubHosts ?? 'github.com')
    .split(',')
    .map(h => h.trim().toLowerCase())
    .filter(Boolean)

  return {
    ado: options.ado !== false,
    github: options.github !== false,
    githubHosts: hosts.length > 0 ? hosts : ['github.com'],
    details: options.details !== false,
    currentBranch: options.currentBranch !== false,
  }
}

function parseTarget(text: string, settings: Settings): Seed | undefined {
  const trimmed = text.trim()
  const github = parseGithubRef(trimmed, settings.githubHosts)
  if (github) {
    return { key: githubKey(github), provider: 'github', id: github.number, host: github.host, owner: github.owner, repo: github.repo }
  }
  const adoId = /^\d+$/.test(trimmed) ? Number(trimmed) : /dev\.azure\.com|visualstudio\.com/.test(trimmed) ? parsePrId(trimmed) : undefined
  if (adoId) {
    return { key: adoKey(adoId), provider: 'ado', id: adoId, repo: '' }
  }

  return undefined
}

function heading(pr: WatchedPr): string {
  return [ICONS[overallState(pr.checks, pr.phase)], label(pr), pr.provider === 'ado' ? pr.repo : ''].filter(Boolean).join(' ')
}

function label(pr: Pick<WatchedPr, 'provider' | 'id' | 'owner' | 'repo'>): string {
  return pr.provider === 'github' ? `${pr.owner}/${pr.repo}#${pr.id}` : `PR ${pr.id}`
}

async function visible($: EngineInterface, settings: Settings): Promise<WatchedPr[]> {
  return (await read($, prs)).filter(p => isEnabled(p, settings))
}

async function save($: EngineInterface): Promise<void> {
  await $.store.set(STORE_KEY, await read($, prs))
}

async function syncSpinner($: EngineInterface, settings: Settings): Promise<void> {
  const hasRunning = (await visible($, settings)).some(p => overallState(p.checks, p.phase) === 'running')
  if (hasRunning && !spinner) {
    spinner = $.clock.every(SPINNER_MS, () => void update($, frame, n => (n + 1) % SPINNER.length))
  }
  if (!hasRunning && spinner) {
    spinner.cancel()
    spinner = undefined
  }
}

async function syncStatus($: EngineInterface, settings: Settings): Promise<void> {
  const list = await visible($, settings)
  if (!(await read($, isHidden)) || list.length === 0) {
    $.ui.status(undefined)
    return
  }
  const counts = tally(list.map(p => overallState(p.checks, p.phase)))
  const parts = (['fail', 'running', 'pending', 'queued', 'ok'] as const)
    .filter(s => counts[s])
    .map(s => `${ICONS[s]}${counts[s]}`)
  $.ui.status(`PRs ${parts.join(' ')}`)
}

async function refresh($: EngineInterface, settings: Settings): Promise<void> {
  if (isRefreshing) {
    return
  }
  isRefreshing = true
  try {
    const now = await $.clock.now()
    const due = (await visible($, settings)).filter(p => !p.isDone && (nextAt.get(p.key) ?? 0) <= now)

    for (const pr of due) {
      const result = await checkPr(ioOf($), pr, settings)
      const checkedAt = await $.clock.now()
      const { next, isChanged } = applyCheck(pr, result, checkedAt)
      if (isChanged) {
        $.ui.toast(`${heading(next)} · ${describe(next.phase, next.checks)}`, { timeoutMs: 8000 })
      }
      nextAt.set(pr.key, checkedAt + pollDelay(next))
      await update($, prs, list => list.map(p => (p.key === pr.key ? next : p)))
    }
    if (due.length > 0) {
      await save($)
    }
  } finally {
    isRefreshing = false
  }
  await syncSpinner($, settings)
  await syncStatus($, settings)
}

async function watch($: EngineInterface, seed: Seed, settings: Settings): Promise<'added' | 'known' | 'disabled'> {
  if (!isEnabled(seed, settings)) {
    return 'disabled'
  }
  if ((await read($, prs)).some(p => p.key === seed.key)) {
    return 'known'
  }
  const added: WatchedPr = {
    ...seed, project: '', title: '', url: '', phase: 'loading', checks: [],
    isDraft: false, isFailed: false, isDone: false,
  }
  await update($, prs, current => [...current, added])
  nextAt.set(seed.key, 0)
  await save($)
  await syncSpinner($, settings)
  $.clock.after(0, () => void refresh($, settings))

  return 'added'
}

async function remove($: EngineInterface, keep: (pr: WatchedPr) => boolean, settings: Settings): Promise<void> {
  await update($, prs, list => list.filter(keep))
  await save($)
  await syncSpinner($, settings)
  await syncStatus($, settings)
}

function normalize(pr: WatchedPr): WatchedPr {
  return {
    ...pr,
    key: pr.key ?? adoKey(pr.id),
    provider: pr.provider ?? 'ado',
    project: pr.project ?? '',
    url: pr.url ?? '',
    checks: pr.checks ?? [],
    phase: pr.phase ?? 'loading',
    isDraft: pr.isDraft ?? false,
  }
}

async function setStyle($: EngineInterface, next: BandStyle): Promise<void> {
  await update($, style, () => next)
  await $.store.set(STYLE_KEY, next)
}

async function cycleStyle($: EngineInterface): Promise<void> {
  const current = await read($, style)
  await setStyle($, BAND_STYLES[(BAND_STYLES.indexOf(current) + 1) % BAND_STYLES.length] ?? 'table')
}

const WATCH_ANSWERS = {
  added: (name: string) => `Watching ${name}.`,
  known: (name: string) => `${name} is already being watched.`,
  disabled: (name: string) => `${name}: this integration is disabled in the plugin options.`,
}

async function syncTone($: EngineInterface): Promise<void> {
  const theme = (await $.config.list()).find(row => row.key === 'theme')
  await update($, tone, () => toneOf(theme?.value))
}

export const register: Register = (on, options) => {
  const settings = readSettings(options)

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'pr-watch',
      description: 'Watch ADO/GitHub PRs: /pr-watch <id|url|owner/repo#N> | rm <target> | clear | hide | show | style [name]',
    })
    const stored = ((await $.store.get(STORE_KEY)) as WatchedPr[] | undefined) ?? []
    const now = await $.clock.now()
    await update($, prs, list => mergeLists(list.map(normalize), stored.map(normalize), now))
    await save($)
    const storedStyle = String((await $.store.get(STYLE_KEY)) ?? '')
    const savedStyle = LEGACY_STYLES[storedStyle] ?? (storedStyle as BandStyle)
    if (BAND_STYLES.includes(savedStyle)) {
      await update($, style, () => savedStyle)
    }
    await syncTone($)
    $.clock.every(TICK_MS, () => void refresh($, settings))
    $.clock.after(0, () => void refresh($, settings))
    if (settings.currentBranch) {
      $.clock.after(0, () =>
        void currentBranchSeeds(ioOf($), settings).then(async seeds => {
          for (const seed of seeds) {
            await watch($, seed, settings)
          }
        }),
      )
    }

    return next(e)
  })

  on('command.run', { command: 'pr-watch' }, async ($, e) => {
    const [verb = '', arg = ''] = e.args.trim().split(/\s+/)

    if (verb === 'rm' && arg) {
      const target = parseTarget(arg, settings)
      const matches = (pr: WatchedPr) => pr.key === target?.key || (/^\d+$/.test(arg) && pr.id === Number(arg))
      await remove($, pr => !matches(pr), settings)
      return { text: `Stopped watching ${arg}.` }
    }
    if (verb === 'clear') {
      await remove($, p => !p.isDone, settings)
      return { text: 'Removed finished PRs.' }
    }
    if (verb === 'hide' || verb === 'show') {
      await update($, isHidden, () => verb === 'hide')
      await syncStatus($, settings)
      return { text: verb === 'hide' ? 'Band hidden; summary moved to the status line.' : 'Band visible.' }
    }
    if (verb === 'style') {
      if (arg && BAND_STYLES.includes(arg as BandStyle)) {
        await setStyle($, arg as BandStyle)
        return { text: `Band style: ${arg}.` }
      }
      if (!arg) {
        await cycleStyle($)
        return { text: `Band style: ${await read($, style)}.` }
      }
      return { text: `Styles: ${BAND_STYLES.join(', ')}.` }
    }
    if (verb) {
      const target = parseTarget(verb, settings)
      if (!target) {
        return { text: `Could not parse "${verb}". Use an ADO id, a PR URL or owner/repo#N.` }
      }
      return { text: WATCH_ANSWERS[await watch($, target, settings)](label(target)) }
    }

    const list = await visible($, settings)
    const lines = list.map(p => `${heading(p)} · ${describe(p.phase, p.checks)}`)
    return { text: lines.length === 0 ? 'No PRs being watched.' : lines.join('\n') }
  })

  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const ran = await next(e)
    if (!ran.text || ran.isError) {
      return ran
    }
    if (/\baz\s+repos\s+pr\s+create\b/.test(e.command)) {
      const id = parsePrId(ran.text)
      if (id) {
        await watch($, { key: adoKey(id), provider: 'ado', id, repo: '' }, settings)
      }
    }
    if (/\bgh\s+pr\s+create\b/.test(e.command)) {
      const ref = parseGithubRef(ran.text, settings.githubHosts)
      if (ref) {
        await watch($, { key: githubKey(ref), provider: 'github', id: ref.number, host: ref.host, owner: ref.owner, repo: ref.repo }, settings)
      }
    }

    return ran
  }).catch(($, e, next) => next(e))

  on('config.set', { key: 'theme' }, async ($, e, next) => {
    const result = await next(e)
    await update($, tone, () => toneOf(e.value))

    return result
  }).catch(($, e, next) => next(e))

  on('tool.call', { tool: 'mcp__azure-devops__repo_pull_request_write' }, async ($, e, next) => {
    const ran = await next(e)
    if (ran.text && !ran.isError) {
      const id = parsePrId(ran.text)
      if (id) {
        await watch($, { key: adoKey(id), provider: 'ado', id, repo: '' }, settings)
      }
    }

    return ran
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const list = await visible($, settings)
    if (e.props.hasSurvey || list.length === 0 || (await read($, isHidden))) {
      return next(e)
    }

    return renderBand({
      el: $.ui.resolve(e),
      list,
      tick: await read($, frame),
      now: await $.clock.now(),
      collapsed: await read($, isCollapsed),
      style: await read($, style),
      tone: await read($, tone),
      actions: {
        remove: key => void remove($, p => p.key !== key, settings),
        clearDone: () => void remove($, p => !p.isDone, settings),
        toggleCollapse: () => void update($, isCollapsed, v => !v),
        hide: () => void update($, isHidden, () => true).then(() => syncStatus($, settings)),
        cycleStyle: () => void cycleStyle($),
        investigate: (pr, item) =>
          void $.prompt.submit({ text: investigatePrompt(pr, item) })
            .catch(() => $.ui.toast('Could not send the investigation prompt')),
      },
    })
  })
}
