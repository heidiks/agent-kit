import type { Color, EngineInterface, RenderChildren, TextHoverProps } from 'claude-code'

import type { BandStyle, Check, CheckState, Phase, Tone, WatchedPr } from '../types'
import { ago, ICONS, isStale, MAX_INLINE_STAGES, overallState, PHASE_LABELS, SPINNER } from './ado'

export const BAND_STYLES: BandStyle[] = ['table', 'tree', 'cards', 'trail']

export const LEGACY_STYLES: Record<string, BandStyle> = { tabela: 'table', arvore: 'tree', trilha: 'trail' }

export function toneOf(theme: unknown): Tone {
  const name = String(theme ?? '').toLowerCase()
  if (name.includes('light')) return 'light'
  if (name.includes('dark')) return 'dark'
  return 'unknown'
}

export type BandActions = {
  remove: (key: string) => void
  open: (url: string) => void
  clearDone: () => void
  toggleCollapse: () => void
  hide: () => void
  cycleStyle: () => void
  investigate: (pr: WatchedPr, item: Check) => void
}

export type BandContext = {
  el: ReturnType<EngineInterface['ui']['resolve']>
  list: WatchedPr[]
  tick: number
  now: number
  collapsed: boolean
  style: BandStyle
  tone: Tone
  actions: BandActions
}

export const STATE_COLORS: Record<CheckState, Color> = {
  ok: 'success',
  fail: 'error',
  running: 'suggestion',
  queued: 'inactive',
  pending: 'warning',
  warn: 'warning',
  skipped: 'inactive',
}

const PHASE_COLORS: Record<Phase, Color> = {
  loading: 'inactive',
  gate: 'suggestion',
  merged: 'merged',
  abandoned: 'inactive',
}

const hoverOf = (scope: string, color: Color = 'claude'): TextHoverProps => ({
  scope: scope.slice(0, 64),
  color,
  dimColor: false,
  underline: true,
})

const SUMMARY_ORDER = ['fail', 'running', 'pending', 'queued', 'ok'] as const
const DONE_STATES: CheckState[] = ['ok', 'warn', 'skipped']

export function tally(states: CheckState[]): Partial<Record<CheckState, number>> {
  const counts: Partial<Record<CheckState, number>> = {}
  for (const state of states) {
    counts[state] = (counts[state] ?? 0) + 1
  }
  return counts
}

const prNumber = (pr: WatchedPr) => (pr.provider === 'github' ? `#${pr.id}` : `!${pr.id}`)

const repoName = (pr: WatchedPr) => (pr.provider === 'github' && pr.owner ? `${pr.owner}/${pr.repo}` : pr.repo)

