---
id: TASK-003
prd_id: PRD-20261015-prompt-stash
title: "Passive capture and the stash action"
component: prompt-stash
status: Done
created_at: 2026-10-15
updated_at: 2026-10-15
started_at: 2026-10-15
completed_at: 2026-10-15
blocked_reason: ""
cancelled_reason: ""
depends_on: [TASK-001, TASK-002]
branch: task/PRD-20261015-prompt-stash/TASK-003
prs:
  - https://github.com/heidiks/agent-kit/pull/42
---

# TASK-003 — Passive capture and the stash action

**PRD:** [PRD-20261015-prompt-stash — prompt-stash: a managed history for the native prompt stash](./spec.md)

## Description

Record every non-empty draft that leaves the prompt box without a submit, tracking the draft and waiting for a submit as the PRD's Decisions describe (confirmed in TASK-001), tagged with the session's project. Add the stash action used by the hotkey: read the draft, add it, empty the box. The plugin's own fills are never captured. The hotkey's button is drawn in TASK-005.

## Acceptance Criteria

- [x] ctrl+S on `a` makes `a` the newest item, tagged with the current project (FR-001)
- [x] A submitted draft is not added (FR-001)
- [x] A draft run as a slash command or in bash mode is not added (FR-001)
- [x] ctrl+c on a non-empty draft adds it (FR-001)
- [x] Emptying or filling the box through the plugin's own `$.prompt.fill` adds nothing

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
| 2026-10-15 | Started, stacked on TASK-004 (#41), which carries TASK-002 |
| 2026-10-15 | Capture tracks the draft from `prompt.edit` and non-clear `prompt.change`, holds a cleared draft 300 ms and drops it on `prompt.submit` or `command.run`. The stash action (`stashDraft`) is written; its criterion is verified through the band hotkey in TASK-005 |
| 2026-10-15 | Real session on 2.1.301 (tmux, haiku): ctrl+S and ctrl+c drafts listed, the submitted prompt not; `/stash` itself was captured at first (a slash command empties the box with no `prompt.submit`), fixed with `command.run`; a slow bash run (`!sleep 2; echo slow`) was captured since its `<bash-input>` row lands after the command ends, fixed by never holding a `!` draft (decided with the user). Recall from the pane by keyboard put the draft in the box unsent and closed the pane. 19 tests pass |
| 2026-10-15 | The stash action criterion moved to TASK-005, where its hotkey is drawn and can be pressed |
| 2026-10-15 | In review: https://github.com/heidiks/agent-kit/pull/42 |
| 2026-10-15 | Done: #42 merged (squash) |
