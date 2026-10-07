import { expect, mock, test } from 'claude-code/testing'

const WEB = 'https://dev.azure.com/contoso/Contoso/_git/web-app'
const PR_SHOW = {
  status: 'active',
  title: 'feat: x',
  isDraft: true,
  mergeStatus: 'succeeded',
  targetRefName: 'refs/heads/master',
  reviewers: [{ displayName: '[Contoso]\\Code-Reviewers', vote: 0, isRequired: true, isContainer: true }],
  repository: { name: 'web-app', webUrl: WEB, project: { name: 'Contoso' } },
}
const POLICIES = [
  { status: 'rejected', context: { buildId: 7 }, configuration: { isBlocking: true, type: { displayName: 'Build' } } },
]
const TIMELINE = {
  records: [
    { id: 't', parentId: null, type: 'Task', name: 'Run Lint', state: 'completed', result: 'failed', order: 1, issues: [{ type: 'error', message: 'exit 2' }] },
  ],
}
const BAND = { hasSurvey: false, isWorking: false, maxRows: 30 } as never

function answer(argv: readonly string[]): { exitCode: number; stdout: string } {
  if (argv[0] === 'git') {
    return argv.includes('rev-parse') ? { exitCode: 0, stdout: 'feat/x\n' } : { exitCode: 0, stdout: `${WEB}\n` }
  }
  if (argv.includes('invoke')) return { exitCode: 0, stdout: JSON.stringify(TIMELINE) }
  if (argv.includes('policy')) return { exitCode: 0, stdout: JSON.stringify(POLICIES) }
  if (argv.includes('list')) return { exitCode: 0, stdout: '[]' }
  return { exitCode: 0, stdout: JSON.stringify(PR_SHOW) }
}

for (const surface of ['terminal', 'desktop'] as const) {
  test(`ADO PR created with az shows in the band with reason and investigate button (${surface})`, async ($, on) => {
    const clock = mock.clock(on, { now: 1_000_000 })
    mock.store(on)
    const prompts: string[] = []
    on('process.run', (_$, e) => ({
      value: { ...answer(e.argv), stderr: '', isStdoutTruncated: false, isStderrTruncated: false },
    }))
    on('tool.call', { tool: 'Bash' }, () => ({ result: { stdout: '', stderr: '', interrupted: false }, text: '{ "pullRequestId": 123 }' }))
    on('prompt.submit', (_$, e) => {
      prompts.push(e.text)
      return { text: e.text } as never
    })

    await $.tool.call({ tool: 'Bash', command: 'az repos pr create --title x' } as never)
    await clock.advance(1)

    const listed = await $.command.run({ command: 'pr-watch', args: '' } as never)
    expect(listed.text).toBe('✗ PR 123 web-app · gate · ✗ build  ◐ Code-Reviewers')

    const ui = await $.ui.mount({ plugin: 'pr-watch', surface, component: 'AbovePrompt', props: BAND })
    expect(await ui.find({ type: 'Text', text: 'TITLE' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: 'feat: x' })).toBeDefined()
    expect(await ui.find({ text: 'draft' })).toBeDefined()
    expect(await ui.find({ text: 'Run Lint: exit 2' })).toBeDefined()

    await ui.press({ key: 'inv-ado:123-7' })
    expect(prompts[0]).toContain('build 7')

    await ui.press({ key: 'mode' })
    expect((await ui.find({ key: 'mode' }))?.text).toBe('⇕ compact')
    await ui.press({ key: 'mode' })
    await ui.press({ key: 'mode' })

    await ui.press({ key: 'rm-ado:123' })
    expect(await ui.find({ text: 'remove?' })).toBeDefined()
    await ui.press({ key: 'rm-no-ado:123' })
    expect(await ui.find({ text: 'remove?' })).toBe(undefined)
    expect((await $.command.run({ command: 'pr-watch', args: '' } as never)).text).not.toBe('No PRs being watched.')

    await ui.press({ key: 'rm-ado:123' })
    await ui.press({ key: 'rm-yes-ado:123' })
    expect((await $.command.run({ command: 'pr-watch', args: '' } as never)).text).toBe('No PRs being watched.')
  })
}

