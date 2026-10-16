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
    on('session.id', () => ({ value: 'session-a' }) as never)
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
    expect((await ui.find({ key: 'exp-title-ado:123' }))?.text).toBe('feat: x')
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
  on('session.id', () => ({ value: 'session-a' }) as never)
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
    on('session.id', () => ({ value: 'session-a' }) as never)
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
    on('session.id', () => ({ value: 'session-a' }) as never)
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
  on('session.id', () => ({ value: 'session-a' }) as never)
  const answer = await $.command.run({ command: 'pr-watch', args: 'octo-org/website#300' } as never)
  expect(answer.text).toBe('octo-org/website#300: this integration is disabled in the plugin options.')
})

test('GHE host listed in options is accepted', { options: { githubHosts: 'github.com, github.example.com' } }, async ($, on) => {
  mock.clock(on, { now: 1_000_000 })
  mock.store(on)
  on('session.id', () => ({ value: 'session-a' }) as never)
  on('process.run', () => ({ value: { exitCode: 1, stdout: '', stderr: 'HTTP 401', isStdoutTruncated: false, isStderrTruncated: false } }))
  const answer = await $.command.run({ command: 'pr-watch', args: 'https://github.example.com/time/api/pull/7' } as never)
  expect(answer.text).toBe('Watching time/api#7.')
})

