export type StashItem = { id: string; text: string; project: string; at: number }

export type StashScope = 'project' | 'all'

declare module 'claude-code' {
  interface PluginState {
    'prompt-stash': {
      items: StashItem[]
      scope: StashScope
      isClearing: boolean
    }
  }
}
