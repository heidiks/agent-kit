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

export type Phase = 'loading' | 'gate' | 'merged' | 'abandoned'

export type Provider = 'ado' | 'github'

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
  error?: string
}

declare module 'claude-code' {
  interface PluginState {
    'pr-watch': {
      prs: WatchedPr[]
      frame: number
      isCollapsed: boolean
      isHidden: boolean
      style: BandStyle
      tone: Tone
      pendingRemove: string
      doneExpanded: boolean
    }
  }
}
