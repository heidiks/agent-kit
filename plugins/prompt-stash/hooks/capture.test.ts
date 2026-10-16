import { expect, mock, test } from 'claude-code/testing'
import type { Engine, On } from 'claude-code'

import { SUBMIT_WAIT_MS } from './capture'

const PANE_PROPS = { title: 'Stashed prompts', isFocused: true, bodyColumns: 100 } as never

async function start($: Engine, on: On) {
  const clock = mock.clock(on, { now: 1_000_000 })
  mock.store(on)
  on('session.root', () => ({ value: '/work/x' }) as never)
  on('session.start', (_$, e) => e as never)
  on('command.register', () => ({ value: { isRegistered: true } }) as never)
  on('ui.open', () => ({ value: { isPlaced: true } }) as never)
  on('prompt.submit', (_$, e) => ({ text: e.text }) as never)
  on('prompt.edit', (_$, e) => ({ text: e.text.slice(0, e.start) + e.inputText + e.text.slice(e.end), cursor: e.start + e.inputText.length }) as never)
  on('prompt.change', (_$, e) => ({ text: e.text }) as never)
  await $.session.start({ source: 'startup', cwd: '/work/x', surface: 'terminal', isInteractive: true } as never)
  const pane = await $.ui.mount({ plugin: 'prompt-stash', surface: 'terminal', component: 'Pane', requestId: 'prompt-stash', props: PANE_PROPS })
  const listed = async () =>
    (await pane.findAll({ type: 'Button' }))
      .filter(button => String(button.key).startsWith('recall-'))
      .map(button => button.text.replace(/ (now|\d+[mhd]) · .*$/, ''))
  return { clock, listed }
}

async function type($: Engine, text: string) {
  await $.prompt.edit({ origin: { kind: 'composer' }, text: '', cursor: 0, start: 0, end: 0, inputText: text } as never)
}

async function cleared($: Engine) {
  await $.prompt.change({ text: '', cursor: 0, origin: { kind: 'clear' } } as never)
}

test('a draft emptied without a submit (ctrl+S, ctrl+c) is recorded after the wait', async ($, on) => {
  const { clock, listed } = await start($, on)
  await type($, 'alpha')
  await cleared($)
  expect(await listed()).toEqual([])
  await clock.advance(SUBMIT_WAIT_MS)
  expect(await listed()).toEqual(['alpha'])
})

test('a submitted draft is not recorded', async ($, on) => {
  const { clock, listed } = await start($, on)
  await type($, 'say ok')
  await cleared($)
  await $.prompt.submit({ text: 'say ok' } as never)
  await clock.advance(SUBMIT_WAIT_MS)
  expect(await listed()).toEqual([])
})

test('a whitespace-only draft is not recorded', async ($, on) => {
  const { clock, listed } = await start($, on)
  await type($, '   ')
  await cleared($)
  await clock.advance(SUBMIT_WAIT_MS)
  expect(await listed()).toEqual([])
})

test("the plugin's own fill is tracked as the draft, never recorded by itself", async ($, on) => {
  const { clock, listed } = await start($, on)
  await $.prompt.change({ text: 'recalled', cursor: 8, origin: { kind: 'plugin', name: 'prompt-stash' } } as never)
  await clock.advance(SUBMIT_WAIT_MS)
  expect(await listed()).toEqual([])
  await cleared($)
  await clock.advance(SUBMIT_WAIT_MS)
  expect(await listed()).toEqual(['recalled'])
})

test('a draft that ran as a slash command is not recorded', async ($, on) => {
  const { clock, listed } = await start($, on)
  await type($, '/stash')
  await cleared($)
  await clock.advance(SUBMIT_WAIT_MS)
  expect(await listed()).toEqual([])
})

test('a bash-mode draft is not recorded: its run empties the box with no submit', async ($, on) => {
  const { clock, listed } = await start($, on)
  await type($, '!sleep 2; echo slow')
  await cleared($)
  await clock.advance(SUBMIT_WAIT_MS)
  expect(await listed()).toEqual([])
})
