import type { EngineInterface } from 'claude-code'

import type { StashItem } from '../types'

export const MAX_ITEMS = 50
const STORE_KEY = 'items'

function hashOf(text: string): string {
  let hash = 0
  for (const char of text) {
    hash = (hash * 31 + char.charCodeAt(0)) | 0
  }
  return (hash >>> 0).toString(36)
}

export function addItem(items: readonly StashItem[], text: string, project: string, at: number): StashItem[] {
  const key = text.trim()
  if (!key) {
    return [...items]
  }
  const rest = items.filter(item => item.text.trim() !== key)
  return [{ id: `${at.toString(36)}-${hashOf(key)}`, text, project, at }, ...rest].slice(0, MAX_ITEMS)
}

export function removeItem(items: readonly StashItem[], id: string): StashItem[] {
  return items.filter(item => item.id !== id)
}

export function itemsIn(items: readonly StashItem[], project?: string): StashItem[] {
  return project === undefined ? [...items] : items.filter(item => item.project === project)
}

export function clearItems(items: readonly StashItem[], project?: string): StashItem[] {
  return project === undefined ? [] : items.filter(item => item.project !== project)
}

export async function loadItems($: EngineInterface): Promise<StashItem[]> {
  return ((await $.store.get(STORE_KEY)) as StashItem[] | undefined) ?? []
}

export async function changeItems($: EngineInterface, change: (items: StashItem[]) => StashItem[]): Promise<StashItem[]> {
  const next = change(await loadItems($))
  await $.store.set(STORE_KEY, next)
  return next
}
