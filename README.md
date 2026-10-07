# agent-kit

Skills, plugins and Claude Code mods I use day to day. Install only what you need.

| Folder | What | Works with |
|---|---|---|
| `skills/` | [Agent Skills](https://agentskills.io) (`SKILL.md`) | Claude Code, Codex, Cursor, Gemini CLI, Copilot and [others](https://skills.sh) |
| `plugins/` | Claude Code plugins and mods | Claude Code |

## Install

**Claude Code plugins**, one at a time:

```
/plugin install pr-watch --marketplace heidiks/agent-kit
```

Answer `y` to add the marketplace, then pick the scope. Remove with `/plugin uninstall pr-watch@agent-kit`.

**Skills**, into any supported agent:

```bash
npx skills add heidiks/agent-kit --list                     # see what is available
npx skills add heidiks/agent-kit -s <skill> -a claude-code  # one skill, one agent
```

## Plugins

### pr-watch

A live band above the Claude Code prompt that follows your pull requests from review to deploy, for Azure DevOps and GitHub.

```
 Pull requests  ✗ 1  ⠹ 1  updated 12s ago               ▤ table  ▴ collapse  ⊖ hide
   SRC PR      REPO              PHASE    CHECKS                          SINCE
 ✗ ado !4242   web-app           gate     ✗ build  ◐ Code-Reviewers       40m  ×
     └ Run Lint: Bash exited with code '2'.                        ⌕ investigate
 ⠹ gh  #300    octo-org/website  merged   ⠹ deploy  ✓ test                3m   ×
```

- **Gate:** build validation and checks, reviewers and their votes, merge conflicts, drafts.
- **After merge:** the pipelines and checks of the merge commit, with stages and pending approvals. A run that "succeeded" while a stage approval was never granted is flagged instead of shown green.
- **Failures:** the failing task or annotation inline, plus an `investigate` button that asks Claude to read the log and propose a fix (nothing is applied).
- **SINCE** is how long the PR has been in its current state.
- Four layouts (`table`, `tree`, `cards`, `trail`), follows light and dark themes.

PRs are picked up when Claude runs `az repos pr create` or `gh pr create`, from the current branch on session start, or by hand:

```
/pr-watch 4242                                  # Azure DevOps PR id
/pr-watch https://github.com/owner/repo/pull/7  # any PR URL
/pr-watch owner/repo#7
/pr-watch rm <target> | clear | hide | show | style [table|tree|cards|trail]
```

**Requirements:** [`az`](https://learn.microsoft.com/cli/azure/install-azure-cli) with the `azure-devops` extension and `az devops configure --defaults organization=... project=...`, and/or [`gh`](https://cli.github.com) logged in (`gh auth login`, plus `--hostname` for GitHub Enterprise).

**Options** (`/plugin` > pr-watch > configure): turn Azure DevOps or GitHub off, list GitHub Enterprise hosts, skip failure details to save API calls, skip current branch detection.

**Privacy:** pr-watch stores no tokens. Every call goes through your local `az` and `gh` sessions, and the list of watched PRs is kept on your machine.

> Mods use Claude Code's early access plugin hooks API, which may change between releases.

## Layout

```
skills/<name>/SKILL.md                # one folder per skill
plugins/<name>/.claude-plugin/        # one folder per Claude Code plugin
.claude-plugin/marketplace.json       # lists the plugins for /plugin install
```

To add a plugin, create its folder under `plugins/` and add an entry to `marketplace.json`. Check it with `claude plugin validate plugins/<name>` and `claude plugin test plugins/<name>`.
