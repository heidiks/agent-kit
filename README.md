# agent-kit

Skills, plugins and Claude Code mods I use day to day. Install only what you need.

[Install](#install) · [Plugins](#plugins) · [Skills](#skills) · [Layout](#layout) · [Adding something](#adding-something) · [License](#license)

## Install

**Claude Code plugins**, one at a time:

```
/plugin marketplace add heidiks/agent-kit
/plugin install <plugin>@agent-kit
```

Then pick the scope. Update with `/plugin marketplace update agent-kit` and `/plugin update <plugin>@agent-kit`; remove with `/plugin uninstall <plugin>@agent-kit`.

**Skills**, into any [Agent Skills](https://agentskills.io) compatible agent (Claude Code, Codex, Cursor, Gemini CLI, Copilot and [others](https://skills.sh)):

```bash
npx skills add heidiks/agent-kit --list                     # see what is available
npx skills add heidiks/agent-kit -s <skill> -a claude-code  # one skill, one agent
```

## Plugins

| Plugin | What it does | Works with |
|---|---|---|
| [pr-watch](plugins/pr-watch/README.md) | Live band above the prompt that follows Azure DevOps and GitHub pull requests from review to deploy | Claude Code, with `az` or `gh` logged in |

## Skills

| Skill | What it does | Works with |
|---|---|---|
| [spec-driven-dev](skills/spec-driven-dev/README.md) | Interview, spec, visual overview and tasks before any code, with a checkpoint between phases | Any [Agent Skills](https://agentskills.io) agent |

## Layout

```
skills/<name>/SKILL.md              # one folder per skill, Agent Skills format
plugins/<name>/                     # one folder per Claude Code plugin, with its own README
.claude-plugin/marketplace.json     # lists the plugins for /plugin install
```

## Adding something

- **Plugin:** create `plugins/<name>/` with a `README.md`, add it to `.claude-plugin/marketplace.json` and to the [Plugins](#plugins) table. Check it with `claude plugin validate plugins/<name>` and `claude plugin test plugins/<name>`; CI runs both for every plugin.
- **Skill:** create `skills/<name>/SKILL.md` and add it to [Skills](#skills).
- **Releasing a plugin:** bump `version` in its `plugin.json` and add a `## <version>` section to its `CHANGELOG.md` in the same PR. After the merge, the release workflow tags `<name>-v<version>` and publishes a GitHub release with that section; it fails if the section is missing.

## License

[MIT](LICENSE)
