import type { Color, EngineInterface, RenderChildren, RenderSurface, TextHoverProps } from 'claude-code'

import type { BandMode, BandStyle, Check, CheckState, OverviewScope, Phase, SummaryStatus, Tone, WatchedPr } from '../types'
import { ago, byUrgency, ICONS, isStale, MAX_INLINE_STAGES, overallState, overviewStats, PHASE_LABELS, prLabel, SPINNER } from './ado'

export const BAND_STYLES: BandStyle[] = ['table', 'tree', 'cards', 'trail']

export const BAND_MODES: BandMode[] = ['full', 'compact', 'mini']

export const LEGACY_STYLES: Record<string, BandStyle> = { tabela: 'table', arvore: 'tree', trilha: 'trail' }

export function toneOf(theme: unknown): Tone {
  const name = String(theme ?? '').toLowerCase()
  if (name.includes('light')) return 'light'
  if (name.includes('dark')) return 'dark'
  return 'unknown'
}

export type BandActions = {
  remove: (key: string) => void
  askRemove: (key: string) => void
  cancelRemove: () => void
  openOverview: () => void
  toggleDone: () => void
  open: (url: string) => void
  clearDone: () => void
  cycleMode: () => void
  hide: () => void
  cycleStyle: () => void
  investigate: (pr: WatchedPr, item: Check) => void
}

