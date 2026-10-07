---
name: spec-driven-dev
description: >
  Spec-Driven Development workflow (repo-agnostic). Use when the user wants to
  implement a new feature, a significant refactoring or a behavior change, or says
  things like "let's implement X", "create a PRD for Y", "spec out Z", "plan X",
  "where did we stop on PRD-...". Not for small bugfixes or config-only changes.
  Runs in phases (interview, spec, visual overview, tasks, implement, done) and
  asks before moving to the next one. Never jumps straight to code.
---

# Spec-Driven Development

Define **what and why** before any code is written, one phase at a time, with the
user deciding when to move on.

## When to use

| Use | Skip |
|---|---|
| New feature, behavior or API contract change | Small bugfix (< 30 min) |
| Significant refactoring or external integration | Config-only change, typo |
| Work spanning more than one session | Dependency bump without breaking change |

## Modes

- **Full**: all six phases. Default for new features and anything ambiguous.
- **Lite**: Spec, then Tasks, then implement. Skips Interview and Visual overview.
  Suggest it when the request is already precise and small (one component, a few tasks).

Propose a mode from the size of the request and let the user confirm. Record it in the
PRD frontmatter (`mode: full` or `mode: lite`).

## Phases

| # | Phase | Output | Read before starting |
|---|---|---|---|
| 1 | Interview | Interview notes and decisions in the PRD | [references/interview.md](references/interview.md) |
| 2 | Spec | `spec.md` filled from the interview | [references/spec.md](references/spec.md) |
| 3 | Visual overview | Mermaid diagrams in `spec.md` | [references/visual-overview.md](references/visual-overview.md) |
| 4 | Tasks | `TASK-NNN-*.md` files and the task graph | [references/tasks.md](references/tasks.md) |
| 5 | Implement | Code, one task at a time; a pull request per task, or per group of small related tasks | [references/implement.md](references/implement.md), [references/pull-requests.md](references/pull-requests.md) |
| 6 | Done | Tasks `Done` once merged, PRD `Completed`, index updated | [references/implement.md](references/implement.md) |

Read a phase's reference file only when that phase starts. Layout, IDs, statuses and
the index are in [references/layout.md](references/layout.md); read it before creating
the first file in a repo.

### Checkpoint at the end of every phase

Save the files, set `phase:` in the PRD frontmatter to the next phase, then stop and ask:

> Phase N (name) is saved. What next?
> 1. Continue to phase N+1 (name)
> 2. Revise this phase
> 3. Skip phase N+1 (only Interview and Visual overview can be skipped)
> 4. Stop here

Never start phase 5 (Implement) without an explicit go from the user, even in lite mode.
If the agent has a structured question tool, use it for the checkpoint; otherwise ask in
plain text.

## Resuming ("where did we stop?")

1. List PRDs under `docs/prd/` with their `status` and `phase` (run
   `scripts/prd_index.py --status` from the repo root, or read the frontmatter).
2. For tasks `In Review`, check whether their pull requests were merged
   ([references/pull-requests.md](references/pull-requests.md)) before reporting.
3. For the PRD in question, report the current phase, the tasks by status, and the
   next step, then offer the checkpoint options above.

## Rules that always apply

- Statuses are exact and case-sensitive; see [references/layout.md](references/layout.md).
- Fill every template section; write "None" instead of leaving one empty.
- Record each decision with its alternatives and rationale in the PRD's Decisions table.
- After any status change, regenerate the index with `scripts/prd_index.py`.
- Match the codebase: read two or three existing files before writing code or tasks.
- A pull request per task by default; small related tasks may share one. Link both ways: `prs` in every task, one `Task:` line per task in the PR.
