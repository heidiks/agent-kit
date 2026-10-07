import type { Check, Phase, WatchedPr } from '../types'
import {
  adoKey,
  gateVerdict,
  mergedVerdict,
  needsTimeline,
  parseTimeline,
  repoFromRemote,
  withDetail,
  type BuildDetail,
  type Notification,
  type NotifyLevel,
  type PipelineRun,
  type PolicyEvaluation,
  type PrDetails,
  type TimelineRecord,
  type Verdict,
} from './ado'
import {
  annotationReason,
  githubGateVerdict,
  githubKey,
  githubMergedVerdict,
  parseGithubRemote,
  type GhAnnotation,
  type GhCheckRun,
  type GhPr,
  type GhStatus,
} from './github'

export type Io = {
  run: (argv: string[]) => Promise<{ exitCode: number; stdout: string; stderr: string }>
  now: () => Promise<number>
}

export type Settings = {
  ado: boolean
  github: boolean
  githubHosts: string[]
  details: boolean
  currentBranch: boolean
  maxRows: number
  notify: NotifyLevel
}

export type Seed = Pick<WatchedPr, 'key' | 'provider' | 'id' | 'host' | 'owner' | 'repo'>

export type Checked = Verdict & Pick<WatchedPr, 'repo' | 'project' | 'title' | 'url' | 'isDraft'>

export type Result<T> = { value: T; error?: undefined } | { value?: undefined; error: string }

const GH_PR_FIELDS = 'state,isDraft,mergeable,title,url,closedAt,mergeCommit,reviewDecision,latestReviews,reviewRequests,statusCheckRollup'

const finishedDetails = new Map<string, BuildDetail>()

async function runJson<T>(io: Io, argv: string[]): Promise<Result<T>> {
  const ran = await io.run(argv)
  if (ran.exitCode !== 0) {
    const line = ran.stderr.split('\n').find(l => l.trim() !== '') ?? `exit ${ran.exitCode}`
    return { error: line.replace(/^ERROR:\s*/, '').slice(0, 160) }
  }
  try {
    return { value: JSON.parse(ran.stdout) as T }
  } catch {
    return { error: `${argv[0]} returned non-JSON output` }
  }
}

const az = <T>(io: Io, args: string[]) => runJson<T>(io, ['az', ...args, '-o', 'json'])
const gh = <T>(io: Io, args: string[]) => runJson<T>(io, ['gh', ...args])

function isFinished(check: Check): boolean {
  return check.state !== 'running' && check.state !== 'queued' && check.state !== 'pending'
}

async function enrichAdo(io: Io, check: Check, phase: Phase, project: string): Promise<Check> {
  if (!check.buildId) {
    return check
  }
  const cacheKey = `ado:${check.buildId}`
  const cached = finishedDetails.get(cacheKey)
  if (!needsTimeline(check, phase, cached !== undefined)) {
    return withDetail(check, cached)
  }
  const timeline = await az<{ records: TimelineRecord[] }>(io, [
    'devops', 'invoke', '--area', 'build', '--resource', 'timeline',
    '--route-parameters', `project=${project}`, `buildId=${check.buildId}`,
    '--api-version', '7.1',
  ])
  if (!timeline.value) {
    return check
  }
  const detail = parseTimeline(timeline.value.records ?? [])
  if (isFinished(check)) {
    finishedDetails.set(cacheKey, detail)
  }

  return withDetail(check, detail)
}

