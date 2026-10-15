---
id: TASK-003
prd_id: PRD-20261015-prompt-stash
title: "Passive capture and the stash action"
component: prompt-stash
status: Todo
created_at: 2026-10-15
updated_at: 2026-10-15
started_at: ""
completed_at: ""
blocked_reason: ""
cancelled_reason: ""
depends_on: [TASK-001, TASK-002]
branch: task/PRD-20261015-prompt-stash/TASK-003
prs: []
---

# TASK-003 — Passive capture and the stash action

**PRD:** [PRD-20261015-prompt-stash — prompt-stash: a managed history for the native prompt stash](./spec.md)

## Description

Record every non-empty draft that leaves the prompt box without a submit, tracking the draft and waiting for a submit as the PRD's Decisions describe (confirmed in TASK-001), tagged with the session's project. Add the stash action used by the hotkey: read the draft, add it, empty the box. The plugin's own fills are never captured. The hotkey's button is drawn in TASK-005.

## Acceptance Criteria

- [ ] ctrl+S on `a` makes `a` the newest item, tagged with the current project (FR-001)
- [ ] A submitted draft is not added (FR-001)
- [ ] ctrl+c on a non-empty draft adds it (FR-001)
- [ ] The stash action on `b` adds `b` and empties the box without sending; on an empty box it changes nothing and shows a toast (FR-002)
- [ ] Emptying or filling the box through the plugin's own `$.prompt.fill` adds nothing

## Implementation Notes

### Files involved

```
# Modify
plugins/prompt-stash/hooks/register.tsx

# Create
plugins/prompt-stash/hooks/capture.ts
plugins/prompt-stash/hooks/capture.test.ts
```

### References

- Pattern to follow: plugins/pr-watch/hooks/register.tsx (session hooks), plugins/pr-watch/hooks/register.test.ts (mocks)

## Dependencies

- Depends on: TASK-001, TASK-002

## Progress log

| Date | Note |
|---|---|
| 2026-10-15 | Created |