test('az errors show on the PR row', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000_000 })
  mock.store(on)
  on('process.run', (_$, e) => ({
    value: e.argv[0] === 'az'
      ? { exitCode: 1, stdout: '', stderr: 'ERROR: token expired\n', isStdoutTruncated: false, isStderrTruncated: false }
      : { exitCode: 1, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false },
  }))

  await $.command.run({ command: 'pr-watch', args: '55' } as never)
  await clock.advance(1)

  const ui = await $.ui.mount({ plugin: 'pr-watch', surface: 'terminal', component: 'AbovePrompt', props: BAND })
  expect(await ui.find({ text: '! az: token expired' })).toBeDefined()
})

for (const surface of ['terminal', 'desktop'] as const) {
  test(`all four styles render and the button cycles them (${surface})`, async ($, on) => {
    const clock = mock.clock(on, { now: 1_000_000 })
    mock.store(on)
    on('process.run', (_$, e) => ({
      value: { ...answer(e.argv), stderr: '', isStdoutTruncated: false, isStderrTruncated: false },
    }))

    await $.command.run({ command: 'pr-watch', args: '123' } as never)
    await clock.advance(1)

    const ui = await $.ui.mount({ plugin: 'pr-watch', surface, component: 'AbovePrompt', props: BAND })
    for (const expected of ['table', 'tree', 'cards', 'trail', 'table']) {
      expect((await ui.find({ key: 'style' }))?.text).toBe(`▤ ${expected}`)
      expect(await ui.find({ text: 'Run Lint: exit 2' })).toBeDefined()
      for (let i = 0; i < 3; i++) {
        await ui.press({ key: 'mode' })
        await ui.drawn()
      }
      await ui.press({ key: 'style' })
    }

    await $.command.run({ command: 'pr-watch', args: 'style table' } as never)
    expect(await ui.find({ text: 'SINCE' })).toBeDefined()
  })
}

const GH_PR = {
  state: 'OPEN',
  isDraft: false,
  mergeable: 'MERGEABLE',
  title: 'fix: spacing',
  url: 'https://github.com/octo-org/website/pull/300',
  closedAt: null,
  mergeCommit: null,
  reviewDecision: '',
  latestReviews: [],
  reviewRequests: [],
  statusCheckRollup: [
    { __typename: 'CheckRun', name: 'test', status: 'COMPLETED', conclusion: 'FAILURE', detailsUrl: 'https://github.com/octo-org/website/actions/runs/1/job/42' },
  ],
}

function ghAnswer(argv: readonly string[]): string {
  if (argv.includes('view')) return JSON.stringify(GH_PR)
  if (argv.some(a => a.endsWith('/annotations'))) return JSON.stringify([{ annotation_level: 'failure', message: 'exit code 1', path: 'src/a.ts' }])
  return '{}'
}

for (const surface of ['terminal', 'desktop'] as const) {
  test(`GitHub PR created with gh shows with # and gh source (${surface})`, async ($, on) => {
    const clock = mock.clock(on, { now: 1_000_000 })
    mock.store(on)
    const prompts: string[] = []
    on('process.run', (_$, e) => ({
      value: { exitCode: 0, stdout: e.argv[0] === 'gh' ? ghAnswer(e.argv) : answer(e.argv).stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false },
    }))
    on('tool.call', { tool: 'Bash' }, () => ({
      result: { stdout: '', stderr: '', interrupted: false },
      text: 'https://github.com/octo-org/website/pull/300\n',
    }))
    on('prompt.submit', (_$, e) => {
      prompts.push(e.text)
      return { text: e.text } as never
    })

    await $.tool.call({ tool: 'Bash', command: 'gh pr create --fill' } as never)
    await clock.advance(1)

    const listed = await $.command.run({ command: 'pr-watch', args: '' } as never)
    expect(listed.text).toBe('✗ octo-org/website#300 · gate · ✗ test')

    const ui = await $.ui.mount({ plugin: 'pr-watch', surface, component: 'AbovePrompt', props: BAND })
    expect(await ui.find({ text: '#300' })).toBeDefined()
    expect(await ui.find({ text: 'gh' })).toBeDefined()
    expect(await ui.find({ text: 'src/a.ts: exit code 1' })).toBeDefined()

    await ui.press({ key: 'inv-gh:github.com/octo-org/website#300-42' })
    expect(prompts[0]).toContain('gh run view --job 42 --log-failed')
  })
}

test('github flag off refuses GitHub PRs', { options: { github: false } }, async ($, on) => {
  mock.clock(on, { now: 1_000_000 })
  mock.store(on)
  const answer = await $.command.run({ command: 'pr-watch', args: 'octo-org/website#300' } as never)
  expect(answer.text).toBe('octo-org/website#300: this integration is disabled in the plugin options.')
})