for (const theme of ['light', 'dark-daltonized'] as const) {
  test(`theme ${theme} picks readable muted text`, async ($, on) => {
    const clock = mock.clock(on, { now: 1_000_000 })
    mock.store(on)
    on('session.id', () => ({ value: 'session-a' }) as never)
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
  on('session.id', () => ({ value: 'session-a' }) as never)
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
  on('session.id', () => ({ value: 'session-a' }) as never)
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
  on('session.id', () => ({ value: 'session-a' }) as never)
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
  on('session.id', () => ({ value: 'session-a' }) as never)
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
  mock.store(on, {
    'prs:session-b': [{
      key: 'ado:1', provider: 'ado', id: 1, repo: 'web-app', project: 'Contoso', title: 't', url: `${WEB}/pullrequest/1`,
      phase: 'gate', checks: [], isDraft: false, isFailed: false, isDone: false, sessions: ['session-b'], checkedAt: 1_000_000,
    }],
  })
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

test('mine watches your PRs from the session repo and catalogs the rest for the overview', { options: { githubHosts: 'github.com, github.example.com', currentBranch: false, tasks: false } }, async ($, on) => {
  const clock = mock.clock(on, { now: 1_000_000 })
  mock.store(on)
  const calls: string[][] = []
  on('process.run', (_$, e) => {
    calls.push([...e.argv])
    const ok = (stdout: unknown) => ({ value: { exitCode: 0, stdout: JSON.stringify(stdout), stderr: '', isStdoutTruncated: false, isStderrTruncated: false } })
    if (e.argv[0] === 'git') return { value: { exitCode: 0, stdout: `${WEB}\n`, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
    if (e.argv.includes('account')) return ok('alice@contoso.com')
    if (e.argv.includes('policy')) return ok([])
    if (e.argv.includes('list') && e.argv[0] === 'az') return ok([{ pullRequestId: 11, repository: { name: 'web-app' } }, { pullRequestId: 12, repository: { name: 'api' } }])
    if (e.argv[0] === 'env') return { value: { exitCode: 1, stdout: '', stderr: 'HTTP 401: Bad credentials\n', isStdoutTruncated: false, isStderrTruncated: false } }
    if (e.argv.includes('search')) return ok([{ number: 300, repository: { nameWithOwner: 'octo-org/website' } }])
    return ok(PR_SHOW)
  })

  on('session.id', () => ({ value: 'session-a' }) as never)
  on('command.register', () => ({ value: { isRegistered: true } }) as never)
  on('config.list', () => ({ value: [] }) as never)
  on('session.start', (_$, e) => e as never)
  await $.session.start({ source: 'startup', cwd: '/tmp', surface: 'terminal', isInteractive: true } as never)
  await $.command.run({ command: 'pr-watch', args: '11' } as never)
  const answer = await $.command.run({ command: 'pr-watch', args: 'mine' } as never)
  expect(answer.text).toBe('Watching 1 of your open PRs from web-app.\n2 from other repos are in the overview (all filter): use "+ watch here" on the ones that belong to this session.\n! gh (github.example.com): HTTP 401: Bad credentials')
  expect(calls.find(c => c[0] === 'az' && c.includes('list'))).toContain('alice@contoso.com')
  expect(calls.find(c => c[0] === 'az' && c.includes('list'))).toContain('--detect')
  expect(calls.find(c => c[0] === 'env')?.[1]).toBe('GH_HOST=github.example.com')
  await clock.advance(1)
  const listed = await $.command.run({ command: 'pr-watch', args: '' } as never)
  expect(listed.text).toContain('PR 11')
  expect(listed.text).not.toContain('PR 12')
  expect(listed.text).not.toContain('octo-org/website#300')
  expect(calls.some(c => c[0] === 'az' && c.includes('--id') && c.includes('12'))).toBe(true)
})

test('a malformed provider response shows as an error on the row instead of breaking the refresh', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000_000 })
  mock.store(on)
  on('session.id', () => ({ value: 'session-a' }) as never)
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

  for (const style of ['tree', 'cards', 'trail']) {
    await $.command.run({ command: 'pr-watch', args: `style ${style}` } as never)
    const band = await $.ui.mount({ plugin: 'pr-watch', surface: 'terminal', component: 'AbovePrompt', props: BAND })
    expect(await band.find({ type: 'Text', text: 'TASK-002' })).toBeDefined()
    expect(await band.find({ key: 'done-ado:123' })).toBeDefined()
  }
  await $.command.run({ command: 'pr-watch', args: 'style table' } as never)

  const pane = await $.ui.mount({
    plugin: 'pr-watch', surface: 'terminal', component: 'Pane', requestId: 'pr-watch-overview',
    props: { title: 'PR overview', isFocused: true, bodyColumns: 140 } as never,
  })
  expect(await pane.find({ type: 'Text', text: 'PLANS' })).toBeDefined()
  expect(await pane.find({ type: 'Text', text: '0/1 done · In Progress · implement' })).toBeDefined()
  const hrefs = (await pane.findAll({ type: 'Link' })).map(l => String(l.props.href))
  expect(hrefs).toContain('file:///repo/docs/prd/web-app/PRD-20261007-retry/spec.md')
  expect(hrefs).toContain('file:///repo/docs/prd/web-app/PRD-20261007-retry/TASK-002-client.md')
  expect(hrefs.filter(h => h === `${WEB}/pullrequest/123`).length).toBeGreaterThan(1)

  await ui.press({ key: 'done-ado:123' })
  expect(prompts[0]).toContain('Mark TASK-002 of PRD-20261007-retry as Done')
  expect(prompts[0]).toContain('docs/prd/web-app/PRD-20261007-retry/TASK-002-client.md')
})

test('session scope: another session PRs stay out of the band and polling until brought here', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000_000 })
  const other = {
    key: 'ado:77', provider: 'ado', id: 77, repo: 'web-app', project: 'Contoso', title: 'other front', url: `${WEB}/pullrequest/77`,
    phase: 'gate', checks: [{ name: 'build', state: 'running' }], isDraft: false, isFailed: false, isDone: false, sessions: ['session-b'],
  }
  mock.store(on, { prs: [other] })
  const polled: string[] = []
  on('process.run', (_$, e) => {
    if (e.argv[0] === 'az') polled.push(e.argv.join(' '))
    const stdout = e.argv.includes('policy') ? JSON.stringify(POLICIES) : e.argv[0] === 'az' ? JSON.stringify(PR_SHOW) : ''
    return { value: { exitCode: e.argv[0] === 'git' ? 1 : 0, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  on('session.id', () => ({ value: 'session-a' }) as never)
  on('command.register', () => ({ value: { isRegistered: true } }) as never)
  on('config.list', () => ({ value: [] }) as never)
  on('session.start', (_$, e) => e as never)
  on('fs.exists', () => ({ value: false }) as never)

  await $.session.start({ source: 'startup', cwd: '/tmp', surface: 'terminal', isInteractive: true } as never)
  await clock.advance(20_000)
  expect(polled).toEqual([])
  expect((await $.command.run({ command: 'pr-watch', args: '' } as never)).text).toBe('No PRs being watched.')

  const pane = await $.ui.mount({
    plugin: 'pr-watch', surface: 'terminal', component: 'Pane', requestId: 'pr-watch-overview',
    props: { title: 'PR overview', isFocused: true, bodyColumns: 140 } as never,
  })
  expect((await pane.find({ key: 'scope-session' }))?.text).toContain('this session (0)')
  await pane.press({ key: 'scope-all' })
  await pane.press({ key: 'adopt-ado:77' })
  await clock.advance(1)
  expect(polled.some(cmd => cmd.includes('--id 77'))).toBe(true)
  expect((await $.command.run({ command: 'pr-watch', args: '' } as never)).text).toContain('PR 77')
})

test('az pr create with -o tsv watches every created PR, across repos', async ($, on) => {
  const clock = mock.clock(on, { now: Date.parse('2026-10-07T17:38:00Z') })
  mock.store(on)
  on('session.id', () => ({ value: 'session-a' }) as never)
  on('process.run', (_$, e) => {
    const ok = (stdout: unknown) => ({ value: { exitCode: 0, stdout: JSON.stringify(stdout), stderr: '', isStdoutTruncated: false, isStderrTruncated: false } })
    if (e.argv.includes('account')) return ok('alice@contoso.com')
    if (e.argv.includes('list')) return ok([])
    if (e.argv.includes('policy')) return ok(POLICIES)
    return ok(PR_SHOW)
  })
  on('tool.call', { tool: 'Bash' }, () => ({ result: { stdout: '', stderr: '', interrupted: false }, text: '19758\n19759\n' }))

  await $.tool.call({ tool: 'Bash', command: 'az repos pr create -r go-monorepo --query pullRequestId -o tsv; az repos pr create -r ei-host --query pullRequestId -o tsv' } as never)
  await clock.advance(1)
  const listed = await $.command.run({ command: 'pr-watch', args: '' } as never)
  expect(listed.text).toContain('PR 19758')
  expect(listed.text).toContain('PR 19759')
})

test('a PR create whose output names no id is found by asking Azure DevOps for PRs created just now', async ($, on) => {
  const now = Date.parse('2026-10-07T17:38:00Z')
  const clock = mock.clock(on, { now })
  mock.store(on)
  on('session.id', () => ({ value: 'session-a' }) as never)
  on('process.run', (_$, e) => {
    const ok = (stdout: unknown) => ({ value: { exitCode: 0, stdout: JSON.stringify(stdout), stderr: '', isStdoutTruncated: false, isStderrTruncated: false } })
    if (e.argv.includes('account')) return ok('alice@contoso.com')
    if (e.argv.includes('list')) {
      return ok([
        { pullRequestId: 19759, creationDate: '2026-10-07T17:37:30Z', repository: { name: 'ei-host' } },
        { pullRequestId: 18463, creationDate: '2026-09-01T10:00:00Z', repository: { name: 'go-monorepo' } },
      ])
    }
    if (e.argv.includes('policy')) return ok(POLICIES)
    return ok(PR_SHOW)
  })
  on('tool.call', { tool: 'Bash' }, () => ({ result: { stdout: '', stderr: '', interrupted: false }, text: 'retarget 200\n' }))

  await $.tool.call({ tool: 'Bash', command: 'curl -s -X POST "https://dev.azure.com/o/p/_apis/git/repositories/ei-host/pullrequests?api-version=7.1" -d @body.json' } as never)
  await clock.advance(1)
  const listed = await $.command.run({ command: 'pr-watch', args: '' } as never)
  expect(listed.text).toContain('PR 19759')
  expect(listed.text).not.toContain('PR 18463')
})

for (const [width, repo, title] of [[80, false, false], [100, true, false], [140, true, true]] as const) {
  test(`table fits ${width} columns: REPO ${repo ? 'shown' : 'hidden'}, TITLE ${title ? 'shown' : 'hidden'}`, async ($, on) => {
    const clock = mock.clock(on, { now: 1_000_000 })
    mock.store(on)
    on('session.id', () => ({ value: 'session-a' }) as never)
    on('process.run', (_$, e) => ({
      value: { ...answer(e.argv), stderr: '', isStdoutTruncated: false, isStderrTruncated: false },
    }))
    await $.command.run({ command: 'pr-watch', args: '123' } as never)
    await clock.advance(1)
    const ui = await $.ui.mount({ plugin: 'pr-watch', surface: 'terminal', component: 'AbovePrompt', props: { ...(BAND as object), bodyColumns: width } as never, viewport: { columns: width, rows: 40 } })
    expect((await ui.find({ type: 'Text', text: 'REPO' })) !== undefined).toBe(repo)
    expect((await ui.find({ type: 'Text', text: 'TITLE' })) !== undefined).toBe(title)
    expect(await ui.find({ type: 'Text', text: 'CHECKS' })).toBeDefined()
  })
}

test('clear-all drops this session PRs but keeps the ones another session also watches', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000_000 })
  const pr = (id: number, sessions: string[]) => ({
    key: `ado:${id}`, provider: 'ado', id, repo: 'web-app', project: 'Contoso', title: 't', url: `${WEB}/pullrequest/${id}`,
    phase: 'gate', checks: [], isDraft: false, isFailed: false, isDone: false, sessions,
  })
  mock.store(on, { prs: [pr(1, ['session-a']), pr(2, ['session-a', 'session-b']), pr(3, ['session-b'])] })
  on('process.run', (_$, e) => ({ value: { exitCode: e.argv[0] === 'git' ? 1 : 0, stdout: e.argv.includes('policy') ? '[]' : JSON.stringify(PR_SHOW), stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }))
  on('session.id', () => ({ value: 'session-a' }) as never)
  on('command.register', () => ({ value: { isRegistered: true } }) as never)
  on('config.list', () => ({ value: [] }) as never)
  on('session.start', (_$, e) => e as never)
  on('fs.exists', () => ({ value: false }) as never)

  await $.session.start({ source: 'startup', cwd: '/tmp', surface: 'terminal', isInteractive: true } as never)
  await clock.advance(1)
  expect((await $.command.run({ command: 'pr-watch', args: 'clear-all' } as never)).text).toBe('Stopped watching 2 PR(s) in this session.')
  expect((await $.command.run({ command: 'pr-watch', args: '' } as never)).text).toBe('No PRs being watched.')

  const pane = await $.ui.mount({
    plugin: 'pr-watch', surface: 'terminal', component: 'Pane', requestId: 'pr-watch-overview',
    props: { title: 'PR overview', isFocused: true, bodyColumns: 140 } as never,
  })
  await pane.press({ key: 'scope-all' })
  const ids = (await pane.findAll({ type: 'Link' })).map(l => String(l.props.href)).filter(h => /pullrequest\/\d+$/.test(h)).map(h => h.split('/').pop())
  expect([...new Set(ids)].sort()).toEqual(['2', '3'])
})

test('several PRs at once, separated by spaces or commas, each reported', async ($, on) => {
  mock.clock(on, { now: 1_000_000 })
  mock.store(on)
  on('session.id', () => ({ value: 'session-a' }) as never)
  on('process.run', (_$, e) => ({ value: { ...answer(e.argv), stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }))
  const added = await $.command.run({ command: 'pr-watch', args: '101 102,103  octo-org/website#7, nope' } as never)
  expect(added.text).toBe([
    'Watching PR 101.',
    'Watching PR 102.',
    'Watching PR 103.',
    'Watching octo-org/website#7.',
    'Could not parse "nope". Use an ADO id, a PR URL or owner/repo#N.',
  ].join('\n'))
  expect((await $.command.run({ command: 'pr-watch', args: '101' } as never)).text).toBe('PR 101 is already being watched.')
  await $.command.run({ command: 'pr-watch', args: 'rm 101, 102' } as never)
  const listed = (await $.command.run({ command: 'pr-watch', args: '' } as never)).text ?? ''
  expect(listed.includes('PR 101') || listed.includes('PR 102')).toBe(false)
  expect(listed).toContain('PR 103')
})

test('clicking the title opens a detail line with the full title, repo and branches; one at a time', async ($, on) => {
  const clock = mock.clock(on, { now: Date.parse('2026-10-07T12:00:00Z') })
  mock.store(on)
  on('session.id', () => ({ value: 'session-a' }) as never)
  const longTitle = 'feat(auth-gatekeeper): login only through the identity provider configured for the tenant'
  on('process.run', (_$, e) => {
    const show = { ...PR_SHOW, title: longTitle, creationDate: '2026-10-07T10:00:00Z', sourceRefName: 'refs/heads/agk-parameter', targetRefName: 'refs/heads/master' }
    const stdout = e.argv.includes('policy') ? JSON.stringify(POLICIES) : e.argv[0] === 'az' && e.argv.includes('show') ? JSON.stringify(show) : e.argv.includes('invoke') ? JSON.stringify(TIMELINE) : ''
    return { value: { exitCode: 0, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  await $.command.run({ command: 'pr-watch', args: '123 124' } as never)
  await clock.advance(1)
  const ui = await $.ui.mount({ plugin: 'pr-watch', surface: 'terminal', component: 'AbovePrompt', props: { ...(BAND as object), bodyColumns: 160 } as never, viewport: { columns: 160, rows: 40 } })

  expect((await ui.find({ key: 'exp-title-ado:123' }))?.text).toBe('feat(auth-gatekeeper): login…')
  expect(await ui.find({ type: 'Text', text: longTitle })).toBe(undefined)

  await ui.press({ key: 'exp-title-ado:123' })
  expect(await ui.find({ type: 'Text', text: longTitle })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'repo contoso/Contoso/web-app · agk-parameter → master · opened 2h ago' })).toBeDefined()

  await ui.press({ key: 'exp-repo-ado:124' })
  expect(await ui.find({ key: 'exp-close-ado:123' })).toBe(undefined)
  expect(await ui.find({ key: 'exp-close-ado:124' })).toBeDefined()

  await ui.press({ key: 'exp-close-ado:124' })
  expect(await ui.find({ type: 'Text', text: longTitle })).toBe(undefined)
})

test('help lists every command the plugin answers', async ($, on) => {
  mock.clock(on, { now: 1_000_000 })
  mock.store(on)
  on('session.id', () => ({ value: 'session-a' }) as never)
  const text = (await $.command.run({ command: 'pr-watch', args: 'help' } as never)).text ?? ''
  for (const usage of ['/pr-watch mine', '/pr-watch rm', '/pr-watch clear-all', '/pr-watch overview', '/pr-watch mode', '/pr-watch style', '/pr-watch hide | show', '/pr-watch help']) {
    expect(text).toContain(usage)
  }
})

type On = Parameters<Extract<Parameters<typeof test>[1], (...args: never[]) => unknown>>[1]

function memoryStore(on: On, seed: Record<string, unknown>): Map<string, unknown> {
  const data = new Map(Object.entries(seed))
  on('store.get' as never, ((_$: unknown, e: { key: string }) => ({ value: data.get(e.key) })) as never)
  on('store.set' as never, ((_$: unknown, e: { key: string; value: unknown }) => {
    data.set(e.key, e.value)
    return { value: undefined }
  }) as never)
  on('store.keys' as never, (() => ({ value: [...data.keys()] })) as never)
  on('store.delete' as never, ((_$: unknown, e: { key: string }) => {
    data.delete(e.key)
    return { value: undefined }
  }) as never)
  return data
}

const stored = (id: number, sessions: string[], checkedAt: number) => ({
  key: `ado:${id}`, provider: 'ado', id, repo: 'web-app', project: 'Contoso', title: 't', url: `${WEB}/pullrequest/${id}`,
  phase: 'gate', checks: [], isDraft: false, isFailed: false, isDone: false, sessions, checkedAt,
})

function startedSession(on: On, id: string): void {
  on('process.run', (_$, e) => ({ value: { exitCode: e.argv[0] === 'git' ? 1 : 0, stdout: e.argv.includes('policy') ? '[]' : JSON.stringify(PR_SHOW), stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }))
  on('session.id', () => ({ value: id }) as never)
  on('command.register', () => ({ value: { isRegistered: true } }) as never)
  on('config.list', () => ({ value: [] }) as never)
  on('session.start', (_$, e) => e as never)
  on('fs.exists', () => ({ value: false }) as never)
}

const DAY = 24 * 60 * 60 * 1000

test('each session saves under its own key and never overwrites another session list', async ($, on) => {
  const clock = mock.clock(on, { now: 30 * DAY })
  const data = memoryStore(on, { 'prs:session-b': [stored(9, ['session-b'], 30 * DAY)] })
  startedSession(on, 'session-a')

  await $.session.start({ source: 'startup', cwd: '/tmp', surface: 'terminal', isInteractive: true } as never)
  await $.command.run({ command: 'pr-watch', args: '5' } as never)
  await clock.advance(1)

  expect((data.get('prs:session-a') as { id: number }[]).map(p => p.id)).toEqual([5])
  expect((data.get('prs:session-b') as { id: number }[]).map(p => p.id)).toEqual([9])
  const listed = (await $.command.run({ command: 'pr-watch', args: '' } as never)).text ?? ''
  expect(listed).toContain('PR 5')
  expect(listed).not.toContain('PR 9')
})

test('a PR watched before session.start still belongs to the session', async ($, on) => {
  const clock = mock.clock(on, { now: 30 * DAY })
  const data = memoryStore(on, {})
  startedSession(on, 'session-a')

  await $.command.run({ command: 'pr-watch', args: '5' } as never)
  await $.session.start({ source: 'startup', cwd: '/tmp', surface: 'terminal', isInteractive: true } as never)
  await clock.advance(1)

  expect((data.get('prs:session-a') as { sessions: string[] }[])[0]?.sessions).toEqual(['session-a'])
  expect((await $.command.run({ command: 'pr-watch', args: '' } as never)).text).toContain('PR 5')
})

test('the old shared list migrates per session and old session lists are pruned', async ($, on) => {
  const clock = mock.clock(on, { now: 30 * DAY })
  const data = memoryStore(on, {
    prs: [stored(1, ['session-a'], 29 * DAY), stored(2, ['session-c'], 29 * DAY)],
    'prs:session-old': [stored(3, ['session-old'], DAY)],
    'prs:session-b': [stored(4, ['session-b'], 29 * DAY)],
  })
  startedSession(on, 'session-a')

  await $.session.start({ source: 'startup', cwd: '/tmp', surface: 'terminal', isInteractive: true } as never)
  await clock.advance(1)

  expect((data.get('prs:session-a') as { id: number }[]).map(p => p.id)).toEqual([1])
  expect(data.has('prs:session-old')).toBe(false)
  expect(data.has('prs:session-b')).toBe(true)
  expect(data.has('prs')).toBe(true)
})

test('a PR from another session can be adopted into this one', async ($, on) => {
  const clock = mock.clock(on, { now: 30 * DAY })
  const data = memoryStore(on, { 'prs:session-b': [stored(9, ['session-b'], 30 * DAY)] })
  startedSession(on, 'session-a')

  await $.session.start({ source: 'startup', cwd: '/tmp', surface: 'terminal', isInteractive: true } as never)
  await clock.advance(1)
  const pane = await $.ui.mount({
    plugin: 'pr-watch', surface: 'terminal', component: 'Pane', requestId: 'pr-watch-overview',
    props: { title: 'PR overview', isFocused: true, bodyColumns: 140 } as never,
  })
  await pane.press({ key: 'scope-all' })
  await pane.press({ key: 'adopt-ado:9' })
  await clock.advance(1)

  expect((data.get('prs:session-a') as { id: number; sessions: string[] }[]).map(p => [p.id, p.sessions])).toEqual([[9, ['session-a']]])
  expect((data.get('prs:session-b') as { id: number }[]).map(p => p.id)).toEqual([9])
})

test('focus: the band keeps only PRs that need you, trims green checks and remembers the choice', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000_000 })
  const data = memoryStore(on, {})
  const approved = { ...PR_SHOW, reviewers: [{ displayName: '[Contoso]\\Code-Reviewers', vote: 10, isRequired: true, isContainer: true }] }
  const running = [{ status: 'running', context: { buildId: 8 }, configuration: { isBlocking: true, type: { displayName: 'Build' } } }]
  on('process.run', (_$, e) => {
    const id = Number(e.argv[e.argv.indexOf('--id') + 1])
    const stdout = e.argv[0] !== 'az' ? '' : e.argv.includes('policy') ? JSON.stringify(id === 1 ? POLICIES : running) : JSON.stringify(id === 1 ? approved : PR_SHOW)
    return { value: { exitCode: e.argv[0] === 'git' ? 1 : 0, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  on('session.id', () => ({ value: 'session-a' }) as never)
  on('command.register', () => ({ value: { isRegistered: true } }) as never)
  on('config.list', () => ({ value: [] }) as never)
  on('session.start', (_$, e) => e as never)
  on('fs.exists', () => ({ value: false }) as never)
  on('fs.read', () => ({ value: JSON.stringify(TIMELINE) }) as never)

  await $.session.start({ source: 'startup', cwd: '/tmp', surface: 'terminal', isInteractive: true } as never)
  await $.command.run({ command: 'pr-watch', args: '1 2' } as never)
  await clock.advance(1)
  const prLinks = async (ui: { findAll: (q: object) => Promise<{ props: { href?: unknown } }[]> }) =>
    (await ui.findAll({ type: 'Link' })).map(l => String(l.props.href)).filter(h => /pullrequest\/\d+$/.test(h))

  const band = await $.ui.mount({ plugin: 'pr-watch', surface: 'terminal', component: 'AbovePrompt', props: BAND })
  expect((await prLinks(band)).length).toBe(2)
  await band.press({ key: 'focus' })
  expect(data.get('focus')).toBe(true)

  const focused = await $.ui.mount({ plugin: 'pr-watch', surface: 'terminal', component: 'AbovePrompt', props: BAND })
  expect(await prLinks(focused)).toEqual([`${WEB}/pullrequest/1`])
  expect(await focused.find({ type: 'Text', text: 'Code-Reviewers' })).toBe(undefined)
  expect(await focused.find({ type: 'Text', text: 'CHECKS' })).toBe(undefined)
  expect(await focused.find({ key: 'style' })).toBe(undefined)
  expect(await focused.find({ type: 'Text', text: 'The rest is on track' })).toBeDefined()

  expect((await $.command.run({ command: 'pr-watch', args: 'focus off' } as never)).text).toBe('Focus off: the band shows every PR.')
  expect(data.get('focus')).toBe(false)
  expect((await prLinks(await $.ui.mount({ plugin: 'pr-watch', surface: 'terminal', component: 'AbovePrompt', props: BAND }))).length).toBe(2)
})

test('focus with nothing to act on shows one quiet line', async ($, on) => {
  const clock = mock.clock(on, { now: 1_000_000 })
  memoryStore(on, { focus: true })
  startedSession(on, 'session-a')

  await $.session.start({ source: 'startup', cwd: '/tmp', surface: 'terminal', isInteractive: true } as never)
  await $.command.run({ command: 'pr-watch', args: '2' } as never)
  await clock.advance(1)

  const band = await $.ui.mount({ plugin: 'pr-watch', surface: 'terminal', component: 'AbovePrompt', props: BAND })
  expect(await band.find({ type: 'Text', text: 'Nothing needs you now' })).toBeDefined()
  expect((await band.findAll({ type: 'Link' })).filter(l => /pullrequest\/\d+$/.test(String(l.props.href))).length).toBe(0)
})
