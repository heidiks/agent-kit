# Changelog

## 0.3.8

- The prompt-stash chip is back on the band's header line, shorter (`✎ N`), so pressing it opens the stashed prompt list again.

## 0.3.7

- The `✎ N stashed` chip is gone from the band: prompt-stash 0.2.0 shows its count at the end of the prompt's hint line instead, so pr-watch no longer reads anything from it.

## 0.3.6

- GitHub: a merged PR whose repo has no checks (no workflow and no app posting statuses) finishes as `no checks found` 15 minutes after the merge, not 6 hours. GitHub creates the merge commit's checks within seconds; the 6 hours stay for Azure DevOps pipelines.
- Order: open PRs come before merged PRs that are only waiting for post-merge checks, so a new PR is no longer pushed off the band by a row of merged ones. Failures and pending reviews stay on top whatever the phase.

## 0.3.5

- With the prompt-stash plugin installed, `✎ N stashed` on the band's header line counts this project's stashed prompt drafts and opens its list; no extra line, and nothing changes without it.

## 0.3.4

- `investigate` keeps the CI's failure text in a fenced block marked as untrusted data, so text from a PR's build output is not read as instructions.
- README: install with `/plugin marketplace add` and `/plugin install pr-watch@agent-kit`, minimum Claude Code version and supported systems.

## 0.3.3

- Focus (`◎ focus`, `/pr-watch focus [on|off]`): the band keeps only PRs that need you and hides green checks; the rest fold into one line of counts.

## 0.3.2

- The task label shows in every band style, not only in the table; cards and trail also get the mark done line.

## 0.3.1

- Each session saves its own list, so parallel sessions no longer drop each other's PRs.
- A PR watched before the session finished starting belongs to the session.
- Lists of sessions idle for 14 days are removed; a PR not checked yet never counts as idle.
- Several PRs per command (`/pr-watch 101 102,103`) and an expandable detail line with the full title, repo and branches.
- `/pr-watch clear-all`, `/pr-watch mine` scoped to the session repo, `/pr-watch help`.
- Several spec tasks per PR (`TASK-001+1`), marked done together.
- Every PR created in the session is caught, across repos and output formats; the table fits narrow terminals.
- The TASK column fits `TASK-001+1` without touching REPO.

## 0.3.0

First public version. Changes made while the version stayed at 0.3.0 are in the git history.
