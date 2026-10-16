export type StashItem = { id: string; text: string; project: string; at: number }

declare module 'claude-code' {
  interface PluginState {
    'prompt-stash': {
      items: StashItem[]
    }
  }
}
