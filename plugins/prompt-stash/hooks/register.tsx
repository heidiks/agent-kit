import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { StashItem, StashScope } from '../types'
import { addItem, changeItems, clearItems, itemsIn, loadItems, removeItem } from './store'
import { renderPane } from './view'

const PANE = 'prompt-stash'
const DEFAULT_WIDTH = 100
const items = atom({ plugin: 'prompt-stash', key: 'items' } as const, [] as StashItem[])
const scope = atom({ plugin: 'prompt-stash', key: 'scope' } as const, 'project' as StashScope)
const isClearing = atom({ plugin: 'prompt-stash', key: 'isClearing' } as const, false)

async function mutate($: EngineInterface, change: (list: StashItem[]) => StashItem[]): Promise<void> {
  const next = await changeItems($, change)
  await update($, items, () => next)
}

async function scopeProject($: EngineInterface): Promise<string | undefined> {
  return (await read($, scope)) === 'all' ? undefined : $.session.root()
}

async function openPane($: EngineInterface): Promise<void> {
  await update($, isClearing, () => false)
  const opened = await $.ui.open({ id: PANE, title: 'Stashed prompts', focus: true, closeOnEscape: true, rows: 16 }).catch(() => undefined)
  if (!opened?.isPlaced) {
    $.ui.toast('Could not open the stashed prompts here')
  }
}

async function recall($: EngineInterface, item: StashItem): Promise<void> {
  const box = await $.prompt.read()
  if (box.text.trim()) {
    const project = await $.session.root()
    const now = await $.clock.now()
    await mutate($, list => addItem(list, box.text, project, now))
  }
  await $.prompt.fill({ text: item.text })
  await $.ui.close({ id: PANE })
}

async function clear($: EngineInterface): Promise<void> {
  const project = await scopeProject($)
  await mutate($, list => clearItems(list, project))
  await update($, isClearing, () => false)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'stash',
      description: 'Stashed prompt drafts: recall, remove or clear them without sending',
      immediate: true,
    })
    const stored = await loadItems($)
    await update($, items, () => stored)
    return next(e)
  })

  on('command.run', { command: 'stash' }, async $ => {
    await openPane($)
    return {}
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) =>
    renderPane({
      el: $.ui.resolve(e),
      items: itemsIn(await read($, items), await scopeProject($)),
      scope: await read($, scope),
      isClearing: await read($, isClearing),
      now: await $.clock.now(),
      width: e.props.bodyColumns || DEFAULT_WIDTH,
      actions: {
        recall: item => void recall($, item),
        remove: id => void mutate($, list => removeItem(list, id)),
        setScope: next => void update($, scope, () => next).then(() => update($, isClearing, () => false)),
        askClear: () => void update($, isClearing, () => true),
        cancelClear: () => void update($, isClearing, () => false),
        clear: () => void clear($),
      },
    }),
  )
}
