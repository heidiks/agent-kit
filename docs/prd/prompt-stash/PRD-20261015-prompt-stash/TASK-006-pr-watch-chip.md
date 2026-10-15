---
id: TASK-006
prd_id: PRD-20261015-prompt-stash
title: "Chip in pr-watch's band"
component: prompt-stash
status: Todo
created_at: 2026-10-15
updated_at: 2026-10-15
started_at: ""
completed_at: ""
blocked_reason: ""
cancelled_reason: ""
depends_on: [TASK-001, TASK-005]
branch: task/PRD-20261015-prompt-stash/TASK-006
prs: []
---

# TASK-006 — Chip in pr-watch's band

**PRD:** [PRD-20261015-prompt-stash — prompt-stash: a managed history for the native prompt stash](./spec.md)

## Description

In pr-watch, read prompt-stash's count the way TASK-001 confirmed and draw a compact chip with it in the line the band already has; pressing it opens the prompt-stash pane. Without prompt-stash, or with an empty list, the band is unchanged. Bump pr-watch's version and CHANGELOG.

## Acceptance Criteria

- [ ] With pull requests and three items, the band has the same number of lines as without the chip (FR-004)
- [ ] Pressing the chip opens the prompt-stash pane (FR-004)
- [ ] Without prompt-stash, or with its list empty, pr-watch's existing tests pass unchanged (FR-004)
- [ ] pr-watch `plugin.json` version bumped with a matching CHANGELOG section

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