async function checkAdo(io: Io, pr: WatchedPr, settings: Settings): Promise<Result<Checked>> {
  const id = String(pr.id)
  const shown = await az<PrDetails>(io, ['repos', 'pr', 'show', '--id', id])
  if (!shown.value) {
    return { error: shown.error }
  }
  const details = shown.value
  const webUrl = details.repository.webUrl
  const project = details.repository.project.name
  const base = {
    repo: details.repository.name,
    project,
    title: details.title,
    url: `${webUrl}/pullrequest/${id}`,
    isDraft: details.isDraft === true,
  }

  let found: Verdict
  if (details.status === 'abandoned') {
    found = { phase: 'abandoned', checks: [], isFailed: false, isDone: true }
  } else if (details.status === 'active') {
    const policies = await az<PolicyEvaluation[]>(io, ['repos', 'pr', 'policy', 'list', '--id', id])
    if (!policies.value) {
      return { error: policies.error }
    }
    found = gateVerdict(policies.value, details)
  } else {
    const runs = await az<PipelineRun[]>(io, [
      'pipelines', 'runs', 'list', '--project', project, '--branch', details.targetRefName, '--top', '100',
    ])
    if (!runs.value) {
      return { error: runs.error }
    }
    const mergeCommit = details.lastMergeCommit?.commitId
    const now = await io.now()
    const closedAt = details.closedDate ? Date.parse(details.closedDate) : now
    found = mergedVerdict(runs.value.filter(r => r.sourceVersion === mergeCommit), now - closedAt, webUrl)
  }

  const checks: Check[] = []
  for (const item of found.checks) {
    checks.push(settings.details ? await enrichAdo(io, item, found.phase, project) : item)
  }

  return { value: { ...base, ...found, checks, isFailed: checks.some(c => c.state === 'fail') } }
}

async function enrichGithub(io: Io, check: Check, pr: WatchedPr): Promise<Check> {
  if (!check.buildId || check.state !== 'fail') {
    return check
  }
  const cacheKey = `gh:${pr.host}:${check.buildId}`
  const cached = finishedDetails.get(cacheKey)
  if (cached) {
    return { ...check, reason: cached.reason }
  }
  const path = `repos/${pr.owner}/${pr.repo}/check-runs/${check.buildId}`
  const annotations = await gh<GhAnnotation[]>(io, ['api', '--hostname', pr.host ?? 'github.com', `${path}/annotations`])
  let reason = annotationReason(annotations.value ?? [])
  if (!reason) {
    const run = await gh<{ output?: { title?: string | null } }>(io, ['api', '--hostname', pr.host ?? 'github.com', path])
    reason = run.value?.output?.title ?? undefined
  }
  finishedDetails.set(cacheKey, { stages: [], reason })

  return { ...check, reason }
}

async function checkGithub(io: Io, pr: WatchedPr, settings: Settings): Promise<Result<Checked>> {
  const host = pr.host ?? 'github.com'
  const repoArg = `${host}/${pr.owner}/${pr.repo}`
  const shown = await gh<GhPr>(io, ['pr', 'view', String(pr.id), '-R', repoArg, '--json', GH_PR_FIELDS])
  if (!shown.value) {
    return { error: shown.error }
  }
  const details = shown.value
  const base = { repo: pr.repo, project: pr.owner ?? '', title: details.title, url: details.url, isDraft: details.isDraft }

  let found: Verdict
  if (details.state === 'CLOSED') {
    found = { phase: 'abandoned', checks: [], isFailed: false, isDone: true }
  } else if (details.state === 'OPEN') {
    found = githubGateVerdict(details)
  } else {
    const sha = details.mergeCommit?.oid
    const prefix = `repos/${pr.owner}/${pr.repo}/commits/${sha}`
    const runs = await gh<{ check_runs: GhCheckRun[] }>(io, ['api', '--hostname', host, `${prefix}/check-runs?per_page=100`])
    const statuses = await gh<{ statuses: GhStatus[] }>(io, ['api', '--hostname', host, `${prefix}/status`])
    if (!runs.value || !statuses.value) {
      return { error: runs.error ?? statuses.error ?? 'failed to read checks' }
    }
    const now = await io.now()
    const closedAt = details.closedAt ? Date.parse(details.closedAt) : now
    found = githubMergedVerdict(runs.value.check_runs ?? [], statuses.value.statuses ?? [], now - closedAt)
  }

  const checks: Check[] = []
  for (const item of found.checks) {
    checks.push(settings.details ? await enrichGithub(io, item, pr) : item)
  }

  return { value: { ...base, ...found, checks, isFailed: checks.some(c => c.state === 'fail') } }
}

