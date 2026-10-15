---
id: TASK-002
prd_id: PRD-20261015-prompt-stash
title: "Plugin scaffold and the item store"
component: prompt-stash
status: Todo
created_at: 2026-10-15
updated_at: 2026-10-15
started_at: ""
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

- [ ] Adding a whitespace-only text changes nothing (FR-001)
- [ ] Adding a text equal to an existing item moves it to the top without a new item (FR-001)
- [ ] The 51st item drops the oldest (FR-001)
- [ ] Removing one item leaves the others unchanged (FR-007)
- [ ] Clearing with a project filter removes only that project's items (FR-008)
- [ ] `claude plugin validate plugins/prompt-stash` and `claude plugin test plugins/prompt-stash` pass

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
