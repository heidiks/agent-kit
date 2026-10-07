import { expect, test } from 'claude-code/testing'

import type { PlanInfo, WatchedPr } from '../types'
import { activePlans, canMarkDone, fileUrl, parseFrontmatter, parseTaskRef, planFromSpec, reviewPrUrls, taskForPr, taskFromFile } from './tasks'

const TASK_FILE = `---
id: TASK-002
prd_id: PRD-20261007-retry
title: "Client with backoff"
status: In Review
depends_on: [TASK-001]
branch: task/PRD-20261007-retry/TASK-002  # comment
prs:
  - https://github.com/acme/api/pull/42
---
# body`

const pr = (over: Partial<WatchedPr>): WatchedPr => ({
  key: 'gh:github.com/acme/api#42', provider: 'github', id: 42, repo: 'api', project: 'acme', title: 't',
  url: 'https://github.com/acme/api/pull/42', phase: 'gate', checks: [], isDraft: false, isFailed: false, isDone: false, ...over,
})

test('parseTaskRef: Task line first, then the task branch', () => {
  expect(parseTaskRef('Fixes things\n\nTask: PRD-20261007-retry/TASK-002\n', 'feature/x')).toBe('PRD-20261007-retry/TASK-002')
  expect(parseTaskRef('', 'refs/heads/task/PRD-20261007-retry/TASK-003')).toBe('PRD-20261007-retry/TASK-003')
  expect(parseTaskRef('mentions Task: PRD-1/TASK-1 inline', 'main')).toBe(undefined)
  expect(parseTaskRef(undefined, undefined)).toBe(undefined)
})

test('taskFromFile reads the contract fields, comments and lists', () => {
  expect(parseFrontmatter(TASK_FILE).depends_on).toEqual(['TASK-001'])
  expect(taskFromFile(TASK_FILE, 'docs/prd/api/PRD-20261007-retry/TASK-002-client.md', 'PRD-20261007-retry')).toEqual({
    prd: 'PRD-20261007-retry',
    id: 'TASK-002',
    title: 'Client with backoff',
    status: 'In Review',
    path: 'docs/prd/api/PRD-20261007-retry/TASK-002-client.md',
    file: '',
    branch: 'task/PRD-20261007-retry/TASK-002',
    prs: ['https://github.com/acme/api/pull/42'],
    dependsOn: ['TASK-001'],
  })
  expect(taskFromFile('no frontmatter', 'x.md', 'PRD-1')).toBe(undefined)
})

test('a PR links to its task by ref or by URL, and only merged green PRs can mark done', () => {
  const task = taskFromFile(TASK_FILE, 'p', 'PRD-20261007-retry')!
  const plan: PlanInfo = planFromSpec('---\nid: PRD-20261007-retry\ntitle: Retry\nstatus: In Progress\nphase: implement\n---', 'spec.md', [task])!
  expect(taskForPr(pr({ url: 'https://github.com/acme/api/pull/42/' }), [plan])?.task.id).toBe('TASK-002')
  expect(taskForPr(pr({ url: 'https://x/other', taskRef: 'PRD-20261007-retry/TASK-002' }), [plan])?.task.id).toBe('TASK-002')
  expect(taskForPr(pr({ url: 'https://x/other' }), [plan])).toBe(undefined)

  expect(canMarkDone(task, pr({ phase: 'gate' }))).toBe(false)
  expect(canMarkDone(task, pr({ phase: 'merged', isDone: true, checks: [{ name: 'CI', state: 'ok' }] }))).toBe(true)
  expect(canMarkDone(task, pr({ phase: 'merged', isDone: true, isFailed: true, checks: [{ name: 'CI', state: 'fail' }] }))).toBe(false)
  expect(canMarkDone({ ...task, status: 'Done' }, pr({ phase: 'merged', isDone: true }))).toBe(false)

  expect(reviewPrUrls([plan])).toEqual(['https://github.com/acme/api/pull/42'])
  const finished = { ...plan, status: 'Completed' }
  expect(activePlans([finished], [])).toEqual([])
  expect(activePlans([finished], [pr({})]).length).toBe(1)
})

test('fileUrl encodes paths and is empty without a file', () => {
  expect(fileUrl('/repo/docs/prd/My PRD/spec.md')).toBe('file:///repo/docs/prd/My%20PRD/spec.md')
  expect(fileUrl('')).toBe('')
})
