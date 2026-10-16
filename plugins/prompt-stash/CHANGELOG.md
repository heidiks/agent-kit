# Changelog

## 0.3.2

- The band reads like pr-watch's: `✎ N stashed  ⊕ stash draft  ≡ list`, icon buttons underlined in Claude's color on hover. The `s` and `l` letter keys go with the `s:`/`l:` labels; from the keyboard, ctrl+x tab, Tab and Enter.

## 0.3.1

- `l` in the band, by key or click, opens the list again on terminals under 144 columns. The pane opened only after a state write, so Claude Code no longer tied it to the press and held it as a pane nobody asked for; it now opens first.

## 0.3.0

- The menu is back: the hint-line count of 0.2.0 was not clickable, and a button cannot sit on that line without replacing Claude Code's own. Without pr-watch, the band line `N stashed  s: stash draft  l: list` returns; with pr-watch, the chip on its header line, now `✎ N`, opens the list. The count leaves the hint line.

## 0.2.0

- The count moves to the end of the prompt's hint line (`✎ N stashed (/stash)`), which Claude Code draws anyway: the band line above the prompt, its `s` and `l` keys and the chip in pr-watch's band are gone, so prompt-stash takes no line of its own. `/stash` opens the list.

## 0.1.0

First public version: every draft stashed with ctrl+S, cleared with ctrl+c or stashed from the band is kept, up to 50; `/stash` lists them by project to recall (without sending), remove or clear; a band line, or a chip in pr-watch's band, shows the count. Requires Claude Code 2.1.300.
