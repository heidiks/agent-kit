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
    expect(await ui.find({ text: 'draft' })).toBeDefined()
    expect(await ui.find({ text: 'Run Lint: exit 2' })).toBeDefined()

    await ui.press({ key: 'inv-ado:123-7' })
    expect(prompts[0]).toContain('build 7')

    await ui.press({ key: 'collapse' })
    expect((await ui.find({ key: 'collapse' }))?.text).toBe('▾ expand')

    await ui.press({ key: 'rm-ado:123' })
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
      await ui.press({ key: 'collapse' })
      await ui.drawn()
      await ui.press({ key: 'collapse' })
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
