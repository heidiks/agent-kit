import { expect, test } from 'claude-code/testing'

import { sendNotification } from './providers'

const NOTE = { title: 'web-app !1', prTitle: 'feat: pix reconciliation', message: '✗ failed: build', url: 'https://x/pr/1' }

test('sendNotification: terminal-notifier first, osascript next, argv only', async () => {
  const calls: string[][] = []
  const io = {
    now: async () => 0,
    run: async (argv: string[]) => {
      calls.push(argv)
      if (argv[0] === 'terminal-notifier') throw new Error('not installed')
      return { exitCode: 0, stdout: '', stderr: '' }
    },
  }
  expect(await sendNotification(io, NOTE)).toBe(true)
  expect(calls.map(c => c[0])).toEqual(['terminal-notifier', 'osascript'])
  expect(calls[0]).toContain('-open')
  expect(calls[1]?.slice(-3)).toEqual(['pr-watch · web-app !1', 'feat: pix reconciliation', '✗ failed: build'])
})

test('sendNotification: reports false when nothing can notify', async () => {
  const io = { now: async () => 0, run: async () => ({ exitCode: 1, stdout: '', stderr: '' }) }
  expect(await sendNotification(io, NOTE)).toBe(false)
})
