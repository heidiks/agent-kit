import { expect, mock, test } from 'claude-code/testing'
import type { Engine, On } from 'claude-code'

import type { StashItem } from '../types'
import { addItem } from './store'
import { ago, preview } from './view'

const PANE_PROPS = { title: 'Stashed prompts', isFocused: true, bodyColumns: 100 } as never

function seed(): StashItem[] {
  return addItem(addItem(addItem([], 'a in x', '/work/x', 1), 'b in y', '/work/y', 2), 'c in x', '/work/x', 3)
}

async function start($: Engine, on: On, stored: StashItem[], box = '') {
  mock.clock(on, { now: 120_000 })
  mock.store(on, { items: stored })
  on('session.root', () => ({ value: '/work/x' }) as never)
  on('session.start', (_$, e) => e as never)
  on('command.register', () => ({ value: { isRegistered: true } }) as never)
  const opened: string[] = []
  const closed: string[] = []
  const filled: string[] = []
  on('ui.open', (_$, e) => {
    opened.push(e.id)
    return { value: { isPlaced: true } } as never
  })
  on('ui.close', (_$, e) => {
    closed.push(e.id)
    return { value: undefined } as never
  })
  on('prompt.read', () => ({ value: { text: box, cursor: box.length } }) as never)
  on('prompt.fill', (_$, e) => {
    filled.push(e.text)
    return { isFilled: true } as never
  })
  await $.session.start({ source: 'startup', cwd: '/work/x', surface: 'terminal', isInteractive: true } as never)
  const pane = await $.ui.mount({ plugin: 'prompt-stash', surface: 'terminal', component: 'Pane', requestId: 'prompt-stash', props: PANE_PROPS })
  return { opened, closed, filled, pane }
}

type Drawn = Awaited<ReturnType<typeof start>>['pane']

const rows = async (pane: Drawn) =>
  (await pane.findAll({ type: 'Button' }))
    .filter(button => String(button.key).startsWith('recall-'))
    .map(button => button.text.replace(/ (now|\d+[mhd]) · .*$/, ''))

test('/stash opens the pane and answers no text', async ($, on) => {
  const { opened } = await start($, on, seed())
  const ran = await $.command.run({ command: 'stash', args: '' } as never)
  expect(ran.text).toBeUndefined()
  expect(opened).toEqual(['prompt-stash'])
})

test('the pane lists the current project, newest first, until switched to all', async ($, on) => {
  const { pane } = await start($, on, seed())
  expect(await rows(pane)).toEqual(['c in x', 'a in x'])
  await pane.press({ key: 'scope-all' })
  expect(await rows(pane)).toEqual(['c in x', 'b in y', 'a in x'])
})

test('recall into an empty box fills it, keeps the item and closes the pane', async ($, on) => {
  const items = seed()
  const { pane, filled, closed } = await start($, on, items)
  await pane.press({ key: `recall-${items[0]!.id}` })
  expect(filled).toEqual(['c in x'])
  expect(closed).toEqual(['prompt-stash'])
  expect(await rows(pane)).toEqual(['c in x', 'a in x'])
})

test('recall into a box with a draft swaps: the draft becomes the newest item', async ($, on) => {
  const items = seed()
  const { pane, filled } = await start($, on, items, 'd draft here')
  await pane.press({ key: `recall-${items[2]!.id}` })
  expect(filled).toEqual(['a in x'])
  expect(await rows(pane)).toEqual(['d draft here', 'c in x', 'a in x'])
})

test('remove takes out only that item', async ($, on) => {
  const items = seed()
  const { pane } = await start($, on, items)
  await pane.press({ key: `rm-${items[0]!.id}` })
  expect(await rows(pane)).toEqual(['a in x'])
})

test('clear asks first; no keeps everything, yes removes only what the pane shows', async ($, on) => {
  const { pane } = await start($, on, seed())
  await pane.press({ key: 'clear' })
  expect((await pane.find({ type: 'Text', text: 'remove 2 items?' }))).toBeDefined()
  await pane.press({ key: 'clear-no' })
  expect(await rows(pane)).toEqual(['c in x', 'a in x'])
  await pane.press({ key: 'clear' })
  await pane.press({ key: 'clear-yes' })
  expect(await rows(pane)).toEqual([])
  await pane.press({ key: 'scope-all' })
  expect(await rows(pane)).toEqual(['b in y'])
})

test('preview keeps the first line and clips; ago rounds down', () => {
  expect(preview('first line\nsecond', 40)).toBe('first line …')
  expect(preview('x'.repeat(30), 10)).toBe(`${'x'.repeat(9)}…`)
  expect(ago(59_000)).toBe('now')
  expect(ago(5 * 60_000)).toBe('5m')
  expect(ago(3 * 3_600_000)).toBe('3h')
  expect(ago(2 * 86_400_000)).toBe('2d')
})