test('GHE host listed in options is accepted', { options: { githubHosts: 'github.com, github.example.com' } }, async ($, on) => {
  mock.clock(on, { now: 1_000_000 })
  mock.store(on)
  on('process.run', () => ({ value: { exitCode: 1, stdout: '', stderr: 'HTTP 401', isStdoutTruncated: false, isStderrTruncated: false } }))
  const answer = await $.command.run({ command: 'pr-watch', args: 'https://github.example.com/time/api/pull/7' } as never)
  expect(answer.text).toBe('Watching time/api#7.')
})

for (const theme of ['light', 'dark-daltonized'] as const) {
  test(`theme ${theme} picks readable muted text`, async ($, on) => {
    const clock = mock.clock(on, { now: 1_000_000 })
    mock.store(on)
    on('process.run', (_$, e) => ({
      value: { ...answer(e.argv), stderr: '', isStdoutTruncated: false, isStderrTruncated: false },
    }))
    on('config.set', (_$, e) => ({ value: e.value }))

    await $.config.set({ key: 'theme', value: theme } as never)
    await $.command.run({ command: 'pr-watch', args: '123' } as never)
    await clock.advance(1)

    const ui = await $.ui.mount({ plugin: 'pr-watch', surface: 'terminal', component: 'AbovePrompt', props: BAND })
    await $.command.run({ command: 'pr-watch', args: 'style tree' } as never)
    const title = await ui.find({ type: 'Text', text: 'feat: x' })
    const hide = await ui.find({ key: 'hide' })
    if (theme === 'light') {
      expect(title?.props.dimColor).toBe(undefined)
      expect(title?.props.color).toBe('inactive')
      expect(hide?.props.dimColor).toBe(false)
    } else {
      expect(title?.props.dimColor).toBe(true)
      expect(hide?.props.dimColor).toBe(true)
    }
    expect(hide?.text).toBe('⊖ hide')
  })
}

test('open button sends the PR URL to the system opener', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000_000 })
  mock.store(on)
  const opened: string[][] = []
  on('process.run', (_$, e) => {
    if (e.argv[0] === 'open') {
      opened.push([...e.argv])
      return { value: { exitCode: 0, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
    }
    return { value: { ...answer(e.argv), stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })

  await $.command.run({ command: 'pr-watch', args: '123' } as never)
  await clock.advance(1)

  const ui = await $.ui.mount({ plugin: 'pr-watch', surface: 'terminal', component: 'AbovePrompt', props: BAND })
  expect((await ui.find({ key: 'open-ado:123' }))?.props.variant).toBe('primary')
  await ui.press({ key: 'open-ado:123' })
  expect(opened).toEqual([['open', `${WEB}/pullrequest/123`]])
})

test('remove confirmation expires after a few seconds', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000_000 })
  mock.store(on)
  on('process.run', (_$, e) => ({ value: { ...answer(e.argv), stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }))

  await $.command.run({ command: 'pr-watch', args: '123' } as never)
  await clock.advance(1)
  const ui = await $.ui.mount({ plugin: 'pr-watch', surface: 'terminal', component: 'AbovePrompt', props: BAND })

  await ui.press({ key: 'rm-ado:123' })
  expect(await ui.find({ key: 'rm-yes-ado:123' })).toBeDefined()
  await clock.advance(6_001)
  expect(await ui.find({ key: 'rm-yes-ado:123' })).toBe(undefined)
  expect(await ui.find({ key: 'rm-ado:123' })).toBeDefined()
})

const ABANDONED = { ...PR_SHOW, status: 'abandoned' }

function manyAnswer(argv: readonly string[]): string {
  const id = Number(argv[argv.indexOf('--id') + 1])
  if (argv.includes('policy')) return JSON.stringify(POLICIES)
  return JSON.stringify(id >= 6 ? ABANDONED : PR_SHOW)
}

