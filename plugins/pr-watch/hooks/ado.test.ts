import { expect, test } from 'claude-code/testing'

import type { WatchedPr } from '../types'
import {
  ago,
  applyCheck,
  byUrgency,
  describe,
  isStale,
  gateVerdict,
  mergedVerdict,
  mergeLists,
  overallState,
  parsePrId,
  parseTimeline,
  pollDelay,
  repoFromRemote,
  reviewerChecks,
  withDetail,
  type PolicyEvaluation,
  type PrDetails,
  type TimelineRecord,
} from './ado'

const WEB = 'https://dev.azure.com/contoso/Contoso/_git/web-app'
const PR: PrDetails = {
  status: 'active',
  title: 't',
  targetRefName: 'refs/heads/master',
  repository: { name: 'web-app', webUrl: WEB, project: { name: 'Contoso' } },
}

const policy = (type: string, status: string, buildId?: number): PolicyEvaluation => ({
  status,
  context: buildId ? { buildId } : null,
  configuration: { isBlocking: true, type: { displayName: type } },
})

const run = (id: number, name: string, status: string, result: string | null) => ({
  id, status, result, sourceVersion: 'abc', definition: { name },
})

const record = (r: Partial<TimelineRecord> & Pick<TimelineRecord, 'id' | 'type' | 'name'>): TimelineRecord => ({
  parentId: null, state: 'completed', result: 'succeeded', order: 1, issues: null, ...r,
})

test('reads the PR id and the repo from the remote', () => {
  expect(parsePrId('{\n  "pullRequestId": 4242\n}')).toBe(4242)
  expect(parsePrId('https://dev.azure.com/contoso/Contoso/_git/x/pullrequest/42')).toBe(42)
  expect(parsePrId('nada aqui')).toBe(undefined)
  expect(repoFromRemote('https://dev.azure.com/contoso/Contoso/_git/web-app\n')).toBe('web-app')
  expect(repoFromRemote('git@ssh.dev.azure.com:v3/contoso/Contoso/api')).toBe('api')
  expect(repoFromRemote('git@github.com:octo-org/x.git')).toBe(undefined)
})

test('reviewers: required without vote is pending, groups by short name, people by first name', () => {
  expect(reviewerChecks([
    { displayName: '[Contoso]\\Code-Reviewers', vote: 0, isRequired: true, isContainer: true },
    { displayName: 'Alice Smith', vote: 10 },
    { displayName: 'Carol', vote: 0 },
    { displayName: 'Bob', vote: -5 },
  ])).toEqual([
    { name: 'Code-Reviewers', state: 'pending' },
    { name: 'Alice', state: 'ok' },
    { name: 'Bob', state: 'warn' },
  ])
})

test('gate: build with link, conflict and PR reviewers', () => {
  const verdict = gateVerdict(
    [policy('Build', 'rejected', 1001), policy('Required reviewers', 'queued')],
    { ...PR, mergeStatus: 'conflicts', reviewers: [{ displayName: 'Alice', vote: 10, isRequired: true }] },
  )
  expect(verdict.checks).toEqual([
    { name: 'build', state: 'fail', href: 'https://dev.azure.com/contoso/Contoso/_build/results?buildId=1001', buildId: 1001 },
    { name: 'conflict', state: 'fail' },
    { name: 'Alice', state: 'ok' },
  ])
  expect(describe(verdict.phase, verdict.checks)).toBe('gate · ✗ build  ✗ conflict  ✓ Alice')
})

test('gate: without reviewers falls back to the review policy', () => {
  const verdict = gateVerdict([policy('Build', 'running'), policy('Required reviewers', 'queued')], PR)
  expect(verdict.checks.map(c => c.name)).toEqual(['build', 'review'])
  expect(overallState(verdict.checks, verdict.phase)).toBe('running')
})

test('post-merge: done only when all runs completed and settled', () => {
  const runs = [run(1, 'CD', 'completed', 'succeeded'), run(2, 'CI', 'completed', 'failed')]
  expect(mergedVerdict(runs, 60_000, WEB).isDone).toBe(false)
  const settled = mergedVerdict(runs, 10 * 60_000, WEB)
  expect(settled.isDone).toBe(true)
  expect(describe(settled.phase, settled.checks)).toBe('merged · ✓ CD  ✗ CI')
})

test('post-merge: keeps the latest run per pipeline and gives up after 6h without runs', () => {
  const verdict = mergedVerdict([run(2, 'CI', 'inProgress', null), run(1, 'CI', 'completed', 'failed')], 60_000, WEB)
  expect(verdict.checks.map(c => c.state)).toEqual(['running'])
  expect(mergedVerdict([], 7 * 60 * 60_000, WEB).isDone).toBe(true)
})

test('timeline: ordered stages, pending approval and failure reason', () => {
  const detail = parseTimeline([
    record({ id: 's2', type: 'Stage', name: 'Deploy dev', state: 'inProgress', result: null, order: 2 }),
    record({ id: 's1', type: 'Stage', name: 'Build', order: 1 }),
    record({ id: 'c2', type: 'Checkpoint', name: 'Checkpoint', parentId: 's2', state: 'inProgress', result: null }),
    record({ id: 'a2', type: 'Checkpoint.Approval', name: 'Checkpoint.Approval', parentId: 'c2', state: 'inProgress', result: null }),
    record({ id: 't1', type: 'Task', name: 'Run Lint', result: 'failed', order: 9, issues: [{ type: 'error', message: "Bash exited with code '2'." }] }),
  ])
  expect(detail.stages).toEqual([
    { name: 'Build', state: 'ok' },
    { name: 'Deploy dev', state: 'pending', note: 'awaiting approval' },
  ])
  expect(detail.reason).toBe("Run Lint: Bash exited with code '2'.")
})

