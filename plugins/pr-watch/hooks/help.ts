export type CommandHelp = { usage: string; summary: string }

export const COMMANDS: CommandHelp[] = [
  { usage: '/pr-watch', summary: "List this session's PRs with their state" },
  { usage: '/pr-watch <id|url|owner/repo#N> ...', summary: 'Watch one or more PRs (spaces or commas): an Azure DevOps id, any PR URL, or owner/repo#N' },
  { usage: '/pr-watch mine', summary: "Your open PRs: the session repo's go to the band, the others to the overview's all filter" },
  { usage: '/pr-watch rm <target> ...', summary: 'Stop watching one or more PRs' },
  { usage: '/pr-watch clear', summary: 'Drop finished PRs' },
  { usage: '/pr-watch clear-all', summary: 'Drop every PR of this session (kept for other sessions that watch it)' },
  { usage: '/pr-watch overview', summary: 'Popup with every PR, plans (spec tasks), timeline and an on-demand summary (alias: all)' },
  { usage: '/pr-watch mode [full|compact|mini]', summary: 'Band size; without a value, cycles' },
  { usage: '/pr-watch style [table|tree|cards|trail]', summary: 'Band layout; without a value, cycles' },
  { usage: '/pr-watch hide | show', summary: 'Hide the band (summary moves to the status line) or show it again' },
  { usage: '/pr-watch help', summary: 'This list' },
]

export const VERBS = ['', 'mine', 'rm', 'clear', 'clear-all', 'overview', 'all', 'mode', 'style', 'hide', 'show', 'help']

export function helpText(): string {
  const width = Math.max(...COMMANDS.map(command => command.usage.length))
  return [
    'pr-watch commands:',
    ...COMMANDS.map(command => `  ${command.usage.padEnd(width)}  ${command.summary}`),
    '',
    'In the band: click a title or repo for details, ↗ open, × remove, ⌕ investigate a failure, ✓ mark done when a task PR merged.',
    'Options (Azure DevOps, GitHub hosts, notifications, rows...): /plugin > pr-watch > configure.',
  ].join('\n')
}
