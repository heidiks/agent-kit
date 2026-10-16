import { atom, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { StashItem } from '../types'
import { loadItems } from './store'

const items = atom({ plugin: 'prompt-stash', key: 'items' } as const, [] as StashItem[])

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const stored = await loadItems($)
    await update($, items, () => stored)
    return next(e)
  })
}
