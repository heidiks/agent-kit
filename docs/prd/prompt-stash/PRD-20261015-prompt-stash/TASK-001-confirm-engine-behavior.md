---
id: TASK-001
prd_id: PRD-20261015-prompt-stash
title: "Confirm the engine behavior the design relies on"
component: prompt-stash
status: In Review
created_at: 2026-10-15
updated_at: 2026-10-15
started_at: 2026-10-15
completed_at: ""
blocked_reason: ""
cancelled_reason: ""
depends_on: []
branch: task/PRD-20261015-prompt-stash/TASK-001
prs:
  - https://github.com/heidiks/agent-kit/pull/37
---

# TASK-001 — Confirm the engine behavior the design relies on

**PRD:** [PRD-20261015-prompt-stash — prompt-stash: a managed history for the native prompt stash](./spec.md)

## Description

Check, on the pinned Claude Code build, the two open questions of the PRD with a throwaway mod and record the answers in the PRD (Open Questions and Decisions). No plugin code ships from this task.

1. The order of `prompt.change` (`clear`) and `prompt.submit` when a draft is submitted, against ctrl+S, ctrl+c and esc esc, and what `prompt.change` reports when the native stash puts the draft back after a submit.
2. Whether a plugin can read another plugin's `$.state` value without declaring it in `dependencies`, and what it reads when that plugin is not installed.

If either answer breaks the design (a submit cannot be told apart, or pr-watch would need a hard dependency), stop and revisit the PRD before TASK-003 and TASK-006.

## Acceptance Criteria

- [x] The event order for submit, ctrl+S, ctrl+c and esc esc is recorded in the PRD (FR-001)
- [x] The cross-plugin `$.state` read is confirmed or refuted, with the fallback recorded (FR-004)
- [x] The two Open Questions are closed or turned into Decisions

## Implementation Notes

### Files involved

```
# Create (throwaway, not committed)
~/.claude/dev-mods/<session>/prompt-stash-probe/

# Modify
docs/prd/prompt-stash/PRD-20261015-prompt-stash/spec.md
```

### References

- Pattern to follow: plugins/pr-watch/hooks/register.tsx (event hooks)

## Dependencies

- Depends on: None

## Progress log

| Date | Note |
|---|---|
| 2026-10-15 | Created |
| 2026-10-15 | Started: probe mods driven in tmux on Claude Code 2.1.301 |
| 2026-10-15 | Probes probe-a (event log) and probe-b (reads probe-a's state) loaded with `--plugin-dir` in a tmux session on 2.1.301, haiku. Results recorded in the PRD Decisions; esc esc does not empty the box, so it left FR-001 and TASK-003 |
| 2026-10-15 | In review: https://github.com/heidiks/agent-kit/pull/37 |
