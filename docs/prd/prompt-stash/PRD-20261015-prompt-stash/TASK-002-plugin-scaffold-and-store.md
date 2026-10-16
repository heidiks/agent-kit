---
id: TASK-002
prd_id: PRD-20261015-prompt-stash
title: "Plugin scaffold and the item store"
component: prompt-stash
status: In Progress
created_at: 2026-10-15
updated_at: 2026-10-15
started_at: 2026-10-15
completed_at: ""
blocked_reason: ""
cancelled_reason: ""
depends_on: []
branch: task/PRD-20261015-prompt-stash/TASK-002
prs: []
---

# TASK-002 — Plugin scaffold and the item store

**PRD:** [PRD-20261015-prompt-stash — prompt-stash: a managed history for the native prompt stash](./spec.md)

## Description

Create `plugins/prompt-stash/` with its manifest, hooks module entry, `$.state` type contract and the store logic: add an item (text, project, time), with whitespace-only drafts ignored, an identical text moved to the top instead of duplicated, and the oldest dropped past 50; remove one; clear the items of a filter (one project or all). No capture, band or pane yet.

## Acceptance Criteria

- [x] Adding a whitespace-only text changes nothing (FR-001)
- [x] Adding a text equal to an existing item moves it to the top without a new item (FR-001)
- [x] The 51st item drops the oldest (FR-001)
- [x] Removing one item leaves the others unchanged (FR-007)
- [x] Clearing with a project filter removes only that project's items (FR-008)
- [x] `claude plugin validate plugins/prompt-stash` and `claude plugin test plugins/prompt-stash` pass

## Implementation Notes

### Files involved

```
# Create
plugins/prompt-stash/.claude-plugin/plugin.json
plugins/prompt-stash/hooks/hooks.json
plugins/prompt-stash/hooks/register.tsx
plugins/prompt-stash/hooks/store.ts
plugins/prompt-stash/hooks/store.test.ts
plugins/prompt-stash/types/index.d.ts
```

### References

- Pattern to follow: plugins/pr-watch/.claude-plugin/plugin.json, plugins/pr-watch/types/index.d.ts, plugins/pr-watch/hooks/tasks.ts and tasks.test.ts

## Dependencies

- Depends on: None

## Progress log

| Date | Note |
|---|---|
| 2026-10-15 | Created |
| 2026-10-15 | Started, stacked on TASK-001 (#37) |
| 2026-10-15 | Store as pure functions over the list plus `changeItems`, which re-reads `$.store` before each write so a second session's items are not dropped; 6 tests, validate ok. No type-check: no tsc here and CI runs none |