test('timeline: single-stage pipeline hides __default', () => {
  expect(parseTimeline([record({ id: 's', type: 'Stage', name: '__default' })]).stages).toEqual([])
})

test('false green: succeeded run with an approval not granted becomes a warning', () => {
  const check = withDetail(
    { name: 'CD', state: 'ok', buildId: 1 },
    { stages: [{ name: 'Build', state: 'ok' }, { name: 'Deploy', state: 'skipped', note: 'approval not granted' }] },
  )
  expect(check.state).toBe('warn')
  expect(check.note).toBe('1 stage(s) without approval')
})

test('condition skip (no checkpoint) is not a false green', () => {
  const detail = parseTimeline([
    record({ id: 'b', type: 'Stage', name: 'blue', order: 1 }),
    record({ id: 'g', type: 'Stage', name: 'green', result: 'skipped', order: 2 }),
  ])
  expect(withDetail({ name: 'CD', state: 'ok', buildId: 1 }, detail).state).toBe('ok')
})

test('skipped approval marks the stage as not granted', () => {
  const detail = parseTimeline([
    record({ id: 'p', type: 'Stage', name: 'Prod', result: 'skipped' }),
    record({ id: 'c', type: 'Checkpoint', name: 'Checkpoint', parentId: 'p', result: 'skipped' }),
    record({ id: 'a', type: 'Checkpoint.Approval', name: 'Checkpoint.Approval', parentId: 'c', result: 'skipped' }),
  ])
  expect(detail.stages).toEqual([{ name: 'Prod', state: 'skipped', note: 'approval not granted' }])
})

const watched = (over: Partial<WatchedPr>): WatchedPr => ({
  key: `ado:${over.id ?? 1}`, provider: 'ado', id: 1, repo: 'r', project: 'p', title: 't', url: '', phase: 'gate', checks: [],
  isDraft: false, isFailed: false, isDone: false, ...over,
})

test('adaptive interval: fast while running, slow waiting for review, medium on error', () => {
  expect(pollDelay(watched({ checks: [{ name: 'build', state: 'running' }] }))).toBe(15_000)
  expect(pollDelay(watched({ checks: [{ name: 'Alice', state: 'pending' }] }))).toBe(120_000)
  expect(pollDelay(watched({ error: 'token expired' }))).toBe(60_000)
})

test('persistence: merges session and store, drops PRs finished over 24h ago', () => {
  const now = 100 * 60 * 60 * 1000
  const merged = mergeLists(
    [watched({ id: 1 })],
    [watched({ id: 1, title: 'velho' }), watched({ id: 2 }), watched({ id: 3, isDone: true, doneAt: now - 25 * 60 * 60 * 1000 })],
    now,
  )
  expect(merged.map(p => [p.id, p.title])).toEqual([[1, 't'], [2, 't']])
})

test('applyCheck: changedAt only moves when the state changes', () => {
  const failing = { phase: 'gate' as const, checks: [{ name: 'build', state: 'fail' as const }], isFailed: true, isDone: false }
  const first = applyCheck(watched({ phase: 'loading' }), { value: failing }, 1_000)
  expect(first.isChanged).toBe(true)
  expect(first.next.changedAt).toBe(1_000)

  const same = applyCheck(first.next, { value: failing }, 31_000)
  expect(same.isChanged).toBe(false)
  expect(same.next.changedAt).toBe(1_000)
  expect(same.next.checkedAt).toBe(31_000)

  const errored = applyCheck(same.next, { error: 'HTTP 401' }, 61_000)
  expect(errored.next.changedAt).toBe(1_000)
  expect(errored.next.error).toBe('HTTP 401')

  const fixed = applyCheck(errored.next, { value: { ...failing, checks: [{ name: 'build', state: 'ok' }], isFailed: false } }, 91_000)
  expect(fixed.isChanged).toBe(true)
  expect(fixed.next.changedAt).toBe(91_000)
  expect(fixed.next.error).toBe(undefined)
})

test('isStale: errors or a check older than 3 minutes, never finished PRs', () => {
  expect(isStale(watched({ checkedAt: 0 }), 60_000)).toBe(false)
  expect(isStale(watched({ checkedAt: 0 }), 4 * 60_000)).toBe(true)
  expect(isStale(watched({ checkedAt: 0, error: 'x' }), 1_000)).toBe(true)
  expect(isStale(watched({ checkedAt: 0, isDone: true }), 4 * 60_000)).toBe(false)
})

test('ago scales from seconds to days', () => {
  expect([ago(12_000), ago(40 * 60_000), ago(5 * 3_600_000), ago(3 * 86_400_000)]).toEqual(['12s', '40m', '5h', '3d'])
})

test('byUrgency: failing first, then waiting, running, ok, finished last; stable within a rank', () => {
  const list = [
    watched({ id: 1, checks: [{ name: 'build', state: 'ok' }] }),
    watched({ id: 2, checks: [{ name: 'build', state: 'running' }] }),
    watched({ id: 3, checks: [{ name: 'build', state: 'fail' }], isDone: true }),
    watched({ id: 4, checks: [{ name: 'review', state: 'pending' }] }),
    watched({ id: 5, checks: [{ name: 'build', state: 'fail' }] }),
    watched({ id: 6, checks: [{ name: 'build', state: 'ok' }] }),
  ]
  expect(byUrgency(list).map(p => p.id)).toEqual([5, 4, 2, 1, 6, 3])
})
