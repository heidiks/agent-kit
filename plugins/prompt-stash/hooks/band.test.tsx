import { expect, mock, test } from 'claude-code/testing'
import type { Engine, On } from 'claude-code'

import type { StashItem } from '../types'
import { addItem } from './store'

const BAND = { hasSurvey: false, isWorking: false, maxRows: 30, bodyColumns: 100 } as never

async function start($: Engine, on: On, stored: StashItem[], options: { box?: string; below?: 'engine' | 'band' } = {}) {
  mock.clock(on, { now: 1_000_000 })
  mock.store(on, { items: stored })
  on('session.root', () => ({ value: '/work/x' }) as never)
  on('session.start', (_$, e) => e as never)
  on('command.register', () => ({ value: { isRegistered: true } }) as never)
  on('ui.open', () => ({ value: { isPlaced: true } }) as never)
  const filled: string[] = []
  const toasts: string[] = []
  let box = options.box ?? ''
  on('prompt.read', () => ({ value: { text: box, cursor: box.length } }) as never)
  on('prompt.fill', (_$, e) => {
    filled.push(e.text)
    box = e.text
    return { isFilled: true } as never
  })
  on('ui.toast', (_$, e) => {
    toasts.push(String((e as { text?: string }).text ?? e))
    return { value: undefined } as never
  })
  on('ui.render', { component: 'AbovePrompt' }, (_$, e) => {
    if (options.below !== 'band') return { type: 'engine', ref: 1 } as never
    const { Text } = _$.ui.resolve(e)
    return <Text>other band</Text>
  })
  await $.session.start({ source: 'startup', cwd: '/work/x', surface: 'terminal', isInteractive: true } as never)
  const band = await $.ui.mount({ plugin: 'prompt-stash', surface: 'terminal', component: 'AbovePrompt', props: BAND })
  return { band, filled, toasts }
}

const inX = (...texts: string[]) => texts.reduce<StashItem[]>((list, text, i) => addItem(list, text, '/work/x', i + 1), [])

test('with an empty list nothing is drawn above the prompt', async ($, on) => {
  const { band } = await start($, on, [])
  expect(await band.find({ key: 'stash' })).toBeUndefined()
  expect(await band.find({ type: 'Text', text: '0 stashed' })).toBeUndefined()
})

test('with items of other projects only, nothing is drawn', async ($, on) => {
  const { band } = await start($, on, addItem([], 'elsewhere', '/work/y', 1))
  expect(await band.find({ key: 'stash' })).toBeUndefined()
})

test('with items and nothing drawn below, one line shows the count and the two actions', async ($, on) => {
  const { band } = await start($, on, inX('a', 'b'))
  expect(await band.find({ type: 'Text', text: '2 stashed' })).toBeDefined()
  expect(await band.find({ key: 'stash' })).toBeDefined()
  expect(await band.find({ key: 'list' })).toBeDefined()
})

test('when a plugin below draws the band, prompt-stash keeps it and draws no line', async ($, on) => {
  const { band } = await start($, on, inX('a'), { below: 'band' })
  expect(await band.find({ type: 'Text', text: 'other band' })).toBeDefined()
  expect(await band.find({ key: 'stash' })).toBeUndefined()
})

test('the stash hotkey keeps the draft, empties the box without sending, and counts it', async ($, on) => {
  const { band, filled } = await start($, on, inX('a'), { box: 'b draft' })
  await band.press({ key: 'stash' })
  expect(filled).toEqual([''])
  expect(await band.find({ type: 'Text', text: '2 stashed' })).toBeDefined()
})

test('the stash hotkey on an empty box changes nothing and says so', async ($, on) => {
  const { band, filled, toasts } = await start($, on, inX('a'))
  await band.press({ key: 'stash' })
  expect(filled).toEqual([])
  expect(toasts.join(' ')).toContain('Nothing to stash')
  expect(await band.find({ type: 'Text', text: '1 stashed' })).toBeDefined()
})
