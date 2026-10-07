import { expect, test } from 'claude-code/testing'

import {
  annotationReason,
  checkRunId,
  githubGateVerdict,
  githubKey,
  githubMergedVerdict,
  parseGithubRef,
  parseGithubRefs,
  parseGithubRemote,
  type GhPr,
} from './github'

const HOSTS = ['github.com', 'github.example.com']

const PR: GhPr = {
  state: 'OPEN',
  isDraft: false,
  mergeable: 'MERGEABLE',
  title: 't',
  url: 'https://github.com/o/r/pull/1',
  closedAt: null,
  mergeCommit: null,
  reviewDecision: '',
  latestReviews: [],
  reviewRequests: [],
  statusCheckRollup: [],
}

test('parses github.com and listed GHE URLs, shorthand, and refuses unlisted hosts', () => {
  expect(parseGithubRef('https://github.com/octo-org/website/pull/300', HOSTS)).toEqual({
    host: 'github.com', owner: 'octo-org', repo: 'website', number: 300,
  })
  expect(parseGithubRef('criado: https://github.example.com/time/api/pull/7\n', HOSTS)?.host).toBe('github.example.com')
  expect(parseGithubRef('octo-org/website#300', HOSTS)?.number).toBe(300)
  expect(parseGithubRef('https://outro.com/a/b/pull/1', HOSTS)).toBe(undefined)
  expect(githubKey({ host: 'github.com', owner: 'o', repo: 'r', number: 1 })).toBe('gh:github.com/o/r#1')
})

test('parses https and ssh GitHub remotes', () => {
  expect(parseGithubRemote('https://github.com/octo-org/website.git\n', HOSTS)).toEqual({ host: 'github.com', owner: 'octo-org', repo: 'website' })
  expect(parseGithubRemote('git@github.example.com:time/api.git', HOSTS)).toEqual({ host: 'github.example.com', owner: 'time', repo: 'api' })
  expect(parseGithubRemote('https://dev.azure.com/contoso/Contoso/_git/web-app', HOSTS)).toBe(undefined)
})

test('check run id comes from the Actions job URL', () => {
  expect(checkRunId('https://github.com/o/r/actions/runs/123/job/456')).toBe(456)
  expect(checkRunId('https://github.com/o/r/runs/789')).toBe(789)
  expect(checkRunId('https://ci.example.com/builds/abc')).toBe(undefined)
})

test('gate: check runs, legacy statuses, environment approval, conflict and reviewers', () => {
  const verdict = githubGateVerdict({
    ...PR,
    mergeable: 'CONFLICTING',
    statusCheckRollup: [
      { __typename: 'CheckRun', name: 'lint', status: 'COMPLETED', conclusion: 'FAILURE', detailsUrl: 'https://github.com/o/r/actions/runs/1/job/2' },
      { __typename: 'CheckRun', name: 'deploy', status: 'WAITING', conclusion: '' },
      { __typename: 'StatusContext', context: 'ci/legacy', state: 'PENDING', targetUrl: 'https://ci' },
    ],
    latestReviews: [{ author: { login: 'alice' }, state: 'APPROVED' }, { author: { login: 'bob' }, state: 'CHANGES_REQUESTED' }],
    reviewRequests: [{ slug: 'core-team' }],
  })
  expect(verdict.checks.map(c => [c.name, c.state, c.note])).toEqual([
    ['lint', 'fail', undefined],
    ['deploy', 'pending', 'awaiting approval'],
    ['ci/legacy', 'running', undefined],
    ['conflict', 'fail', undefined],
    ['core-team', 'pending', undefined],
    ['alice', 'ok', undefined],
    ['bob', 'warn', undefined],
  ])
  expect(verdict.checks[0]?.buildId).toBe(2)
  expect(verdict.isFailed).toBe(true)
})

test('gate: review required without reviewers is pending', () => {
  expect(githubGateVerdict({ ...PR, reviewDecision: 'REVIEW_REQUIRED' }).checks).toEqual([{ name: 'review', state: 'pending' }])
})

test('post-merge: external app check runs and statuses, done after settling', () => {
  const runs = [{ id: 9, name: 'deploy: website', status: 'completed', conclusion: 'success', html_url: 'https://github.com/o/r/runs/9' }]
  const statuses = [{ context: 'vercel', state: 'success', target_url: null }]
  expect(githubMergedVerdict(runs, statuses, 60_000).isDone).toBe(false)
  const settled = githubMergedVerdict(runs, statuses, 10 * 60_000)
  expect(settled.isDone).toBe(true)
  expect(settled.checks.map(c => c.state)).toEqual(['ok', 'ok'])
  expect(githubMergedVerdict([], [], 60_000).checks[0]?.name).toBe('waiting for checks')
})

test('reason: first failure annotation, with its file', () => {
  expect(annotationReason([
    { annotation_level: 'warning', message: 'deprecado' },
    { annotation_level: 'failure', message: 'Process completed with exit code 1.', path: '.github' },
    { annotation_level: 'failure', message: 'x', path: 'src/a.ts' },
  ])).toBe('Process completed with exit code 1.')
  expect(annotationReason([])).toBe(undefined)
})

test('parseGithubRefs: every PR URL in the output, deduplicated', () => {
  const out = 'https://github.com/o/a/pull/1\nhttps://github.com/o/b/pull/2\nhttps://github.com/o/a/pull/1\nhttps://outro.com/x/y/pull/3'
  expect(parseGithubRefs(out, HOSTS).map(ref => `${ref.repo}#${ref.number}`)).toEqual(['a#1', 'b#2'])
})
