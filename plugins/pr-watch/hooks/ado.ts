import type { Check, CheckState, HistoryEntry, Phase, WatchedPr } from '../types'

export type Reviewer = { displayName: string; vote: number; isRequired?: boolean; isContainer?: boolean }

export type PrDetails = {
  status: string
  title: string
  targetRefName: string
  isDraft?: boolean
  mergeStatus?: string
  creationDate?: string
  description?: string
  sourceRefName?: string
  closedDate?: string
  reviewers?: Reviewer[]
  repository: { name: string; webUrl: string; project: { name: string } }
  lastMergeCommit?: { commitId: string }
}

export type PolicyEvaluation = {
  status: string
  context?: { buildId?: number } | null
  configuration: { isBlocking: boolean; type: { displayName: string } }
}

export type PipelineRun = {
  id: number
  status: string
  result?: string | null
  sourceVersion: string
  definition: { name: string }
}

export type TimelineRecord = {
  id: string
  parentId: string | null
  type: string
  name: string
  state: string
  result: string | null
  order: number | null
  issues?: { type?: string; message: string }[] | null
}

export type Verdict = { phase: Phase; checks: Check[]; isFailed: boolean; isDone: boolean }

export type BuildDetail = { stages: Check[]; reason?: string }

export const SETTLE_AFTER_MERGE_MS = 5 * 60 * 1000
export const GIVE_UP_AFTER_MERGE_MS = 6 * 60 * 60 * 1000
const FAST_POLL_MS = 15_000
const SLOW_POLL_MS = 60_000
const IDLE_POLL_MS = 120_000
export const FORGET_DONE_AFTER_MS = 24 * 60 * 60 * 1000
export const APPROVAL_DENIED = 'approval not granted'
export const MAX_INLINE_STAGES = 6

const POLICY_STATES: Record<string, CheckState> = {
  approved: 'ok',
  rejected: 'fail',
  broken: 'fail',
  running: 'running',
  queued: 'queued',
}

const RESULTS: Record<string, CheckState> = {
  succeeded: 'ok',
  succeededWithIssues: 'warn',
  partiallySucceeded: 'warn',
  failed: 'fail',
  canceled: 'fail',
  abandoned: 'fail',
  skipped: 'skipped',
}

const VOTES: Record<number, CheckState> = { 10: 'ok', 5: 'ok', 0: 'pending', [-5]: 'warn', [-10]: 'fail' }

export function parsePrId(text: string): number | undefined {
  const match =
    /"pullRequestId"\s*:\s*(\d+)/.exec(text) ?? /\/pullrequest\/(\d+)/i.exec(text)

  return match ? Number(match[1]) : undefined
}

export function repoFromRemote(remote: string): string | undefined {
  const trimmed = remote.trim()
  if (!/dev\.azure\.com|visualstudio\.com/.test(trimmed)) {
    return undefined
  }

  return trimmed.split(/[/:]/).pop() || undefined
}

export function adoKey(id: number): string {
  return `ado:${id}`
}

export function buildUrl(repoWebUrl: string, buildId: number): string {
  return `${repoWebUrl.split('/_git/')[0]}/_build/results?buildId=${buildId}`
}

export function verdict(phase: Phase, checks: Check[], isDone: boolean): Verdict {
  return { phase, checks, isFailed: checks.some(c => c.state === 'fail'), isDone }
}

export function reviewerChecks(reviewers: Reviewer[]): Check[] {
  return reviewers
    .filter(r => r.isRequired || r.vote !== 0)
    .map(r => {
      const name = r.displayName.split('\\').pop() ?? r.displayName
      return { name: r.isContainer ? name : (name.split(' ')[0] ?? name), state: VOTES[r.vote] ?? 'pending' }
    })
}

