---
id: TASK-004
prd_id: PRD-20261015-prompt-stash
title: "The /stash command and the pane"
component: prompt-stash
status: Done
created_at: 2026-10-15
updated_at: 2026-10-15
started_at: 2026-10-15
completed_at: 2026-10-15
blocked_reason: ""
cancelled_reason: ""
depends_on: [TASK-002]
branch: task/PRD-20261015-prompt-stash/TASK-004
prs:
  - https://github.com/heidiks/agent-kit/pull/41
---

# TASK-004 — The /stash command and the pane

**PRD:** [PRD-20261015-prompt-stash — prompt-stash: a managed history for the native prompt stash](./spec.md)

## Description

Register `/stash`, which opens the pane and returns no text. The pane lists the items newest first (start of the text, age, project), filtered to the current project with a switch to all, and acts on them: recall with swap, remove one, clear what it shows after a confirmation that states the count.

## Acceptance Criteria

- [x] `/stash` opens the pane and adds no text the model reads (FR-005)
- [x] With items of two projects, the pane in project X lists only X's until switched to all (FR-005)
- [x] Recalling into an empty box fills it without sending; into a box holding `d`, `d` becomes the newest item; the recalled item stays (FR-006)
- [x] Removing an item from the pane removes only it (FR-007)
- [x] Declining the clear removes nothing; confirming removes only what the pane shows (FR-008)

## Implementation Notes

### Files involved

```
# Modify
plugins/prompt-stash/hooks/register.tsx

# Create
plugins/prompt-stash/hooks/view.tsx
plugins/prompt-stash/hooks/view.test.ts
```

### References

- Pattern to follow: plugins/pr-watch/hooks/view.tsx (overview pane, confirm buttons), plugins/pr-watch/hooks/help.ts (command)

## Dependencies

- Depends on: TASK-002

## Progress log

| Date | Note |
|---|---|
| 2026-10-15 | Created |
| 2026-10-15 | Started, stacked on TASK-002 (#39) |
| 2026-10-15 | `/stash` registered `immediate` so it opens while a turn runs. Recall closes the pane, back to the prompt. 13 tests pass. In a real 2.1.301 session with a probe on `session.append`: `/stash` opened the pane docked beside the transcript and appended no row; a control prompt appended its rows |
| 2026-10-15 | In review: https://github.com/heidiks/agent-kit/pull/41 |
| 2026-10-15 | Done: #41 merged (squash) |
