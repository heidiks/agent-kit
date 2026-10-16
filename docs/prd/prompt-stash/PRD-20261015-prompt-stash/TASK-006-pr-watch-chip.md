---
id: TASK-006
prd_id: PRD-20261015-prompt-stash
title: "Chip in pr-watch's band"
component: prompt-stash
status: In Review
created_at: 2026-10-15
updated_at: 2026-10-15
started_at: 2026-10-15
completed_at: ""
blocked_reason: ""
cancelled_reason: ""
depends_on: [TASK-001, TASK-005]
branch: task/PRD-20261015-prompt-stash/TASK-006
prs:
  - https://github.com/heidiks/agent-kit/pull/44
---

# TASK-006 — Chip in pr-watch's band

**PRD:** [PRD-20261015-prompt-stash — prompt-stash: a managed history for the native prompt stash](./spec.md)

## Description

In pr-watch, read prompt-stash's count the way TASK-001 confirmed and draw a compact chip with it in the line the band already has; pressing it opens the prompt-stash pane. Without prompt-stash, or with an empty list, the band is unchanged. Bump pr-watch's version and CHANGELOG.

## Acceptance Criteria

- [x] With pull requests and three items, the band has the same number of lines as without the chip (FR-004)
- [x] Pressing the chip opens the prompt-stash pane (FR-004)
- [x] Without prompt-stash, or with its list empty, pr-watch's existing tests pass unchanged (FR-004)
- [x] pr-watch `plugin.json` version bumped with a matching CHANGELOG section

## Implementation Notes

### Files involved

```
# Modify
plugins/pr-watch/hooks/view.tsx
plugins/pr-watch/hooks/register.tsx
plugins/pr-watch/hooks/register.test.ts
plugins/pr-watch/.claude-plugin/plugin.json
plugins/pr-watch/CHANGELOG.md
plugins/pr-watch/README.md
```

### References

- Pattern to follow: plugins/pr-watch/hooks/view.tsx (toolbar buttons)

## Dependencies

- Depends on: TASK-001, TASK-005

## Progress log

| Date | Note |
|---|---|
| 2026-10-15 | Created |
| 2026-10-15 | Started, stacked on TASK-005 (#43) |
| 2026-10-15 | pr-watch reads `prompt-stash.count` with no dependency (`{ version: 0 }` without it) and draws `✎ N stashed` on the header line in full, compact, focus and mini; the press runs `/stash` through `$.command.run`. 78 pr-watch tests pass, README images unchanged |
| 2026-10-15 | Real session on 2.1.301 with both plugins from the branch (installed pr-watch disabled): after ctrl+S the header read `✎ 1 stashed` with no extra line; focusing the band and pressing the chip opened the prompt-stash pane |
| 2026-10-15 | In review: https://github.com/heidiks/agent-kit/pull/44 |
| 2026-10-15 | Fix after validation by the user: a click on the chip did not open the pane on a terminal under 144 columns. pr-watch's press ran `/stash` through `$.command.run`, so the open was not tied to the person's press and the pane waited unplaced (an unasked pane needs 144 columns). prompt-stash now answers `ui.press` on `{ plugin: 'pr-watch', element: 'stash' }` and opens the pane in that press; reproduced at 120 columns before, opens docked after. The pane title moved to its own line, since it wrapped in the narrow dock |
