# prompt-stash

Keeps every prompt draft you stash in Claude Code, so a second subject never pushes out the first. Recall, remove or clear them later, without sending anything to the model.

[Install](#install) · [What it keeps](#what-it-keeps) · [Count](#count) · [List](#list) · [Requirements](#requirements) · [Privacy](#privacy)

Claude Code's own stash (ctrl+S) parks the draft in the prompt box and puts it back after your next submit, but it holds one draft. prompt-stash keeps the native gesture and adds the history: every stashed draft stays in a list until you remove it.

## Install

```
/plugin marketplace add heidiks/agent-kit
/plugin install prompt-stash@agent-kit
```

Restart the session (`claude --continue` keeps it) to load it.

## What it keeps

Every draft that leaves the prompt box without being sent:

- **ctrl+S**, Claude Code's stash. It still puts the draft back after your next submit, as before; the list keeps a copy.
- **ctrl+c** on a draft, so a draft cleared by mistake can be recalled.

Not kept: drafts you send, drafts that run as a slash command (`/...`) or in bash mode (`!...`), since running them also empties the box. Only the text is kept, not pasted images or other attachments. A draft identical to one in the list moves that one to the top instead of adding a copy, and the list keeps the newest 50.

## Count

While the current project has stashed drafts, their count goes at the end of the hint line under the prompt, which Claude Code draws anyway, so prompt-stash takes no line of its own:

```
⏵⏵ auto mode on (shift+tab to cycle) · ✎ 2 stashed (/stash)
```

With nothing stashed in the project, the line is left as is. On a narrow terminal Claude Code cuts the text where the row ends.

## List

`/stash` opens the list, also while Claude is working.

| Control | Action |
|---|---|
| A draft | Puts it in the prompt box, not sent; a draft already in the box goes to the list first. The draft stays in the list |
| `×` | Removes that draft |
| `this project` / `all projects` | Drafts of the current project (the default) or of every project |
| `clear` | Removes the drafts the list shows, after `remove N items? yes no` |

Esc closes it. Nothing in the list, `/stash` included, adds anything to the conversation the model reads.

## Requirements

- **Claude Code 2.1.300 or later**, the first with the prompt event the capture relies on; older versions refuse to load the plugin.

## Privacy

Drafts are stored as plain JSON in the plugin's own store under your Claude Code configuration directory, as Claude Code keeps its prompt history, and never leave your machine: the plugin makes no network call and sends nothing to the model. The list is per machine, not synced.

> Built on Claude Code's early access plugin hooks API, which may change between releases.
