import { atom, read, update } from 'claude-code'
import type { EngineInterface, PluginOptions, Register, Timer } from 'claude-code'

import type { BandMode, BandStyle, OverviewScope, SummaryStatus, Tone, WatchedPr } from '../types'
import { adoKey, applyCheck, describe, ICONS, mergeLists, notificationFor, overallState, parsePrId, pollDelay, SPINNER, SUMMARY_SYSTEM, summaryPrompt, type NotifyLevel } from './ado'
import { githubKey, parseGithubRef } from './github'
import { checkPr, currentBranchSeeds, investigatePrompt, isEnabled, sendNotification, type Io, type Seed, type Settings } from './providers'
import { BAND_MODES, BAND_STYLES, LEGACY_STYLES, renderBand, renderOverview, tally, toneOf, type BandContext } from './view'

const TICK_MS = 5_000
const SPINNER_MS = 120
const STORE_KEY = 'prs'
const STYLE_KEY = 'style'
const prs = atom({ plugin: 'pr-watch', key: 'prs' } as const, [])
const frame = atom({ plugin: 'pr-watch', key: 'frame' } as const, 0)
const mode = atom({ plugin: 'pr-watch', key: 'mode' } as const, 'full' as BandMode)
const scope = atom({ plugin: 'pr-watch', key: 'scope' } as const, 'all' as OverviewScope)
const sessionId = atom({ plugin: 'pr-watch', key: 'sessionId' } as const, '')
const summary = atom({ plugin: 'pr-watch', key: 'summary' } as const, '')
const summaryStatus = atom({ plugin: 'pr-watch', key: 'summaryStatus' } as const, 'idle' as SummaryStatus)
const MODE_KEY = 'mode'
const isHidden = atom({ plugin: 'pr-watch', key: 'isHidden' } as const, false)
const style = atom({ plugin: 'pr-watch', key: 'style' } as const, 'table' as BandStyle)
const tone = atom({ plugin: 'pr-watch', key: 'tone' } as const, 'unknown' as Tone)
const pendingRemove = atom({ plugin: 'pr-watch', key: 'pendingRemove' } as const, '')
const CONFIRM_MS = 6_000
const PARALLEL_CHECKS = 3
const OVERVIEW = 'pr-watch-overview'
const NOTIFY_LEVELS: NotifyLevel[] = ['off', 'important', 'all']
const SUMMARY_MODEL = 'haiku'
const doneExpanded = atom({ plugin: 'pr-watch', key: 'doneExpanded' } as const, false)

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
    maxRows: Math.max(1, Math.floor(Number(options.maxRows ?? 5)) || 5),
    notify: NOTIFY_LEVELS.includes(options.notify as NotifyLevel) ? (options.notify as NotifyLevel) : 'important',
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

async function refreshOne($: EngineInterface, pr: WatchedPr, settings: Settings): Promise<void> {
  const result = await checkPr(ioOf($), pr, settings)
  const checkedAt = await $.clock.now()
  const { next, isChanged } = applyCheck(pr, result, checkedAt)
  if (isChanged) {
    $.ui.toast(`${heading(next)} · ${describe(next.phase, next.checks)}`, { timeoutMs: 8000 })
  }
  const notification = notificationFor(pr, next, settings.notify)
  if (notification) {
    void sendNotification(ioOf($), notification)
  }
  nextAt.set(pr.key, checkedAt + pollDelay(next))
  await update($, prs, list => list.map(p => (p.key === pr.key ? next : p)))
}