export type BandContext = {
  el: ReturnType<EngineInterface['ui']['resolve']>
  list: WatchedPr[]
  tick: number
  now: number
  mode: BandMode
  style: BandStyle
  tone: Tone
  pendingRemove: string
  limit: number
  doneExpanded: boolean
  isPane: boolean
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
  const { list, tick, now, actions } = ctx
  const collapsed = ctx.mode === 'compact'
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
    <Button key={`rm-${pr.key}`} plain dimColor={buttonDim} label="×" hover={hoverOf(`rm-${pr.key}`, 'error')} onPress={() => actions.askRemove(pr.key)} />
  )

  const openButton = (pr: WatchedPr) =>
    pr.url !== '' && (
      <Button key={`open-${pr.key}`} variant="primary" label="↗ open" onPress={() => actions.open(pr.url)} />
    )

  const confirmRemove = (pr: WatchedPr) => (
    <Box flexDirection="row" gap={1}>
      <Text color="error">remove?</Text>
      <Button key={`rm-yes-${pr.key}`} plain label="yes" hover={hoverOf(`rm-yes-${pr.key}`, 'error')} onPress={() => actions.remove(pr.key)} />
      <Button key={`rm-no-${pr.key}`} plain label="no" hover={hoverOf(`rm-no-${pr.key}`)} onPress={actions.cancelRemove} />
    </Box>
  )

  const rowActions = (pr: WatchedPr) =>
    ctx.pendingRemove === pr.key ? (
      confirmRemove(pr)
    ) : (
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
      <Box flexShrink={1} marginRight={1}>
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

  const COLUMNS = { mark: 2, origin: 4, pr: 8, repo: 16, title: 30, phase: 9, age: 6 }

  const tableHeader = (
    <Box flexDirection="row">
      <Box width={COLUMNS.mark}><Text> </Text></Box>
      <Box width={COLUMNS.origin}><Text color={faint} bold>SRC</Text></Box>
      <Box width={COLUMNS.pr}><Text color={faint} bold>PR</Text></Box>
      <Box width={COLUMNS.repo}><Text color={faint} bold>REPO</Text></Box>
      <Box width={COLUMNS.title}><Text color={faint} bold>TITLE</Text></Box>
      <Box width={COLUMNS.phase}><Text color={faint} bold>PHASE</Text></Box>
      <Box flexGrow={1}><Text color={faint} bold>CHECKS</Text></Box>
      <Box width={COLUMNS.age}><Text color={faint} bold>SINCE</Text></Box>
      <Box width={15}><Text> </Text></Box>
    </Box>
  )

  const tableRow = (pr: WatchedPr) => (
    <Box flexDirection="column">
      <Box flexDirection="row">
        <Box width={COLUMNS.mark}>{mark(overallState(pr.checks, pr.phase))}</Box>
        <Box width={COLUMNS.origin}><Text color={faint}>{pr.provider === 'github' ? 'gh' : 'ado'}</Text></Box>
        <Box width={COLUMNS.pr}>{prLink(pr)}</Box>
        <Box width={COLUMNS.repo} paddingRight={1}><Text wrap="truncate-end" color={faint}>{repoName(pr)}</Text></Box>
        <Box width={COLUMNS.title} paddingRight={1}><Text wrap="truncate-end" {...quiet}>{pr.title}</Text></Box>
        <Box width={COLUMNS.phase}><Text color={PHASE_COLORS[pr.phase]}>{pr.isDraft ? 'draft' : PHASE_LABELS[pr.phase]}</Text></Box>
        <Box flexGrow={1} flexShrink={1} flexDirection="row" columnGap={2} overflow="hidden">
          {pr.checks.map(c => checkItem(collapsed ? { ...c, note: undefined } : c))}
        </Box>
        <Box width={COLUMNS.age}><Text color={faint}>{pr.changedAt ? ago(now - pr.changedAt) : '-'}</Text></Box>
        <Box width={15}>{rowActions(pr)}</Box>
      </Box>
      {errorLine(pr, COLUMNS.mark + COLUMNS.origin + COLUMNS.pr)}
      {!collapsed && pr.checks.filter(c => c.reason).map(c => reasonLine(pr, c, COLUMNS.mark + COLUMNS.origin + COLUMNS.pr))}
    </Box>
  )

  const counts = tally(list.map(p => overallState(p.checks, p.phase)))
  const lastChecked = Math.max(0, ...list.map(p => p.checkedAt ?? 0))
  const hasStale = list.some(p => isStale(p, now))
  const ordered = byUrgency(list)
  const done = ordered.filter(p => p.isDone)
  const candidates = [...ordered.filter(p => !p.isDone), ...(ctx.doneExpanded ? done : [])]
  const rows = candidates.slice(0, ctx.limit)
  const hiddenCount = candidates.length - rows.length

  const modeButtons = [
    <Button key="mode" plain dimColor={buttonDim} hover={hoverOf('btn-mode')} label={`⇕ ${ctx.mode}`} onPress={actions.cycleMode} />,
    <Button key="overview" plain dimColor={buttonDim} hover={hoverOf('btn-overview')} label="⊞ overview" onPress={actions.openOverview} />,
    <Button key="hide" plain dimColor={buttonDim} hover={hoverOf('btn-hide')} label="⊖ hide" onPress={actions.hide} />,
  ]

  if (ctx.mode === 'mini' && !ctx.isPane) {
    const top = ordered.find(p => !p.isDone) ?? ordered[0]
    const topState = top ? overallState(top.checks, top.phase) : 'ok'
    const attention = top?.checks.find(c => c.state !== 'ok' && c.state !== 'skipped')
    return (
      <Box flexDirection="row" gap={2} paddingX={1}>
        <Text bold color="claude">PRs</Text>
        {SUMMARY_ORDER.filter(s => counts[s]).map(s => (
          <Text color={STATE_COLORS[s]}>{`${glyph(s)} ${counts[s]}`}</Text>
        ))}
        {top && (
          <Box flexDirection="row" gap={1} flexShrink={1}>
            {mark(topState)}
            {prLink(top)}
            <Box flexShrink={2}>
              <Text wrap="truncate-end" {...quiet}>{top.title || repoName(top)}</Text>
            </Box>
            <Text wrap="truncate-end" color={STATE_COLORS[attention?.state ?? topState]}>
              {attention ? `${attention.name}${attention.note ? ` (${attention.note})` : ''}` : PHASE_LABELS[top.phase]}
            </Text>
          </Box>
        )}
        <Box flexGrow={1} />
        {modeButtons}
      </Box>
    )
  }

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
      {!ctx.isPane && modeButtons}
    </Box>
  )

  const body = {
    tree: () => rows.map(pr => tree(pr)),
    cards: () => rows.map(pr => card(pr)),
    trail: () => rows.map(pr => trail(pr)),
    table: () => [tableHeader, ...rows.map(pr => tableRow(pr))],
  }[ctx.style]

  const footer = (done.length > 0 || hiddenCount > 0) && (
    <Box flexDirection="row" gap={2} paddingLeft={1}>
      {done.length > 0 && <Text color={STATE_COLORS.ok}>{`✓ ${done.length} finished`}</Text>}
      {done.length > 0 && !ctx.isPane && (
        <Button key="toggle-done" plain dimColor={buttonDim} hover={hoverOf('btn-toggle-done')} label={ctx.doneExpanded ? '▴ hide' : '▾ show'} onPress={actions.toggleDone} />
      )}
      {done.length > 0 && <Button key="clear" plain dimColor={buttonDim} hover={hoverOf('btn-clear')} label="⌫ clear" onPress={actions.clearDone} />}
      {hiddenCount > 0 && (
        <Button key="more" variant="primary" label={`+${hiddenCount} more ›`} onPress={actions.openOverview} />
      )}
    </Box>
  )

  return (
    <Box flexDirection="column" paddingX={1}>
      {header}
      {body()}
      {footer}
    </Box>
  )
}

export type OverviewContext = BandContext & {
  scope: OverviewScope
  sessionCount: number
  summary: string
  summaryStatus: SummaryStatus
  overview: {
    setScope: (scope: OverviewScope) => void
    summarize: () => void
    copySummary: (surface: RenderSurface) => void
  }
}

