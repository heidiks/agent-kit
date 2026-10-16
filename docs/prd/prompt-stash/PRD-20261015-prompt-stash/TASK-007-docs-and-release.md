---
id: TASK-007
prd_id: PRD-20261015-prompt-stash
title: "Docs and first release"
component: prompt-stash
status: In Review
created_at: 2026-10-15
updated_at: 2026-10-15
started_at: 2026-10-15
completed_at: ""
blocked_reason: ""
cancelled_reason: ""
depends_on: [TASK-003, TASK-004, TASK-005, TASK-006]
branch: task/PRD-20261015-prompt-stash/TASK-007
prs:
  - https://github.com/heidiks/agent-kit/pull/46
---

# TASK-007 — Docs and first release

**PRD:** [PRD-20261015-prompt-stash — prompt-stash: a managed history for the native prompt stash](./spec.md)

## Description

Document and publish prompt-stash 0.1.0: plugin README, CHANGELOG, the marketplace entry and the row in the agent-kit README.

## Acceptance Criteria

- [x] `plugins/prompt-stash/README.md` covers install, the capture rules (stash, ctrl+c), the band, the chip with pr-watch and the pane
- [x] `.claude-plugin/marketplace.json` lists prompt-stash and `claude plugin validate .` passes
- [x] The agent-kit README Plugins table has a prompt-stash row
- [x] `plugin.json` is 0.1.0 with a `## 0.1.0` CHANGELOG section, so the release workflow tags `prompt-stash-v0.1.0`

## Implementation Notes

### Files involved

```
# Create
plugins/prompt-stash/README.md
plugins/prompt-stash/CHANGELOG.md

# Modify
.claude-plugin/marketplace.json
README.md
```

### References

- Pattern to follow: plugins/pr-watch/README.md, plugins/pr-watch/CHANGELOG.md

## Dependencies

- Depends on: TASK-003, TASK-004, TASK-005, TASK-006

## Progress log

| Date | Note |
|---|---|
| 2026-10-15 | Created |
| 2026-10-15 | Started, stacked on TASK-006 (#44) |
| 2026-10-15 | README (what is kept and not, band, chip, list, Claude Code 2.1.300, privacy), CHANGELOG 0.1.0, marketplace entry after pr-watch, agent-kit README row, and pr-watch's README row now links prompt-stash. `claude plugin validate .` passes; the release workflow's notes extraction yields the 0.1.0 section for `prompt-stash-v0.1.0` |
| 2026-10-15 | In review: https://github.com/heidiks/agent-kit/pull/46 |
