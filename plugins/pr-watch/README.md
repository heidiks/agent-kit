# pr-watch

A live band above the Claude Code prompt that follows your pull requests from review to deploy, for Azure DevOps and GitHub.

[Install](#install) · [What it shows](#what-it-shows) · [Commands](#commands) · [Spec tasks](#spec-tasks) · [Requirements](#requirements) · [Options](#options) · [Privacy](#privacy)

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/band-dark.svg">
  <img alt="pr-watch band listing pull requests with their checks, reviewers and deploy status" src="assets/band-light.svg">
</picture>

## Install

```
/plugin install pr-watch --marketplace heidiks/agent-kit
```

## What it shows

- **Gate:** build validation and checks, reviewers and their votes, merge conflicts, drafts.
- **After merge:** the pipelines and checks of the merge commit, with stages and pending approvals. A run that "succeeded" while a stage approval was never granted is flagged instead of shown green.
- **Failures:** the failing task or annotation inline, plus an `investigate` button that asks Claude to read the log and propose a fix (nothing is applied).
- **Row actions:** `↗ open` opens the PR in the browser, `×` stops watching it after an inline `remove? yes no` confirmation. Clicking the title or the repo opens a detail line under the row (full title, full repo path, source → target branch, linked task, age); clicking again or `▾` closes it.
- **SINCE:** how long the PR has been in its current state; a PR waiting on review or approval for over 24h is flagged (`! 2d`). The header warns when data is stale.
- **Long lists:** PRs are sorted by urgency (failing, waiting, running, ok), newest first within the same state. The band shows up to five; finished PRs collapse into one line and the rest sit behind `+N more`.
- **Modes:** `⇕` cycles the band between `full`, `compact` (one row per PR) and `mini` (one line: counts and the most urgent PR).
- **System notifications:** failures, changes requested, pending approvals, merges and finished deploys show up outside the terminal (macOS via `terminal-notifier` or `osascript`, Linux via `notify-send`). With `terminal-notifier` installed, clicking one opens the PR.
- **Overview:** `⊞ overview` opens a scrollable popup with every PR, a per-PR timeline of state changes, a `this session` / `all` filter, and an on-demand `✎ summarize` that asks Haiku for a short standup-style recap you can copy. Esc closes it.
- Four layouts (`table`, `tree`, `cards`, `trail`); follows light and dark themes.

## Commands

| Command | What it does |
|---|---|
| `/pr-watch` | List this session's PRs with their state |
| `/pr-watch <id\|url\|owner/repo#N> ...` | Watch one or more PRs, separated by spaces or commas: an Azure DevOps id, any PR URL, or `owner/repo#N` |
| `/pr-watch mine` | Your open PRs: those of the session repo go to the band, the others to the overview's `all` filter |
| `/pr-watch rm <target> ...` | Stop watching one or more PRs |
| `/pr-watch clear` | Drop finished PRs |
| `/pr-watch clear-all` | Drop every PR of this session (kept for other sessions that watch it) |
| `/pr-watch overview` | Popup with every PR, plans, timeline and an on-demand summary (alias `all`) |
| `/pr-watch mode [full\|compact\|mini]` | Band size; without a value, cycles |
| `/pr-watch style [table\|tree\|cards\|trail]` | Band layout; without a value, cycles |
| `/pr-watch hide` / `show` | Hide the band (a summary goes to the status line) or show it again |
| `/pr-watch help` | This list, inside the session |

Inside a session you can also just ask Claude ("how do I watch a PR?", "why is my PR missing?"): the plugin ships a `pr-watch` skill with this guide.

### In the band

| Control | Action |
|---|---|
| Title or repo | Opens a detail line: full title, repo path, source → target branch, linked task, age; click again or `▾` to close |
| `↗ open` | Opens the PR in the browser |
| `×` | Stops watching, after an inline `remove? yes no` |
| `⌕ investigate` | Next to a failure: asks Claude to read the log and propose a fix |
| `✓ mark … done` | On a merged, green PR of a spec task `In Review`: asks Claude to close the tasks |
| `▤` / `⇕` / `⊞` / `⊖` | Layout / mode / overview / hide |

### Which PRs a session watches

Those created in it (any repository, via `az`, `gh` or the Azure DevOps REST API, whatever the output format), the open PR of the current branch, PRs of spec tasks `In Review`, and those added with `/pr-watch`. Only these show in the band, get polled and send notifications, so two sessions on different fronts never mix or notify twice. `claude --continue` keeps the session and its PRs. The saved list spans sessions: the overview's `all` filter shows other sessions' PRs with their last known state, and `+ watch here` brings one into the current session. Finished PRs drop off 24h after they settle.

## Spec tasks

When the repo has [spec-driven-dev](../../skills/spec-driven-dev/README.md) task files under `docs/prd/`, pr-watch links each PR to its task through the [task and pull request contract](../../skills/spec-driven-dev/references/pull-requests.md): the `Task: <PRD>/<TASK>` lines in the PR description (one PR may cover several tasks), the `task/<PRD>/<TASK>` branch, or the PR URL in the task's `prs`.

- A `TASK` column appears in the table when any watched PR has a task (`TASK-001+2` for a PR covering three).
- PRs of tasks `In Review` are watched on session start.
- The overview gains a **PLANS** section: each active PRD with its tasks, their status and the state of their PRs, plus `+ watch PR` for task PRs not watched yet. The PRD id opens its `spec.md`, the task id its task file (as `file://` links, opened by your terminal's default app) and the PR label the PR, so spec → task → PR is a click away.
- When a task's PR is merged and its post-merge checks pass, `✓ mark … done` (every ready task of that PR) asks Claude to verify the acceptance criteria and close the task through the skill. pr-watch never edits spec files itself.

Without `docs/prd/`, or with the option off, none of this shows up. The skill works without pr-watch too.

## Requirements

- **Azure DevOps:** [`az`](https://learn.microsoft.com/cli/azure/install-azure-cli) with the `azure-devops` extension and `az devops configure --defaults organization=... project=...`.
- **GitHub:** [`gh`](https://cli.github.com) logged in (`gh auth login`, plus `--hostname <host>` for GitHub Enterprise).

## Options

Under `/plugin` > pr-watch > configure:

| Option | Default | Effect |
|---|---|---|
| Azure DevOps | on | Watch Azure DevOps PRs |
| GitHub | on | Watch GitHub PRs |
| GitHub hosts | `github.com` | Comma-separated; add your GitHub Enterprise host |
| Failure details and stages | on | One extra call per build for the timeline or annotations |
| Current branch PR | on | Watch the open PR of the current branch on session start |
| PRs in the band | 5 | How many PRs the band shows before `+N more` |
| System notifications | `important` | `off`, `important` or `all` (every state change) |
| Spec tasks | on | Read `docs/prd` task files to link PRs to tasks |

## Privacy

pr-watch stores no tokens. Every call goes through your local `az` and `gh` sessions, and the list of watched PRs is kept on your machine.

> Built on Claude Code's early access plugin hooks API, which may change between releases.
