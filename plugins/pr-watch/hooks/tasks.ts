import type { CheckState, PlanInfo, TaskInfo, WatchedPr } from '../types'
import { overallState } from './ado'

const TASK_LINE = /^[ \t]*Task:[ \t]*(PRD-[\w.-]+)\/(TASK-\d+)[ \t]*$/gim
const TASK_BRANCH = /(?:^|\/)task\/(PRD-[\w.-]+)\/(TASK-\d+)$/i
const ACTIVE_PLAN_STATUSES = new Set(['Approved', 'In Progress'])

export const TASK_STATES: Record<string, CheckState> = {
  Done: 'ok',
  'In Review': 'pending',
  'In Progress': 'running',
  Todo: 'queued',
  Blocked: 'warn',
  Cancelled: 'skipped',
}

export type TaskLink = { plan: PlanInfo; task: TaskInfo }

export function parseTaskRefs(body?: string | null, branch?: string | null): string[] {
  const fromLines = [...(body ?? '').matchAll(TASK_LINE)].map(m => `${m[1]}/${m[2]}`)
  const fromBranch = TASK_BRANCH.exec((branch ?? '').replace(/^refs\/heads\//, ''))
  const refs = [...fromLines, ...(fromBranch ? [`${fromBranch[1]}/${fromBranch[2]}`] : [])]
  return [...new Set(refs)]
}

export function parseTaskRef(body?: string | null, branch?: string | null): string | undefined {
  return parseTaskRefs(body, branch)[0]
}

function parseValue(raw: string): string | string[] {
  const value = raw.split(' #')[0]?.trim() ?? ''
  if (value.startsWith('[') && value.endsWith(']')) {
    return value.slice(1, -1).split(',').map(item => item.trim().replace(/^["']|["']$/g, '')).filter(Boolean)
  }
  return value.replace(/^["']|["']$/g, '')
}

export function parseFrontmatter(text: string): Record<string, string | string[]> {
  const lines = text.split('\n')
  if (lines[0]?.trim() !== '---') {
    return {}
  }
  const data: Record<string, string | string[]> = {}
  let current = ''
  for (const line of lines.slice(1)) {
    if (line.trim() === '---') {
      break
    }
    const item = /^\s*-\s+(.*)$/.exec(line)
    if (item && current) {
      const list = Array.isArray(data[current]) ? (data[current] as string[]) : []
      data[current] = [...list, String(parseValue(item[1] ?? ''))]
      continue
    }
    const pair = /^([A-Za-z_][\w-]*):(.*)$/.exec(line)
    if (pair) {
      current = pair[1] ?? ''
      data[current] = pair[2]?.trim() ? parseValue(pair[2]) : []
    }
  }
  return data
}

const text = (value: string | string[] | undefined) => (Array.isArray(value) ? '' : (value ?? ''))
const list = (value: string | string[] | undefined) => (Array.isArray(value) ? value : value ? [value] : [])

export function taskFromFile(content: string, path: string, prd: string, file = ''): TaskInfo | undefined {
  const data = parseFrontmatter(content)
  const id = text(data.id)
  if (!/^TASK-\d+$/.test(id)) {
    return undefined
  }
  return {
    prd: text(data.prd_id) || prd,
    id,
    title: text(data.title),
    status: text(data.status),
    path,
    file,
    branch: text(data.branch),
    prs: list(data.prs),
    dependsOn: list(data.depends_on),
  }
}

export function planFromSpec(content: string, path: string, tasks: TaskInfo[], file = ''): PlanInfo | undefined {
  const data = parseFrontmatter(content)
  const id = text(data.id)
  if (!id.startsWith('PRD-')) {
    return undefined
  }
  return { id, title: text(data.title), status: text(data.status), phase: text(data.phase), path, file, tasks }
}

export function fileUrl(file: string): string {
  return file ? `file://${encodeURI(file)}` : ''
}

export function normalizeUrl(url: string): string {
  return url.trim().replace(/\/+$/, '').toLowerCase()
}

export function tasksForPr(pr: WatchedPr, plans: PlanInfo[]): TaskLink[] {
  const url = pr.url ? normalizeUrl(pr.url) : ''
  const refs = pr.taskRefs ?? (pr.taskRef ? [pr.taskRef] : [])
  return plans.flatMap(plan =>
    plan.tasks
      .filter(task => refs.includes(`${plan.id}/${task.id}`) || (url !== '' && task.prs.some(link => normalizeUrl(link) === url)))
      .map(task => ({ plan, task })),
  )
}

export function taskForPr(pr: WatchedPr, plans: PlanInfo[]): TaskLink | undefined {
  return tasksForPr(pr, plans)[0]
}

export function prsForTask(plan: PlanInfo, task: TaskInfo, watched: WatchedPr[]): WatchedPr[] {
  return watched.filter(pr => tasksForPr(pr, [{ ...plan, tasks: [task] }]).length > 0)
}

export function readyToMarkDone(pr: WatchedPr, plans: PlanInfo[]): TaskLink[] {
  return tasksForPr(pr, plans).filter(link => canMarkDone(link.task, pr))
}

export function taskLabel(links: TaskLink[]): string {
  if (links.length === 0) return '-'
  return links.length === 1 ? (links[0]?.task.id ?? '-') : `${links[0]?.task.id}+${links.length - 1}`
}

export function activePlans(plans: PlanInfo[], watched: WatchedPr[]): PlanInfo[] {
  return plans.filter(plan => ACTIVE_PLAN_STATUSES.has(plan.status) || plan.tasks.some(task => prsForTask(plan, task, watched).length > 0))
}

export function canMarkDone(task: TaskInfo, pr: WatchedPr): boolean {
  return task.status === 'In Review' && pr.phase === 'merged' && pr.isDone && !pr.isFailed && overallState(pr.checks, pr.phase) !== 'fail'
}

export function reviewPrUrls(plans: PlanInfo[]): string[] {
  return plans.flatMap(plan => plan.tasks.filter(task => task.status === 'In Review').flatMap(task => task.prs))
}

export function markDonePrompt(links: TaskLink[], pr: WatchedPr): string {
  const names = links.map(link => `${link.task.id} of ${link.plan.id}`).join(', ')
  const files = links.map(link => link.task.path).join(', ')
  return [
    `Mark ${names} as Done following the spec-driven-dev skill.`,
    `Their pull request ${pr.url} is merged and its post-merge checks passed.`,
    `Verify each acceptance criterion in ${files} first; for a task whose criteria are not met, do not mark it Done and tell me what is missing.`,
    'Then update each task status, completed_at and progress log, close the PRD if every task is Done or Cancelled, and regenerate the index.',
  ].join(' ')
}
