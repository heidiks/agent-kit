import { expect, mock, test } from 'claude-code/testing'
import type { Engine, On } from 'claude-code'

import type { StashItem } from '../types'
import { addItem } from './store'
import { hintTail } from './view'

const HINT = { isDraft: false, isWorking: false, hint: '? for shortcuts' } as never

async function start($: Engine, on: On, stored: StashItem[]) {
  mock.clock(on, { now: 1_000_000 })
  mock.store(on, { items: stored })
  on('session.root', () => ({ value: '/work/x' }) as never)
  on('session.start', (_$, e) => e as never)
  on('command.register', () => ({ value: { isRegistered: true } }) as never)
  on('ui.render', { component: 'PromptHint' }, (_$, e) => {
    const { Text } = _$.ui.resolve(e)
    return <Text>{[e.props.hint, e.props.tail].filter(Boolean).join(' · ')}</Text>
  })
  await $.session.start({ source: 'startup', cwd: '/work/x', surface: 'terminal', isInteractive: true } as never)
  return $.ui.mount({ plugin: 'prompt-stash', surface: 'terminal', component: 'PromptHint', props: HINT })
}

test('with nothing stashed in the project, the hint line is left as is', async ($, on) => {
  const line = await start($, on, addItem([], 'elsewhere', '/work/y', 1))
  expect(await line.find({ type: 'Text', text: '? for shortcuts' })).toBeDefined()
})

test('with stashed drafts, the count goes at the end of the hint line', async ($, on) => {
  const line = await start($, on, addItem(addItem([], 'a', '/work/x', 1), 'b', '/work/x', 2))
  expect(await line.find({ type: 'Text', text: '? for shortcuts · ✎ 2 stashed (/stash)' })).toBeDefined()
})

test("another plugin's tail is kept before the count", () => {
  expect(hintTail(3, 'other')).toBe('other · ✎ 3 stashed (/stash)')
  expect(hintTail(1)).toBe('✎ 1 stashed (/stash)')
})
