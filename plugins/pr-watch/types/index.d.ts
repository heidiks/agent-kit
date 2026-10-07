export type CheckState = 'ok' | 'fail' | 'running' | 'queued' | 'pending' | 'warn' | 'skipped'

export type Check = {
  name: string
  state: CheckState
  href?: string
  buildId?: number
  note?: string
  reason?: string
  stages?: Check[]
}

export type BandStyle = 'tree' | 'cards' | 'trail' | 'table'

export type Tone = 'dark' | 'light' | 'unknown'

export type BandMode = 'mini' | 'compact' | 'full'

export type OverviewScope = 'all' | 'session'

export type SummaryStatus = 'idle' | 'running' | 'error'

export type HistoryEntry = { at: number; state: CheckState; text: string }

export type Phase = 'loading' | 'gate' | 'merged' | 'abandoned'

export type Provider = 'ado' | 'github'

export type TaskInfo = {
  prd: string
  id: string
  title: string
  status: string
  path: string
  file: string
  branch: string
  prs: string[]
  dependsOn: string[]
}

export type PlanInfo = { id: string; title: string; status: string; phase: string; path: string; file: string; tasks: TaskInfo[] }

export type WatchedPr = {
  key: string
  provider: Provider
  id: number
  host?: string
  owner?: string
  repo: string
  project: string
  title: string
  url: string
  phase: Phase
  checks: Check[]
  isDraft: boolean
  isFailed: boolean
  isDone: boolean
  doneAt?: number
  checkedAt?: number
  changedAt?: number
  createdAt?: number
  sourceBranch?: string
  targetBranch?: string
  history?: HistoryEntry[]
  sessions?: string[]
  taskRef?: string
  taskRefs?: string[]
  error?: string
}

declare module 'claude-code' {
  interface PluginState {
    'pr-watch': {
      prs: WatchedPr[]
      frame: number
      mode: BandMode
      scope: OverviewScope
      sessionId: string
      summary: string
      summaryStatus: SummaryStatus
      isHidden: boolean
      style: BandStyle
      tone: Tone
      pendingRemove: string
      expanded: string
      doneExpanded: boolean
      plans: PlanInfo[]
      others: WatchedPr[]
    }
  }
}
