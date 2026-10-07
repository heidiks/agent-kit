# Tasks and pull requests

One task, one branch, one pull request. This file is the contract between a task file and
its pull request; any tool can read it (the `pr-watch` Claude Code plugin does), and none is
required.

## The contract

| Where | What | Example |
|---|---|---|
| Task frontmatter `branch` | The task's branch | `task/PRD-20261007-retry/TASK-002` |
| Task frontmatter `prs` | URL of every pull request opened for the task | `- https://github.com/acme/api/pull/42` |
| Pull request description | One line naming the task, on its own line | `Task: PRD-20261007-retry/TASK-002` |

The branch and the `Task:` line point from the pull request to the task; `prs` points back.
Keep all three: a tool may only see one side.

## Flow per task

1. **Branch**: create `task/<PRD id>/<TASK id>` from the default branch. If the task depends
   on another task whose pull request is not merged yet, branch from that task's branch and
   say so in the description ("Stacked on #41").
2. **Implement** as in [implement.md](implement.md), committing on the task branch.
3. **Open the pull request** with the repo's own tooling and conventions (title format,
   template, reviewers). Put the `Task:` line in the description. Record the URL in `prs`.
4. Set the task to `status: In Review`, add a progress log row with the PR link.
5. **Done** only when the pull request is merged **and** every acceptance criterion is
   verified. Then set `status: Done` and `completed_at`.

## Pull request outcomes

| Outcome | Task becomes |
|---|---|
| Merged, criteria verified | `Done` |
| Changes requested | `In Progress` until the fix is pushed, then back to `In Review` |
| Closed without merge, work still needed | `In Progress`; a new PR is appended to `prs` |
| Closed without merge, work dropped | `Cancelled` with `cancelled_reason` |

## Checking state when resuming

For every task `In Review`, look up its pull request (`gh pr view <url> --json state`,
`az repos pr show --id <id>`, or the platform's API) and apply the table above. Never mark a
task `Done` from memory; check the merge.

## Repos without pull requests

When the repo commits straight to the default branch, leave `branch` and `prs` empty and skip
`In Review`: the task goes from `In Progress` to `Done` as in [implement.md](implement.md).