const TIMELINE_STEPS = 6

export function renderOverview(ctx: OverviewContext) {
  const { Box, Button, Text } = ctx.el
  const isDark = ctx.tone === 'dark'
  const faint: Color = isDark ? 'subtle' : 'inactive'
  const stats = overviewStats(ctx.list)
  const ordered = byUrgency(ctx.list)

  const scopeButton = (scope: OverviewScope, label: string) =>
    ctx.scope === scope ? (
      <Button key={`scope-${scope}`} variant="primary" label={label} onPress={() => ctx.overview.setScope(scope)} />
    ) : (
      <Button key={`scope-${scope}`} plain dimColor={isDark} hover={hoverOf(`scope-${scope}`)} label={label} onPress={() => ctx.overview.setScope(scope)} />
    )

  const stat = (count: number, label: string, state: CheckState) =>
    count > 0 && <Text color={STATE_COLORS[state]}>{`${ICONS[state]} ${count} ${label}`}</Text>

  const timelineRow = (pr: WatchedPr) => {
    const steps = (pr.history ?? []).slice(-TIMELINE_STEPS)
    return (
      <Box flexDirection="row" flexWrap="wrap" columnGap={1}>
        <Box width={28}>
          <Text bold wrap="truncate-end">{prLabel(pr)}</Text>
        </Box>
        {steps.length === 0 && <Text color={faint}>no changes recorded yet</Text>}
        {steps.map((step, i) => (
          <Box flexDirection="row" gap={1}>
            {i > 0 && <Text color={faint}>›</Text>}
            <Text color={STATE_COLORS[step.state]}>{ICONS[step.state]}</Text>
            <Text>{step.text.split(' · ')[0]}</Text>
            <Text color={faint}>{ago(ctx.now - step.at)}</Text>
          </Box>
        ))}
      </Box>
    )
  }

  const summaryBody = () => {
    if (ctx.summaryStatus === 'running') {
      return <Text color="suggestion">summarizing with haiku…</Text>
    }
    if (ctx.summaryStatus === 'error') {
      return (
        <Box flexDirection="row" gap={2}>
          <Text color="warning">Could not summarize.</Text>
          <Button key="summarize" plain hover={hoverOf('btn-summarize')} label="✎ retry" onPress={ctx.overview.summarize} />
        </Box>
      )
    }
    if (ctx.summary === '') {
      return (
        <Box flexDirection="row" gap={2}>
          <Button key="summarize" variant="primary" label="✎ summarize" onPress={ctx.overview.summarize} />
          <Text color={faint}>one short call to haiku with the data above</Text>
        </Box>
      )
    }
    return (
      <Box flexDirection="column">
        <Text>{ctx.summary}</Text>
        <Box flexDirection="row" gap={2}>
          <Button key="copy-summary" plain hover={hoverOf('btn-copy-summary')} label="⧉ copy" onPress={press => ctx.overview.copySummary(press.surface)} />
          <Button key="summarize" plain dimColor={isDark} hover={hoverOf('btn-summarize')} label="✎ again" onPress={ctx.overview.summarize} />
        </Box>
      </Box>
    )
  }

  return (
    <Box flexDirection="column" paddingX={1} rowGap={1}>
      <Box flexDirection="row" gap={2}>
        <Text bold color="claude">PR overview</Text>
        {scopeButton('all', 'all')}
        {scopeButton('session', `this session (${ctx.sessionCount})`)}
        <Box flexGrow={1} />
        <Text color={faint}>esc to close</Text>
      </Box>
      <Box flexDirection="row" gap={2}>
        <Text>{`${stats.total} PRs`}</Text>
        {stat(stats.failing, 'failing', 'fail')}
        {stat(stats.waiting, 'waiting', 'pending')}
        {stat(stats.running, 'running', 'running')}
        {stat(stats.merged, 'merged', 'ok')}
        {stats.finished > 0 && <Text color={faint}>{`${stats.finished} finished`}</Text>}
      </Box>
      {ctx.list.length === 0 ? (
        <Text color={faint}>No PRs in this scope.</Text>
      ) : (
        renderBand({ ...ctx, mode: 'full', isPane: true, limit: Number.POSITIVE_INFINITY, doneExpanded: true })
      )}
      {ordered.length > 0 && (
        <Box flexDirection="column">
          <Text bold color={faint}>TIMELINE</Text>
          {ordered.map(pr => timelineRow(pr))}
        </Box>
      )}
      {ordered.length > 0 && (
        <Box flexDirection="column">
          <Text bold color={faint}>SUMMARY</Text>
          {summaryBody()}
        </Box>
      )}
    </Box>
  )
}