test('long lists: band shows maxRows, groups finished PRs and opens the rest in a pane', { options: { maxRows: 3 } }, async ($, on) => {
  const clock = mock.clock(on, { now: 1_000_000 })
  mock.store(on)
  const opened: string[] = []
  on('process.run', (_$, e) => ({
    value: { exitCode: 0, stdout: e.argv[0] === 'az' ? manyAnswer(e.argv) : '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false },
  }))
  on('ui.open', (_$, e) => {
    opened.push(e.id)
    return { value: { isPlaced: true } } as never
  })

  for (const id of [1, 2, 3, 4, 5, 6, 7]) {
    await $.command.run({ command: 'pr-watch', args: String(id) } as never)
  }
  await clock.advance(1)

  const band = await $.ui.mount({ plugin: 'pr-watch', surface: 'terminal', component: 'AbovePrompt', props: BAND })
  expect((await band.findAll({ type: 'Link' })).filter(l => /\/pullrequest\/\d+$/.test(String(l.props.href))).length).toBe(3)
  expect(await band.find({ type: 'Text', text: '✓ 2 finished' })).toBeDefined()
  expect((await band.find({ key: 'more' }))?.text).toContain('+2 more')

  await band.press({ key: 'toggle-done' })
  expect((await band.find({ key: 'more' }))?.text).toContain('+4 more')

  await band.press({ key: 'more' })
  expect(opened).toEqual(['pr-watch-overview'])

  const pane = await $.ui.mount({
    plugin: 'pr-watch', surface: 'terminal', component: 'Pane', requestId: 'pr-watch-overview',
    props: { title: 'Pull requests', isFocused: true, bodyColumns: 120 } as never,
  })
  expect((await pane.findAll({ type: 'Link' })).filter(l => /\/pullrequest\/\d+$/.test(String(l.props.href))).length).toBe(7)
  expect(await pane.find({ key: 'more' })).toBe(undefined)
})

test('mini mode: one line with counts and the most urgent PR', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000_000 })
  mock.store(on)
  on('process.run', (_$, e) => ({
    value: { exitCode: 0, stdout: e.argv[0] === 'az' ? manyAnswer(e.argv) : '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false },
  }))
  for (const id of [1, 2, 6]) {
    await $.command.run({ command: 'pr-watch', args: String(id) } as never)
  }
  await clock.advance(1)
  await $.command.run({ command: 'pr-watch', args: 'mode mini' } as never)

  const band = await $.ui.mount({ plugin: 'pr-watch', surface: 'terminal', component: 'AbovePrompt', props: BAND })
  expect((await band.findAll({ type: 'Link' })).filter(l => /\/pullrequest\/\d+$/.test(String(l.props.href))).length).toBe(1)
  expect(await band.find({ type: 'Text', text: 'build' })).toBeDefined()
  expect(await band.find({ type: 'Text', text: 'feat: x' })).toBeDefined()
  expect(await band.find({ key: 'style' })).toBe(undefined)
  expect((await band.find({ key: 'mode' }))?.text).toBe('⇕ mini')
  expect(await band.find({ key: 'overview' })).toBeDefined()
})

test('overview: scope filter by session, timeline and a haiku summary on demand', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000_000 })
  mock.store(on)
  const prompts: string[] = []
  on('process.run', (_$, e) => ({
    value: { exitCode: 0, stdout: e.argv[0] === 'az' ? manyAnswer(e.argv) : '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false },
  }))
  on('session.id', () => ({ value: 'session-a' }) as never)
  on('command.register', () => ({ value: { isRegistered: true } }) as never)
  on('config.list', () => ({ value: [{ key: 'theme', value: 'dark' }] }) as never)
  on('session.start', (_$, e) => e as never)
  on('model.complete', (_$, e) => {
    prompts.push(String(e.prompt))
    return { value: { isAnswered: true, text: '- PR 1 build is failing', usage: {} } } as never
  })

  await $.command.run({ command: 'pr-watch', args: '1' } as never)
  await $.session.start({ source: 'startup', cwd: '/tmp', surface: 'terminal', isInteractive: true } as never)
  await $.command.run({ command: 'pr-watch', args: '2' } as never)
  await clock.advance(1)

  const pane = await $.ui.mount({
    plugin: 'pr-watch', surface: 'terminal', component: 'Pane', requestId: 'pr-watch-overview',
    props: { title: 'PR overview', isFocused: true, bodyColumns: 120 } as never,
  })
  expect((await pane.find({ key: 'scope-session' }))?.text).toContain('this session (1)')
  expect(await pane.find({ type: 'Text', text: 'TIMELINE' })).toBeDefined()

  await pane.press({ key: 'scope-session' })
  expect((await pane.findAll({ type: 'Link' })).filter(l => /\/pullrequest\/\d+$/.test(String(l.props.href))).length).toBe(1)

  await pane.press({ key: 'summarize' })
  expect(prompts[0]).toContain('web-app !2')
  expect(prompts[0]).not.toContain('web-app !1')
  expect(await pane.find({ type: 'Text', text: '- PR 1 build is failing' })).toBeDefined()
})

