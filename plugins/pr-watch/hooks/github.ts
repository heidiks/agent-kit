import type { Check, CheckState } from '../types'
import { GIVE_UP_AFTER_MERGE_MS, SETTLE_AFTER_MERGE_MS, verdict, type Verdict } from './ado'

export type GithubRef = { host: string; owner: string; repo: string; number: number }

export type RollupItem = {
  __typename: string
  name?: string
  status?: string
  conclusion?: string
  detailsUrl?: string
  context?: string
  state?: string
  targetUrl?: string
}

export type GhPr = {
  state: string
  isDraft: boolean
  mergeable: string
  createdAt?: string
  body?: string
  headRefName?: string
  baseRefName?: string
  title: string
  url: string
  closedAt: string | null
  mergeCommit: { oid: string } | null
  reviewDecision: string
  latestReviews: { author: { login: string }; state: string }[]
  reviewRequests: { login?: string; name?: string; slug?: string }[]
  statusCheckRollup: RollupItem[]
}

export type GhCheckRun = {
  id: number
  name: string
  status: string
  conclusion: string | null
  html_url?: string
  details_url?: string
}

export type GhStatus = { context: string; state: string; target_url?: string | null }

export type GhAnnotation = { annotation_level: string; message: string; path?: string }

const CONCLUSIONS: Record<string, CheckState> = {
  success: 'ok',
  neutral: 'ok',
  skipped: 'skipped',
  stale: 'skipped',
  failure: 'fail',
  timed_out: 'fail',
  startup_failure: 'fail',
  cancelled: 'fail',
  action_required: 'pending',
}

const STATUS_STATES: Record<string, CheckState> = {
  success: 'ok',
  failure: 'fail',
  error: 'fail',
  pending: 'running',
  expected: 'queued',
}

const REVIEW_STATES: Record<string, CheckState> = {
  APPROVED: 'ok',
  CHANGES_REQUESTED: 'warn',
}

const URL_PATTERN = /https?:\/\/([^/\s]+)\/([^/\s]+)\/([^/\s]+)\/pull\/(\d+)/
const SHORT_PATTERN = /^([\w.-]+)\/([\w.-]+)#(\d+)$/

export function parseGithubRef(text: string, hosts: string[]): GithubRef | undefined {
  const url = URL_PATTERN.exec(text)
  if (url && hosts.includes(url[1] ?? '')) {
    return { host: url[1] ?? '', owner: url[2] ?? '', repo: url[3] ?? '', number: Number(url[4]) }
  }
  const short = SHORT_PATTERN.exec(text.trim())
  if (short) {
    return { host: hosts[0] ?? 'github.com', owner: short[1] ?? '', repo: short[2] ?? '', number: Number(short[3]) }
  }

  return undefined
}

export function parseGithubRefs(text: string, hosts: string[]): GithubRef[] {
  const refs = [...text.matchAll(new RegExp(URL_PATTERN.source, 'g'))]
    .filter(m => hosts.includes(m[1] ?? ''))
    .map(m => ({ host: m[1] ?? '', owner: m[2] ?? '', repo: m[3] ?? '', number: Number(m[4]) }))
  return refs.filter((ref, i) => refs.findIndex(other => githubKey(other) === githubKey(ref)) === i)
}

export function parseGithubRemote(remote: string, hosts: string[]): Omit<GithubRef, 'number'> | undefined {
  const match = /^(?:https?:\/\/|git@|ssh:\/\/git@)([^/:]+)[/:]([^/]+)\/([^/\s]+?)(?:\.git)?\s*$/.exec(remote.trim())
  if (!match || !hosts.includes(match[1] ?? '')) {
    return undefined
  }

  return { host: match[1] ?? '', owner: match[2] ?? '', repo: match[3] ?? '' }
}

export function githubKey(ref: GithubRef): string {
  return `gh:${ref.host}/${ref.owner}/${ref.repo}#${ref.number}`
}

function runState(status: string, conclusion: string | null | undefined): CheckState {
  const normalized = status.toLowerCase()
  if (normalized === 'completed') {
    return CONCLUSIONS[(conclusion ?? '').toLowerCase()] ?? 'skipped'
  }
  if (normalized === 'waiting') {
    return 'pending'
  }

  return normalized === 'in_progress' ? 'running' : 'queued'
}

export function checkRunId(url: string | undefined): number | undefined {
  const match = /\/job\/(\d+)/.exec(url ?? '') ?? /\/runs\/(\d+)$/.exec(url ?? '')
  return match ? Number(match[1]) : undefined
}

function fromCheckRun(name: string, status: string, conclusion: string | null | undefined, href: string | undefined, id: number | undefined): Check {
  const state = runState(status, conclusion)
  return {
    name,
    state,
    href,
    buildId: id,
    note: status.toLowerCase() === 'waiting' ? 'awaiting approval' : undefined,
  }
}

export function rollupChecks(items: RollupItem[]): Check[] {
  return items.map(item =>
    item.__typename === 'StatusContext'
      ? { name: item.context ?? 'status', state: STATUS_STATES[(item.state ?? '').toLowerCase()] ?? 'queued', href: item.targetUrl || undefined }
      : fromCheckRun(item.name ?? 'check', item.status ?? 'QUEUED', item.conclusion, item.detailsUrl || undefined, checkRunId(item.detailsUrl)),
  )
}

export function githubReviewChecks(pr: GhPr): Check[] {
  const reviewed: Check[] = pr.latestReviews
    .filter(r => REVIEW_STATES[r.state])
    .map(r => ({ name: r.author.login, state: REVIEW_STATES[r.state] ?? 'pending' }))
  const requested: Check[] = pr.reviewRequests.map(r => ({ name: r.login ?? r.slug ?? r.name ?? 'reviewer', state: 'pending' }))
  const checks = [...requested, ...reviewed]
  if (checks.length === 0 && pr.reviewDecision === 'REVIEW_REQUIRED') {
    return [{ name: 'review', state: 'pending' }]
  }

  return checks
}

export function githubGateVerdict(pr: GhPr): Verdict {
  const checks = rollupChecks(pr.statusCheckRollup ?? [])
  if (pr.mergeable === 'CONFLICTING') {
    checks.push({ name: 'conflict', state: 'fail' })
  }
  checks.push(...githubReviewChecks(pr))

  return verdict('gate', checks, false)
}

export function githubMergedVerdict(runs: GhCheckRun[], statuses: GhStatus[], msSinceMerge: number): Verdict {
  const checks: Check[] = [
    ...runs.map(r => fromCheckRun(r.name, r.status, r.conclusion, r.html_url ?? r.details_url, r.id)),
    ...statuses.map(s => ({ name: s.context, state: STATUS_STATES[s.state] ?? 'queued', href: s.target_url || undefined })),
  ]
  if (checks.length === 0) {
    const isGivenUp = msSinceMerge > GIVE_UP_AFTER_MERGE_MS
    return verdict('merged', [{ name: isGivenUp ? 'no checks found' : 'waiting for checks', state: isGivenUp ? 'skipped' : 'queued' }], isGivenUp)
  }
  const isAllCompleted = checks.every(c => c.state !== 'running' && c.state !== 'queued' && c.state !== 'pending')

  return verdict('merged', checks, isAllCompleted && msSinceMerge > SETTLE_AFTER_MERGE_MS)
}

export function annotationReason(annotations: GhAnnotation[]): string | undefined {
  const failure = annotations.find(a => a.annotation_level === 'failure') ?? annotations[0]
  if (!failure) {
    return undefined
  }

  return failure.path && failure.path !== '.github' ? `${failure.path}: ${failure.message}` : failure.message
}
