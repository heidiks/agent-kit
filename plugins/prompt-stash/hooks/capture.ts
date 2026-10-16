import type { EngineInterface, Timer } from 'claude-code'

export const SUBMIT_WAIT_MS = 300

let draft = ''
let held: Timer | undefined

export function isBashMode(text: string): boolean {
  return text.trimStart().startsWith('!')
}

export function trackDraft(text: string): void {
  draft = text
}

export function holdCleared($: EngineInterface, record: (text: string) => Promise<void>): void {
  const cleared = draft
  draft = ''
  if (!cleared.trim() || isBashMode(cleared)) {
    return
  }
  held?.cancel()
  held = $.clock.after(SUBMIT_WAIT_MS, () => {
    held = undefined
    void record(cleared)
  })
}

export function dropHeld(): void {
  held?.cancel()
  held = undefined
}