test('a state change after the first read sends a system notification', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000_000 })
  mock.store(on)
  const notified: string[][] = []
  let buildStatus = 'running'
  on('process.run', (_$, e) => {
    if (e.argv[0] === 'osascript' || e.argv[0] === 'terminal-notifier') {
      notified.push([...e.argv])
      return { value: { exitCode: e.argv[0] === 'osascript' ? 0 : 1, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
    }
    const stdout = e.argv.includes('policy')
      ? JSON.stringify([{ status: buildStatus, context: { buildId: 7 }, configuration: { isBlocking: true, type: { displayName: 'Build' } } }])
      : e.argv[0] === 'az' && e.argv.includes('show') ? JSON.stringify(PR_SHOW) : e.argv.includes('invoke') ? JSON.stringify(TIMELINE) : ''
    return { value: { exitCode: 0, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  on('session.id', () => ({ value: 'session-a' }) as never)
  on('command.register', () => ({ value: { isRegistered: true } }) as never)
  on('config.list', () => ({ value: [] }) as never)
  on('session.start', (_$, e) => e as never)

  await $.session.start({ source: 'startup', cwd: '/tmp', surface: 'terminal', isInteractive: true } as never)
  await $.command.run({ command: 'pr-watch', args: '123' } as never)
  await clock.advance(1)
  expect(notified).toEqual([])

  buildStatus = 'rejected'
  await clock.advance(16_000)
  expect(notified.length).toBe(2)
  expect(notified[1]?.slice(-3)).toEqual(['pr-watch · web-app !123', 'feat: x', '✗ failed: build'])
})

test('mine imports your open PRs from both providers and reports provider errors', { options: { githubHosts: 'github.com, github.example.com' } }, async ($, on) => {
  const clock = mock.clock(on, { now: 1_000_000 })
  mock.store(on)
  const calls: string[][] = []
  on('process.run', (_$, e) => {
    calls.push([...e.argv])
    const ok = (stdout: unknown) => ({ value: { exitCode: 0, stdout: JSON.stringify(stdout), stderr: '', isStdoutTruncated: false, isStderrTruncated: false } })
    if (e.argv.includes('account')) return ok('alice@contoso.com')
    if (e.argv.includes('policy')) return ok([])
    if (e.argv.includes('list') && e.argv[0] === 'az') return ok([{ pullRequestId: 11, repository: { name: 'web-app' } }, { pullRequestId: 12, repository: { name: 'api' } }])
    if (e.argv[0] === 'env') return { value: { exitCode: 1, stdout: '', stderr: 'HTTP 401: Bad credentials\n', isStdoutTruncated: false, isStderrTruncated: false } }
    if (e.argv.includes('search')) return ok([{ number: 300, repository: { nameWithOwner: 'octo-org/website' } }])
    return ok(PR_SHOW)
  })

  await $.command.run({ command: 'pr-watch', args: '11' } as never)
  const answer = await $.command.run({ command: 'pr-watch', args: 'mine' } as never)
  expect(answer.text).toBe('Watching 3 of your open PRs (2 new).\n! gh (github.example.com): HTTP 401: Bad credentials')
  expect(calls.find(c => c[0] === 'az' && c.includes('list'))).toContain('alice@contoso.com')
  expect(calls.find(c => c[0] === 'env')?.[1]).toBe('GH_HOST=github.example.com')
  await clock.advance(1)
  const listed = await $.command.run({ command: 'pr-watch', args: '' } as never)
  expect(listed.text).toContain('octo-org/website#300')
})

test('a malformed provider response shows as an error on the row instead of breaking the refresh', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000_000 })
  mock.store(on)
  on('process.run', (_$, e) => ({
    value: { exitCode: 0, stdout: JSON.stringify(e.argv.includes('policy') ? [{ nope: true }] : PR_SHOW), stderr: '', isStdoutTruncated: false, isStderrTruncated: false },
  }))
  await $.command.run({ command: 'pr-watch', args: '123' } as never)
  await clock.advance(1)
  const ui = await $.ui.mount({ plugin: 'pr-watch', surface: 'terminal', component: 'AbovePrompt', props: BAND })
  expect(await ui.find({ text: '! az: unexpected response' })).toBeDefined()
})

const SPEC_FILE = `---
id: PRD-20261007-retry
title: "Retry with backoff"
status: In Progress
phase: implement
---`

const REVIEW_TASK = `---
id: TASK-002
prd_id: PRD-20261007-retry
title: "Client"
status: In Review
prs:
  - https://dev.azure.com/contoso/Contoso/_git/web-app/pullrequest/123
---`

const MERGED_PR = { ...PR_SHOW, status: 'completed', closedDate: '2026-01-01T00:00:00Z', lastMergeCommit: { commitId: 'abc' }, description: 'Task: PRD-20261007-retry/TASK-002' }

test('spec tasks: PRs of tasks in review are watched, linked in the TASK column, and mark done asks Claude', async ($, on) => {
  const clock = mock.clock(on, { now: Date.parse('2026-01-02T00:00:00Z') })
  mock.store(on)
  const prompts: string[] = []
  const files: Record<string, string> = {
    '/repo/docs/prd/web-app/PRD-20261007-retry/spec.md': SPEC_FILE,
    '/repo/docs/prd/web-app/PRD-20261007-retry/TASK-002-client.md': REVIEW_TASK,
  }
  const entry = (name: string, kind: 'file' | 'dir') => ({ name, kind, size: 0, mtimeMs: 0, isLink: false })
  on('session.root', () => ({ value: '/repo' }) as never)
  on('session.id', () => ({ value: 'session-a' }) as never)
  on('command.register', () => ({ value: { isRegistered: true } }) as never)
  on('config.list', () => ({ value: [] }) as never)
  on('session.start', (_$, e) => e as never)
  on('fs.exists', (_$, e) => ({ value: e.path === '/repo/docs/prd' }) as never)
  on('fs.list', (_$, e) => {
    const listing: Record<string, ReturnType<typeof entry>[]> = {
      '/repo/docs/prd': [entry('web-app', 'dir')],
      '/repo/docs/prd/web-app': [entry('PRD-20261007-retry', 'dir'), entry('README.md', 'file')],
      '/repo/docs/prd/web-app/PRD-20261007-retry': [entry('spec.md', 'file'), entry('TASK-002-client.md', 'file')],
    }
    return { value: listing[e.path] ?? [] } as never
  })
  on('fs.read', (_$, e) => ({ value: files[e.path] ?? '' }) as never)
  on('process.run', (_$, e) => {
    const out = (stdout: unknown) => ({ value: { exitCode: 0, stdout: JSON.stringify(stdout), stderr: '', isStdoutTruncated: false, isStderrTruncated: false } })
    if (e.argv[0] === 'git') return { value: { exitCode: 1, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
    if (e.argv.includes('runs')) return out([{ id: 9, status: 'completed', result: 'succeeded', sourceVersion: 'abc', definition: { name: 'CI' } }])
    if (e.argv.includes('invoke')) return out({ records: [] })
    return out(MERGED_PR)
  })
  on('prompt.submit', (_$, e) => {
    prompts.push(e.text)
    return { text: e.text } as never
  })

  await $.session.start({ source: 'startup', cwd: '/repo', surface: 'terminal', isInteractive: true } as never)
  await clock.advance(1)
  const listed = await $.command.run({ command: 'pr-watch', args: '' } as never)
  expect(listed.text).toContain('PR 123 web-app')

  const ui = await $.ui.mount({ plugin: 'pr-watch', surface: 'terminal', component: 'AbovePrompt', props: BAND })
  expect(await ui.find({ type: 'Text', text: 'TASK' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'TASK-002' })).toBeDefined()

  const pane = await $.ui.mount({
    plugin: 'pr-watch', surface: 'terminal', component: 'Pane', requestId: 'pr-watch-overview',
    props: { title: 'PR overview', isFocused: true, bodyColumns: 140 } as never,
  })
  expect(await pane.find({ type: 'Text', text: 'PLANS' })).toBeDefined()
  expect(await pane.find({ type: 'Text', text: '0/1 done · In Progress · implement' })).toBeDefined()

  await ui.press({ key: 'done-ado:123' })
  expect(prompts[0]).toContain('Mark TASK-002 of PRD-20261007-retry as Done')
  expect(prompts[0]).toContain('docs/prd/web-app/PRD-20261007-retry/TASK-002-client.md')
})