export function gateVerdict(policies: PolicyEvaluation[], pr: PrDetails): Verdict {
  const webUrl = pr.repository.webUrl
  const builds = policies.filter(
    p => p.configuration.type.displayName === 'Build' && p.status !== 'notApplicable',
  )
  const checks: Check[] = builds.map(p => ({
    name: 'build',
    state: POLICY_STATES[p.status] ?? 'queued',
    href: p.context?.buildId ? buildUrl(webUrl, p.context.buildId) : undefined,
    buildId: p.context?.buildId,
  }))
  if (pr.mergeStatus === 'conflicts') {
    checks.push({ name: 'conflict', state: 'fail' })
  }

  const reviewers = reviewerChecks(pr.reviewers ?? [])
  if (reviewers.length > 0) {
    checks.push(...reviewers)
  } else {
    const reviews = policies.filter(
      p => p.configuration.type.displayName !== 'Build' && p.configuration.isBlocking && p.status !== 'notApplicable',
    )
    if (reviews.length > 0) {
      checks.push({ name: 'review', state: reviews.every(p => p.status === 'approved') ? 'ok' : 'pending' })
    }
  }

  return verdict('gate', checks, false)
}

function runState(run: PipelineRun): CheckState {
  if (run.status === 'completed') {
    return RESULTS[run.result ?? ''] ?? 'skipped'
  }

  return run.status === 'notStarted' || run.status === 'postponed' ? 'queued' : 'running'
}

export function mergedVerdict(allRuns: PipelineRun[], msSinceMerge: number, repoWebUrl: string): Verdict {
  const seen = new Set<string>()
  const runs = allRuns.filter(r => !seen.has(r.definition.name) && seen.add(r.definition.name))

  if (runs.length === 0) {
    const isGivenUp = msSinceMerge > GIVE_UP_AFTER_MERGE_MS
    return verdict('merged', [{ name: isGivenUp ? 'no run found' : 'waiting for run', state: isGivenUp ? 'skipped' : 'queued' }], isGivenUp)
  }

  const checks: Check[] = runs.map(r => ({
    name: r.definition.name,
    state: runState(r),
    href: buildUrl(repoWebUrl, r.id),
    buildId: r.id,
  }))
  const isAllCompleted = runs.every(r => r.status === 'completed')

  return verdict('merged', checks, isAllCompleted && msSinceMerge > SETTLE_AFTER_MERGE_MS)
}

function recordState(record: TimelineRecord): CheckState {
  if (record.state === 'completed') {
    return RESULTS[record.result ?? ''] ?? 'skipped'
  }

  return record.state === 'inProgress' ? 'running' : 'queued'
}

export function parseTimeline(records: TimelineRecord[]): BuildDetail {
  const byOrder = (a: TimelineRecord, b: TimelineRecord) => (a.order ?? 0) - (b.order ?? 0)
  const childOf = (parent: TimelineRecord, type: string) =>
    records.find(r => r.type === type && r.parentId === parent.id)

  const stages = records
    .filter(r => r.type === 'Stage' && r.name !== '__default')
    .sort(byOrder)
    .map(stage => {
      const checkpoint = childOf(stage, 'Checkpoint')
      const approval = checkpoint ? childOf(checkpoint, 'Checkpoint.Approval') : undefined
      const check: Check = { name: stage.name, state: recordState(stage) }
      if (approval?.state === 'inProgress') {
        return { ...check, state: 'pending' as const, note: 'awaiting approval' }
      }
      if (approval?.result && approval.result !== 'succeeded') {
        return { ...check, note: APPROVAL_DENIED }
      }
      return check
    })

  const failed = records.filter(r => r.result === 'failed' && (r.issues?.length ?? 0) > 0)
  const failedTask = failed.filter(r => r.type === 'Task').sort(byOrder)[0] ?? failed[0]
  const issue = failedTask?.issues?.find(i => i.type === 'error') ?? failedTask?.issues?.[0]
  const reason = failedTask && issue ? `${failedTask.name}: ${issue.message}` : undefined

  return { stages, reason }
}

export function withDetail(check: Check, detail: BuildDetail | undefined): Check {
  if (!detail) {
    return check
  }
  const denied = detail.stages.filter(s => s.note === APPROVAL_DENIED).length
  const isFalseGreen = check.state === 'ok' && denied > 0

  return {
    ...check,
    state: isFalseGreen ? 'warn' : check.state,
    note: isFalseGreen ? `${denied} stage(s) without approval` : check.note,
    stages: detail.stages.length > 0 ? detail.stages : undefined,
    reason: check.state === 'fail' ? detail.reason : undefined,
  }
}