async function refresh($: EngineInterface, settings: Settings): Promise<void> {
  if (isRefreshing) {
    return
  }
  isRefreshing = true
  try {
    const now = await $.clock.now()
    const due = (await visible($, settings)).filter(p => !p.isDone && (nextAt.get(p.key) ?? 0) <= now)

    for (let start = 0; start < due.length; start += PARALLEL_CHECKS) {
      await Promise.all(due.slice(start, start + PARALLEL_CHECKS).map(pr => refreshOne($, pr, settings)))
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
  const session = await read($, sessionId)
  if ((await read($, prs)).some(p => p.key === seed.key)) {
    await update($, prs, list =>
      list.map(p => (p.key === seed.key && !(p.sessions ?? []).includes(session) ? { ...p, sessions: [...(p.sessions ?? []), session] } : p)),
    )
    return 'known'
  }
  const added: WatchedPr = {
    ...seed, project: '', title: '', url: '', phase: 'loading', checks: [],
    isDraft: false, isFailed: false, isDone: false, sessions: session ? [session] : [],
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

const OPENERS = [['open'], ['xdg-open'], ['cmd', '/c', 'start', '""']]

async function openUrl($: EngineInterface, url: string): Promise<void> {
  if (!/^https:\/\//.test(url)) {
    return
  }
  for (const opener of OPENERS) {
    const ran = await $.process.run([...opener, url], { timeoutMs: 10_000 }).catch(() => undefined)
    if (ran?.exitCode === 0) {
      return
    }
  }
  $.ui.toast(`Could not open ${url}`)
}

async function askRemove($: EngineInterface, key: string): Promise<void> {
  await update($, pendingRemove, () => key)
  $.clock.after(CONFIRM_MS, () => void update($, pendingRemove, current => (current === key ? '' : current)))
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

async function bandContext($: EngineInterface, el: ReturnType<EngineInterface['ui']['resolve']>, list: WatchedPr[], isPane: boolean, settings: Settings): Promise<BandContext> {
  return {
    el,
    list,
    tick: await read($, frame),
    now: await $.clock.now(),
    mode: await read($, mode),
    style: await read($, style),
    tone: await read($, tone),
    pendingRemove: await read($, pendingRemove),
    limit: isPane ? Number.POSITIVE_INFINITY : settings.maxRows,
    doneExpanded: isPane || (await read($, doneExpanded)),
    isPane,
    actions: {
      remove: key => void update($, pendingRemove, () => '').then(() => remove($, p => p.key !== key, settings)),
      askRemove: key => void askRemove($, key),
      cancelRemove: () => void update($, pendingRemove, () => ''),
      open: url => void openUrl($, url),
      clearDone: () => void remove($, p => !p.isDone, settings),
      cycleMode: () => void cycleMode($),
      toggleDone: () => void update($, doneExpanded, v => !v),
      openOverview: () => void openOverview($),
      hide: () => void update($, isHidden, () => true).then(() => syncStatus($, settings)),
      cycleStyle: () => void cycleStyle($),
      investigate: (pr, item) =>
        void $.prompt.submit({ text: investigatePrompt(pr, item) })
          .catch(() => $.ui.toast('Could not send the investigation prompt')),
    },
  }
}

async function cycleMode($: EngineInterface): Promise<void> {
  const current = await read($, mode)
  const next = BAND_MODES[(BAND_MODES.indexOf(current) + 1) % BAND_MODES.length] ?? 'full'
  await update($, mode, () => next)
  await $.store.set(MODE_KEY, next)
}

async function openOverview($: EngineInterface): Promise<void> {
  const opened = await $.ui.open({ id: OVERVIEW, title: 'PR overview', focus: true, closeOnEscape: true, rows: 24 }).catch(() => undefined)
  if (!opened?.isPlaced) {
    $.ui.toast('Could not open the PR overview here')
  }
}

async function scopedList($: EngineInterface, settings: Settings): Promise<WatchedPr[]> {
  const list = await visible($, settings)
  if ((await read($, scope)) === 'all') {
    return list
  }
  const session = await read($, sessionId)
  return list.filter(p => (p.sessions ?? []).includes(session))
}

async function summarize($: EngineInterface, settings: Settings): Promise<void> {
  const list = await scopedList($, settings)
  if (list.length === 0) {
    return
  }
  await update($, summaryStatus, () => 'running')
  const result = await $.model.complete({
    model: SUMMARY_MODEL,
    system: SUMMARY_SYSTEM,
    prompt: summaryPrompt(list, await $.clock.now()),
    maxTokens: 500,
  }).catch(() => undefined)
  if (result?.isAnswered) {
    await update($, summary, () => result.text.trim())
    await update($, summaryStatus, () => 'idle')
  } else {
    await update($, summaryStatus, () => 'error')
  }
}

async function copySummary($: EngineInterface, surface: Parameters<EngineInterface['ui']['copy']>[0]['surface']): Promise<void> {
  const copied = await $.ui.copy({ text: await read($, summary), surface })
  $.ui.toast(copied.isCopied ? 'Summary copied' : 'Could not copy the summary')
}

async function drawBand($: EngineInterface, el: ReturnType<EngineInterface['ui']['resolve']>, settings: Settings) {
  return renderBand(await bandContext($, el, await visible($, settings), false, settings))
}

async function drawOverview($: EngineInterface, el: ReturnType<EngineInterface['ui']['resolve']>, settings: Settings) {
  const session = await read($, sessionId)
  const all = await visible($, settings)
  const context = await bandContext($, el, await scopedList($, settings), true, settings)

  return renderOverview({
    ...context,
    scope: await read($, scope),
    sessionCount: all.filter(p => (p.sessions ?? []).includes(session)).length,
    summary: await read($, summary),
    summaryStatus: await read($, summaryStatus),
    overview: {
      setScope: next => void update($, scope, () => next).then(() => update($, summary, () => '')),
      summarize: () => void summarize($, settings),
      copySummary: surface => void copySummary($, surface),
    },
  })
}

export const register: Register = (on, options) => {
  const settings = readSettings(options)

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'pr-watch',
      description: 'Watch ADO/GitHub PRs: /pr-watch <id|url|owner/repo#N> | rm <target> | overview | mode [full|compact|mini] | clear | hide | show | style [name]',
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
    const savedMode = (await $.store.get(MODE_KEY)) as BandMode | undefined
    if (savedMode && BAND_MODES.includes(savedMode)) {
      await update($, mode, () => savedMode)
    }
    const id = await $.session.id()
    await update($, sessionId, () => id)
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
    if (verb === 'all' || verb === 'overview') {
      await openOverview($)
      return { text: 'Opened the PR overview.' }
    }
    if (verb === 'mode') {
      if (BAND_MODES.includes(arg as BandMode)) {
        await update($, mode, () => arg as BandMode)
        await $.store.set(MODE_KEY, arg)
      } else {
        await cycleMode($)
      }
      return { text: `Band mode: ${await read($, mode)}.` }
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

    return drawBand($, $.ui.resolve(e), settings)
  })

  on('ui.render', { component: 'Pane', requestId: OVERVIEW }, async ($, e) => drawOverview($, $.ui.resolve(e), settings))
}