export function isEnabled(pr: Pick<WatchedPr, 'provider' | 'host'>, settings: Settings): boolean {
  return pr.provider === 'ado'
    ? settings.ado
    : settings.github && settings.githubHosts.includes(pr.host ?? 'github.com')
}

export function checkPr(io: Io, pr: WatchedPr, settings: Settings): Promise<Result<Checked>> {
  return pr.provider === 'github' ? checkGithub(io, pr, settings) : checkAdo(io, pr, settings)
}

export async function currentBranchSeeds(io: Io, settings: Settings): Promise<Seed[]> {
  const branch = await io.run(['git', 'rev-parse', '--abbrev-ref', 'HEAD'])
  const remote = await io.run(['git', 'remote', 'get-url', 'origin'])
  const name = branch.stdout.trim()
  if (branch.exitCode !== 0 || remote.exitCode !== 0 || ['HEAD', 'master', 'main'].includes(name)) {
    return []
  }

  const adoRepo = settings.ado ? repoFromRemote(remote.stdout) : undefined
  if (adoRepo) {
    const found = await az<number[]>(io, [
      'repos', 'pr', 'list', '--repository', adoRepo, '--source-branch', name, '--status', 'active',
      '--query', '[].pullRequestId',
    ])
    return (found.value ?? []).map(id => ({ key: adoKey(id), provider: 'ado', id, repo: adoRepo }))
  }

  const ghRepo = settings.github ? parseGithubRemote(remote.stdout, settings.githubHosts) : undefined
  if (ghRepo) {
    const found = await gh<{ number: number; state: string }>(io, [
      'pr', 'view', name, '-R', `${ghRepo.host}/${ghRepo.owner}/${ghRepo.repo}`, '--json', 'number,state',
    ])
    if (found.value?.state === 'OPEN') {
      const ref = { ...ghRepo, number: found.value.number }
      return [{ key: githubKey(ref), provider: 'github', id: ref.number, host: ref.host, owner: ref.owner, repo: ref.repo }]
    }
  }

  return []
}

export function investigatePrompt(pr: WatchedPr, item: Check): string {
  const reason = item.reason ? `Reported reason: ${item.reason.replace(/\.+$/, '')}.` : ''
  if (pr.provider === 'github') {
    const repoArg = `${pr.host}/${pr.owner}/${pr.repo}`
    return [
      `Investigate the failure of check "${item.name}" on PR ${pr.owner}/${pr.repo}#${pr.id} on GitHub (${pr.host}).`,
      reason,
      item.buildId
        ? `Read the log with gh run view --job ${item.buildId} --log-failed -R ${repoArg} (or gh api repos/${pr.owner}/${pr.repo}/check-runs/${item.buildId}),`
        : `Open the check details at ${item.href ?? pr.url},`,
      'identify the root cause and propose a fix without applying it.',
    ].filter(Boolean).join(' ')
  }

  return [
    `Investigate the failure of build ${item.buildId} (${item.name}) on PR ${pr.id} in repo ${pr.repo}, project ${pr.project}, on Azure DevOps.`,
    reason,
    'Read the log of the failed task (az CLI or the azure-devops MCP), identify the root cause and propose a fix without applying it.',
  ].filter(Boolean).join(' ')
}

const APPLESCRIPT_NOTIFY = [
  '-e', 'on run argv',
  '-e', 'display notification (item 2 of argv) with title "pr-watch" subtitle (item 1 of argv) sound name "Glass"',
  '-e', 'end run',
]

export async function sendNotification(io: Io, notification: Notification): Promise<boolean> {
  const { title, message, url } = notification
  const attempts = [
    ['terminal-notifier', '-title', 'pr-watch', '-subtitle', title, '-message', message, '-sound', 'Glass', '-group', title, ...(url.startsWith('https://') ? ['-open', url] : [])],
    ['osascript', ...APPLESCRIPT_NOTIFY, title, message],
    ['notify-send', `pr-watch: ${title}`, message],
  ]
  for (const argv of attempts) {
    const ran = await io.run(argv).catch(() => undefined)
    if (ran?.exitCode === 0) {
      return true
    }
  }

  return false
}
