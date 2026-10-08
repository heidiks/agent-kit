# Changelog

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
