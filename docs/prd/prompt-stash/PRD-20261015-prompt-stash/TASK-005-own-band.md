---
id: TASK-005
prd_id: PRD-20261015-prompt-stash
title: "Own band and the published count"
component: prompt-stash
status: Todo
created_at: 2026-10-15
updated_at: 2026-10-15
started_at: ""
completed_at: ""
blocked_reason: ""
cancelled_reason: ""
depends_on: [TASK-002, TASK-003]
branch: task/PRD-20261015-prompt-stash/TASK-005
prs: []
---

# TASK-005 — Own band and the published count

**PRD:** [PRD-20261015-prompt-stash — prompt-stash: a managed history for the native prompt stash](./spec.md)

## Description

Publish the count of the current view in `$.state` and draw prompt-stash's one-line band above the prompt when the count is above zero and pr-watch draws no band: the count, a hotkey to stash the draft (the action from TASK-003) and one to open the pane.

## Acceptance Criteria

- [ ] With an empty list nothing is drawn above the prompt (FR-003)
- [ ] With items and no pr-watch band, one line shows the count and the two actions (FR-003)
- [ ] The stash hotkey on `b` adds `b` and empties the box without sending; on an empty box it changes nothing and shows a toast (FR-002, moved from TASK-003)
- [ ] With pr-watch drawing its band, prompt-stash draws no line (FR-003)

## Implementation Notes

### Files involved

```
# Modify
plugins/prompt-stash/hooks/register.tsx
plugins/prompt-stash/hooks/view.tsx
plugins/prompt-stash/types/index.d.ts

# Create
plugins/prompt-stash/hooks/band.test.ts
```

### References

- Pattern to follow: plugins/pr-watch/hooks/register.tsx (AbovePrompt hook), plugins/pr-watch/hooks/view.tsx (band)

## Dependencies

- Depends on: TASK-002, TASK-003

## Progress log

| Date | Note |
|---|---|
| 2026-10-15 | Created |