export function renderBand(ctx: BandContext) {
  const { Box, Button, Link, Text } = ctx.el
  const { list, tick, now, collapsed, actions } = ctx
  const isDark = ctx.tone === 'dark'
  const faint: Color = isDark ? 'subtle' : 'inactive'
  const quiet = isDark ? { dimColor: true } : { color: 'inactive' as Color }
  const buttonDim = isDark

  const glyph = (state: CheckState) =>
    state === 'running' ? (SPINNER[tick % SPINNER.length] ?? ICONS.running) : ICONS[state]

  const mark = (state: CheckState) => <Text color={STATE_COLORS[state]}>{glyph(state)}</Text>

  const label = (item: Check) =>
    item.href ? (
      <Link href={item.href}>
        <Text hover={hoverOf(`chk-${item.buildId ?? item.name}`)}>{item.name}</Text>
      </Link>
    ) : (
      <Text {...(item.state === 'skipped' ? quiet : {})}>{item.name}</Text>
    )

  const note = (item: Check) => item.note && <Text color={STATE_COLORS[item.state]} dimColor={isDark}>{`(${item.note})`}</Text>

  const checkItem = (item: Check) => (
    <Box flexDirection="row" gap={1}>
      {mark(item.state)}
      {label(item)}
      {note(item)}
    </Box>
  )

  const chip = (item: Check) => (
    <Box flexDirection="row">
      <Text color="inverseText" backgroundColor={STATE_COLORS[item.state]}>{` ${glyph(item.state)} ${item.name} `}</Text>
      {item.note && <Text color={STATE_COLORS[item.state]} dimColor={isDark}>{` ${item.note}`}</Text>}
    </Box>
  )

  const tag = (text: string, color: Color) => (
    <Text color="inverseText" backgroundColor={color}>{` ${text} `}</Text>
  )

  const prLink = (pr: WatchedPr) =>
    pr.url ? (
      <Link href={pr.url}>
        <Text bold hover={hoverOf(`pr-${pr.key}`)}>{prNumber(pr)}</Text>
      </Link>
    ) : (
      <Text bold>{prNumber(pr)}</Text>
    )

  const removeButton = (pr: WatchedPr) => (
    <Button key={`rm-${pr.key}`} plain dimColor={buttonDim} label="×" hover={hoverOf(`rm-${pr.key}`, 'error')} onPress={() => actions.remove(pr.key)} />
  )

  const openButton = (pr: WatchedPr) =>
    pr.url !== '' && (
      <Button key={`open-${pr.key}`} plain dimColor={buttonDim} label="↗" hover={hoverOf(`open-${pr.key}`)} onPress={() => actions.open(pr.url)} />
    )

  const rowActions = (pr: WatchedPr) => (
    <Box flexDirection="row" gap={1}>
      {openButton(pr)}
      {removeButton(pr)}
    </Box>
  )

  const titleText = (pr: WatchedPr) => (
    <Box flexShrink={1} flexGrow={1}>
      <Text wrap="truncate-end" {...quiet}>{pr.title}</Text>
    </Box>
  )

  const errorLine = (pr: WatchedPr, indent: number) =>
    pr.error && (
      <Box paddingLeft={indent}>
        <Text color="warning" wrap="truncate-end">{`! ${pr.provider === 'github' ? 'gh' : 'az'}: ${pr.error}`}</Text>
      </Box>
    )

  const stageSummary = (stages: Check[]) => {
    const counts = tally(stages.map(s => s.state))
    const notable = stages.filter(s => s.state === 'fail' || s.state === 'pending' || s.state === 'running')
    return [
      ...(['fail', 'running', 'pending', 'queued', 'ok', 'warn', 'skipped'] as const)
        .filter(s => counts[s])
        .map(s => <Text color={STATE_COLORS[s]}>{`${glyph(s)} ${counts[s]}`}</Text>),
      ...notable.slice(0, 3).map(stage => checkItem(stage)),
    ]
  }

  const stageLine = (item: Check, indent: number) => {
    const stages = item.stages ?? []
    return (
      <Box flexDirection="row" flexWrap="wrap" columnGap={1} paddingLeft={indent}>
        <Text color={faint}>{`${item.name}:`}</Text>
        {stages.length > MAX_INLINE_STAGES
          ? stageSummary(stages)
          : stages.map((stage, i) => (
              <Box flexDirection="row" gap={1}>
                {i > 0 && <Text color={faint}>›</Text>}
                {checkItem(stage)}
              </Box>
            ))}
      </Box>
    )
  }

  const reasonLine = (pr: WatchedPr, item: Check, indent: number) => (
    <Box flexDirection="row" gap={1} paddingLeft={indent}>
      <Text color="error">└</Text>
      <Box flexShrink={1} flexGrow={1}>
        <Text color="error" wrap="truncate-end">{item.reason}</Text>
      </Box>
      <Button
        key={`inv-${pr.key}-${item.buildId}`}
        plain
        dimColor={buttonDim}
        label="⌕ investigate"
        hover={hoverOf(`inv-${pr.key}-${item.buildId}`)}
        onPress={() => actions.investigate(pr, item)}
      />
    </Box>
  )

  const details = (pr: WatchedPr, indent: number) => [
    ...pr.checks.filter(c => (c.stages?.length ?? 0) > 0).map(c => stageLine(c, indent)),
    ...pr.checks.filter(c => c.reason).map(c => reasonLine(pr, c, indent)),
  ]

  const headline = (pr: WatchedPr, extra?: RenderChildren) => (
    <Box flexDirection="row" gap={1}>
      {mark(overallState(pr.checks, pr.phase))}
      {prLink(pr)}
      {pr.repo !== '' && <Text color={faint}>{repoName(pr)}</Text>}
      {pr.isDraft && tag('draft', 'inactive')}
      {titleText(pr)}
      {extra}
      {rowActions(pr)}
    </Box>
  )

  const tree = (pr: WatchedPr) => (
    <Box flexDirection="column">
      {headline(pr, collapsed && pr.checks.map(c => mark(c.state)))}
      {errorLine(pr, 2)}
      {!collapsed && (
        <Box flexDirection="column">
          <Box flexDirection="row" flexWrap="wrap" columnGap={2} paddingLeft={2}>
            {tag(PHASE_LABELS[pr.phase], PHASE_COLORS[pr.phase])}
            {pr.checks.map(c => checkItem(c))}
          </Box>
          {details(pr, 4)}
        </Box>
      )}
    </Box>
  )

  const card = (pr: WatchedPr) => {
    const state = overallState(pr.checks, pr.phase)
    return (
      <Box flexDirection="column" borderStyle="round" borderColor={STATE_COLORS[state]} paddingX={1}>
        <Box flexDirection="row" gap={1}>
          {mark(state)}
          {prLink(pr)}
          {pr.repo !== '' && <Text bold>{repoName(pr)}</Text>}
          {tag(PHASE_LABELS[pr.phase], PHASE_COLORS[pr.phase])}
          {pr.isDraft && tag('draft', 'inactive')}
          <Box flexGrow={1} />
          {rowActions(pr)}
        </Box>
        {!collapsed && (
          <Box paddingLeft={2}>
            <Text wrap="truncate-end" {...quiet}>{pr.title}</Text>
          </Box>
        )}
        {errorLine(pr, 2)}
        <Box flexDirection="row" flexWrap="wrap" columnGap={1} paddingLeft={2}>
          {pr.checks.map(c => chip(c))}
        </Box>
        {!collapsed && details(pr, 2)}
      </Box>
    )
  }

  const trailNodes = (pr: WatchedPr): Check[] => {
    const builds = pr.checks.filter(c => c.name === 'build')
    const rest = pr.checks.filter(c => c.name !== 'build' && c.name !== 'conflict')
    const conflict = pr.checks.find(c => c.name === 'conflict')
    const buildState = builds.length === 0 ? 'skipped' : (overallState(builds, 'gate'))
    const reviewState = rest.length === 0 ? 'skipped' : overallState(rest, 'gate')

    if (pr.phase === 'merged') {
      return [
        { name: 'gate', state: 'ok' },
        { name: 'merge', state: 'ok' },
        ...pr.checks.flatMap(c => [c, ...(c.stages && c.stages.length <= MAX_INLINE_STAGES ? c.stages : [])]),
      ]
    }
    if (pr.phase === 'abandoned') {
      return [{ name: 'abandoned', state: 'skipped' }]
    }

    return [
      { name: 'build', state: buildState, href: builds[0]?.href },
      ...(conflict ? [conflict] : []),
      { name: 'review', state: reviewState, note: rest.filter(c => c.state !== 'ok').map(c => c.name).join(', ') || undefined },
      { name: 'merge', state: 'queued' },
      { name: 'deploy', state: 'queued' },
    ]
  }

  const trail = (pr: WatchedPr) => {
    const nodes = pr.phase === 'loading' ? [{ name: 'checking', state: 'running' as const }] : trailNodes(pr)
    return (
      <Box flexDirection="column">
        {headline(pr)}
        {errorLine(pr, 2)}
        <Box flexDirection="row" flexWrap="wrap" paddingLeft={2}>
          {nodes.map((node, i) => {
            const previous = nodes[i - 1]
            const isLinked = previous !== undefined && DONE_STATES.includes(previous.state)
            return (
              <Box flexDirection="row">
                {i > 0 && <Text color={isLinked ? 'success' : faint}>{isLinked ? ' ─── ' : ' ┄┄┄ '}</Text>}
                {checkItem(collapsed ? { ...node, note: undefined } : node)}
              </Box>
            )
          })}
        </Box>
        {!collapsed && pr.checks.filter(c => c.reason).map(c => reasonLine(pr, c, 4))}
      </Box>
    )
  }

  const COLUMNS = { mark: 2, origin: 4, pr: 8, repo: 18, phase: 9, age: 6 }

  const tableHeader = (
    <Box flexDirection="row">
      <Box width={COLUMNS.mark}><Text> </Text></Box>
      <Box width={COLUMNS.origin}><Text color={faint} bold>SRC</Text></Box>
      <Box width={COLUMNS.pr}><Text color={faint} bold>PR</Text></Box>
      <Box width={COLUMNS.repo}><Text color={faint} bold>REPO</Text></Box>
      <Box width={COLUMNS.phase}><Text color={faint} bold>PHASE</Text></Box>
      <Box flexGrow={1}><Text color={faint} bold>CHECKS</Text></Box>
      <Box width={COLUMNS.age}><Text color={faint} bold>SINCE</Text></Box>
      <Box width={4}><Text> </Text></Box>
    </Box>
  )

  const tableRow = (pr: WatchedPr) => (
    <Box flexDirection="column">
      <Box flexDirection="row">
        <Box width={COLUMNS.mark}>{mark(overallState(pr.checks, pr.phase))}</Box>
        <Box width={COLUMNS.origin}><Text color={faint}>{pr.provider === 'github' ? 'gh' : 'ado'}</Text></Box>
        <Box width={COLUMNS.pr}>{prLink(pr)}</Box>
        <Box width={COLUMNS.repo}><Text wrap="truncate-end" color={faint}>{repoName(pr)}</Text></Box>
        <Box width={COLUMNS.phase}><Text color={PHASE_COLORS[pr.phase]}>{pr.isDraft ? 'draft' : PHASE_LABELS[pr.phase]}</Text></Box>
        <Box flexGrow={1} flexShrink={1} flexDirection="row" columnGap={2} overflow="hidden">
          {pr.checks.map(c => checkItem(collapsed ? { ...c, note: undefined } : c))}
        </Box>
        <Box width={COLUMNS.age}><Text color={faint}>{pr.changedAt ? ago(now - pr.changedAt) : '-'}</Text></Box>
        <Box width={4}>{rowActions(pr)}</Box>
      </Box>
      {errorLine(pr, COLUMNS.mark + COLUMNS.origin + COLUMNS.pr)}
      {!collapsed && pr.checks.filter(c => c.reason).map(c => reasonLine(pr, c, COLUMNS.mark + COLUMNS.origin + COLUMNS.pr))}
    </Box>
  )

  const counts = tally(list.map(p => overallState(p.checks, p.phase)))
  const lastChecked = Math.max(0, ...list.map(p => p.checkedAt ?? 0))
  const hasStale = list.some(p => isStale(p, now))
  const hasDone = list.some(p => p.isDone)

  const header = (
    <Box flexDirection="row" gap={2}>
      <Text bold color="claude">Pull requests</Text>
      {SUMMARY_ORDER.filter(s => counts[s]).map(s => (
        <Text color={STATE_COLORS[s]}>{`${glyph(s)} ${counts[s]}`}</Text>
      ))}
      {lastChecked > 0 && (
        <Text color={hasStale ? 'warning' : faint}>{`${hasStale ? '! ' : ''}updated ${ago(now - lastChecked)} ago`}</Text>
      )}
      <Box flexGrow={1} />
      <Button key="style" plain dimColor={buttonDim} hover={hoverOf('btn-style')} label={`▤ ${ctx.style}`} onPress={actions.cycleStyle} />
      <Button key="collapse" plain dimColor={buttonDim} hover={hoverOf('btn-collapse')} label={collapsed ? '▾ expand' : '▴ collapse'} onPress={actions.toggleCollapse} />
      {hasDone && <Button key="clear" plain dimColor={buttonDim} hover={hoverOf('btn-clear')} label="⌫ clear done" onPress={actions.clearDone} />}
      <Button key="hide" plain dimColor={buttonDim} hover={hoverOf('btn-hide')} label="⊖ hide" onPress={actions.hide} />
    </Box>
  )

  const body = {
    tree: () => list.map(pr => tree(pr)),
    cards: () => list.map(pr => card(pr)),
    trail: () => list.map(pr => trail(pr)),
    table: () => [tableHeader, ...list.map(pr => tableRow(pr))],
  }[ctx.style]

  return (
    <Box flexDirection="column" paddingX={1}>
      {header}
      {body()}
    </Box>
  )
}