export function needsTimeline(check: Check, phase: Phase, cached: boolean): boolean {
  if (!check.buildId) return false
  const isTerminal = check.state !== 'running' && check.state !== 'queued'
  if (isTerminal && cached) return false

  return phase === 'merged' || check.state === 'fail'
}

export const ICONS: Record<CheckState, string> = {
  ok: '✓',
  fail: '✗',
  running: '●',
  queued: '○',
  pending: '◐',
  warn: '!',
  skipped: '–',
}

export const SPINNER = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']

export const PHASE_LABELS: Record<Phase, string> = {
  loading: 'checking',
  gate: 'gate',
  merged: 'merged',
  abandoned: 'abandoned',
}

export function overallState(checks: Check[], phase: Phase): CheckState {
  if (phase === 'loading') return 'running'
  if (phase === 'abandoned') return 'skipped'
  const states = checks.flatMap(c => [c.state, ...(c.stages ?? []).map(s => s.state)])
  for (const state of ['fail', 'running', 'queued', 'pending', 'warn'] as const) {
    if (states.includes(state)) return state
  }

  return states.length > 0 && states.every(s => s === 'skipped') ? 'skipped' : 'ok'
}

export function describe(phase: Phase, checks: Check[]): string {
  if (phase === 'loading' || phase === 'abandoned') {
    return PHASE_LABELS[phase]
  }

  return `${PHASE_LABELS[phase]} · ${checks.map(c => `${ICONS[c.state]} ${c.name}`).join('  ')}`
}

export const STALE_AFTER_MS = 3 * 60 * 1000
export const HISTORY_LIMIT = 20
export const LONG_WAIT_MS = 24 * 60 * 60 * 1000

export function isWaitingTooLong(pr: WatchedPr, now: number): boolean {
  return !pr.isDone && pr.changedAt !== undefined && overallState(pr.checks, pr.phase) === 'pending' && now - pr.changedAt > LONG_WAIT_MS
}

export type CheckOutcome = { value: Verdict & Partial<WatchedPr>; error?: undefined } | { value?: undefined; error: string }

export function applyCheck(pr: WatchedPr, outcome: CheckOutcome, checkedAt: number): { next: WatchedPr; isChanged: boolean } {
  if (!outcome.value) {
    return { next: { ...pr, error: outcome.error, checkedAt }, isChanged: false }
  }
  const after = describe(outcome.value.phase, outcome.value.checks)
  const isChanged = describe(pr.phase, pr.checks) !== after
  const entry: HistoryEntry = { at: checkedAt, state: overallState(outcome.value.checks, outcome.value.phase), text: after }
  const next: WatchedPr = {
    ...pr,
    ...outcome.value,
    error: undefined,
    checkedAt,
    changedAt: isChanged || pr.changedAt === undefined ? checkedAt : pr.changedAt,
    doneAt: outcome.value.isDone ? (pr.doneAt ?? checkedAt) : undefined,
    history: isChanged ? [...(pr.history ?? []), entry].slice(-HISTORY_LIMIT) : pr.history,
  }

  return { next, isChanged }
}

export function isStale(pr: WatchedPr, now: number): boolean {
  return !pr.isDone && (pr.error !== undefined || (pr.checkedAt !== undefined && now - pr.checkedAt > STALE_AFTER_MS))
}

const URGENCY: Record<CheckState, number> = { fail: 0, pending: 1, warn: 2, running: 3, queued: 4, ok: 5, skipped: 6 }

export function byUrgency(list: WatchedPr[]): WatchedPr[] {
  const rank = (pr: WatchedPr) => (pr.isDone ? 10 : 0) + URGENCY[overallState(pr.checks, pr.phase)]
  return list
    .map((pr, index) => ({ pr, index }))
    .sort((a, b) => rank(a.pr) - rank(b.pr) || (b.pr.createdAt ?? 0) - (a.pr.createdAt ?? 0) || a.index - b.index)
    .map(entry => entry.pr)
}

export function pollDelay(pr: WatchedPr): number {
  if (pr.error) return SLOW_POLL_MS
  if (pr.phase === 'loading' || pr.phase === 'merged') return FAST_POLL_MS
  const state = overallState(pr.checks, pr.phase)
  if (state === 'running' || state === 'queued') return FAST_POLL_MS

  return state === 'fail' ? SLOW_POLL_MS : IDLE_POLL_MS
}

