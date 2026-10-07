---
name: pr-watch
description: >
  How to use the pr-watch plugin (the pull request band above the Claude Code prompt).
  Use when the user asks how to watch a PR, what a /pr-watch command does, what the band,
  its icons or the overview show, how to configure it, or why a PR is missing from it.
---

# pr-watch

A band above the prompt that follows Azure DevOps and GitHub pull requests from review to
deploy. Answer the user's question from this file; suggest the exact command to run.

## Commands

| Command | What it does |
|---|---|
| `/pr-watch` | List this session's PRs with their state |
| `/pr-watch <id\|url\|owner/repo#N> ...` | Watch one or more PRs (spaces or commas): an Azure DevOps id, any PR URL, or `owner/repo#N` |
| `/pr-watch mine` | The user's open PRs: those of the session repo go to the band, the others to the overview's `all` filter |
| `/pr-watch rm <target> ...` | Stop watching one or more PRs |
| `/pr-watch clear` | Drop finished PRs |
| `/pr-watch clear-all` | Drop every PR of this session (kept for other sessions that watch it) |
| `/pr-watch overview` | Popup with every PR, plans, timeline and an on-demand summary (alias `all`) |
| `/pr-watch mode [full\|compact\|mini]` | Band size; without a value, cycles |
| `/pr-watch style [table\|tree\|cards\|trail]` | Band layout; without a value, cycles |
| `/pr-watch hide` / `show` | Hide the band (a summary goes to the status line) or show it |
| `/pr-watch help` | The same list, in the session |

## In the band

- Icons: `✓` ok, `✗` failing, spinner running, `○` queued, `◐` waiting (review or approval), `!` warning.
- Click a title or repo: a detail line with full title, repo path, source → target branch, linked task, age.
- `↗ open` opens the PR; `×` removes it after `remove? yes no`.
- A failure shows its reason and `⌕ investigate`, which asks Claude to read the log and propose a fix.
- `SINCE` is the time in the current state; `! 2d` flags a PR waiting on review or approval over 24h.
- `⊞ overview` opens the popup; `⇕` changes the mode; `▤` the layout; `⊖` hides the band.

## Which PRs show up

Each session watches its own PRs: those created in it (any repository, via `az`, `gh` or the
REST API), the open PR of the current branch, PRs of spec tasks `In Review`, and those added
with `/pr-watch`. Other sessions' PRs appear only in the overview's `all` filter, with
`+ watch here`. `claude --continue` keeps the session and its PRs.

## Spec tasks

With `spec-driven-dev` task files under `docs/prd/`, PRs link to tasks through `Task: <PRD>/<TASK>`
lines in the PR description, the `task/<PRD>/<TASK>` branch, or the PR URL in a task's `prs`.
The table gains a `TASK` column, the overview a PLANS section, and a merged, green PR of a task
`In Review` shows `✓ mark … done`, which asks Claude to close the tasks through the skill.

## Options

`/plugin` > pr-watch > configure: Azure DevOps on/off, GitHub on/off, GitHub hosts (add GitHub
Enterprise), failure details, current branch PR, PRs in the band, system notifications
(`off`, `important`, `all`), spec tasks.

## When something looks wrong

| Symptom | Check |
|---|---|
| A PR created in the session is missing | `/pr-watch <id>`; it then stays. Older plugin versions missed `az ... -o tsv` output |
| `/pr-watch` says "still checking" | Current branch detection runs after the session starts; wait a few seconds |
| Changes after an update do not show | Plugins load when the session starts: `claude --continue` |
| Azure DevOps errors (`! az: ...`) | `az login`, `az devops configure --defaults organization=... project=...` |
| GitHub errors (`! gh: ...`) | `gh auth login` (`--hostname <host>` for GitHub Enterprise) and the host listed in the options |
| Clicks do nothing | Buttons need the terminal's fullscreen mode; otherwise use ctrl+x tab to focus the band |