export function ago(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000))
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`
  return `${Math.floor(seconds / 86400)}d`
}

export function mergeLists(current: WatchedPr[], stored: WatchedPr[], now: number): WatchedPr[] {
  const keys = new Set(current.map(p => p.key))
  return [...current, ...stored.filter(p => !keys.has(p.key))].filter(
    p => !(p.isDone && p.doneAt !== undefined && now - p.doneAt > FORGET_DONE_AFTER_MS),
  )
}

export type OverviewStats = { total: number; merged: number; failing: number; waiting: number; running: number; finished: number }

export function overviewStats(list: WatchedPr[]): OverviewStats {
  const states = list.map(pr => overallState(pr.checks, pr.phase))
  return {
    total: list.length,
    merged: list.filter(pr => pr.phase === 'merged').length,
    failing: states.filter(s => s === 'fail').length,
    waiting: states.filter(s => s === 'pending' || s === 'warn').length,
    running: states.filter(s => s === 'running' || s === 'queued').length,
    finished: list.filter(pr => pr.isDone).length,
  }
}

export function prLabel(pr: WatchedPr): string {
  return pr.provider === 'github' ? `${pr.owner}/${pr.repo}#${pr.id}` : `${pr.repo} !${pr.id}`
}

export function summaryPrompt(list: WatchedPr[], now: number): string {
  const lines = list.map(pr => {
    const steps = (pr.history ?? []).map(h => `${ago(now - h.at)} ago: ${h.text}`).join('; ')
    return `- ${prLabel(pr)} "${pr.title}" (${pr.provider}). Now: ${describe(pr.phase, pr.checks)}${pr.isDone ? ' (finished)' : ''}. History: ${steps || 'none'}.`
  })

  return `Pull requests being watched:\n${lines.join('\n')}`
}

export const SUMMARY_SYSTEM = [
  'You summarize pull request activity for a developer, in English, as a short standup-style update.',
  'Use only the data given. Lead with what needs action (failures, pending reviews or approvals), then what shipped.',
  'At most 6 bullet points, no headings, no preamble.',
].join(' ')

export type NotifyLevel = 'off' | 'important' | 'all'

export type Notification = { title: string; prTitle: string; message: string; url: string }

const failingNames = (pr: WatchedPr) => pr.checks.filter(c => c.state === 'fail').map(c => c.name)
const awaitingApproval = (pr: WatchedPr) => pr.checks.flatMap(c => [c, ...(c.stages ?? [])]).filter(c => c.note === 'awaiting approval').map(c => c.name)
const changesRequested = (pr: WatchedPr) => pr.checks.filter(c => c.state === 'warn' && !c.stages && !c.href).map(c => c.name)

function newOnes(after: string[], before: string[]): string[] {
  return after.filter(name => !before.includes(name))
}

export function notificationFor(before: WatchedPr, after: WatchedPr, level: NotifyLevel): Notification | undefined {
  if (level === 'off' || before.phase === 'loading') {
    return undefined
  }
  const title = prLabel(after)
  const note = (message: string) => ({ title, prTitle: after.title, message, url: after.url })

  const failed = newOnes(failingNames(after), failingNames(before))
  if (failed.length > 0) {
    return note(`✗ failed: ${failed.join(', ')}`)
  }
  const approvals = newOnes(awaitingApproval(after), awaitingApproval(before))
  if (approvals.length > 0) {
    return note(`◐ awaiting approval: ${approvals.join(', ')}`)
  }
  const requested = newOnes(changesRequested(after), changesRequested(before))
  if (requested.length > 0) {
    return note(`! changes requested by ${requested.join(', ')}`)
  }
  if (after.isDone && !before.isDone) {
    if (after.phase === 'abandoned') return note('– abandoned')
    return note(after.isFailed ? '✗ finished with failures' : '✓ shipped: every post-merge check passed')
  }
  if (after.phase === 'merged' && before.phase !== 'merged') {
    return note('merged, watching the pipelines')
  }
  if (level === 'all' && describe(before.phase, before.checks) !== describe(after.phase, after.checks)) {
    return note(describe(after.phase, after.checks))
  }

  return undefined
}
