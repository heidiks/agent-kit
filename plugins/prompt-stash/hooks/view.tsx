import type { EngineInterface } from 'claude-code'

import type { StashItem, StashScope } from '../types'

export type PaneActions = {
  recall: (item: StashItem) => void
  remove: (id: string) => void
  setScope: (scope: StashScope) => void
  askClear: () => void
  cancelClear: () => void
  clear: () => void
}

export type PaneContext = {
  el: ReturnType<EngineInterface['ui']['resolve']>
  items: StashItem[]
  scope: StashScope
  isClearing: boolean
  now: number
  width: number
  actions: PaneActions
}

export type BandContext = {
  el: ReturnType<EngineInterface['ui']['resolve']>
  count: number
  actions: { stash: () => void; open: () => void }
}

const ROW_META_COLUMNS = 28

export function ago(ms: number): string {
  const minutes = Math.floor(Math.max(0, ms) / 60_000)
  if (minutes < 1) return 'now'
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}

export function projectName(path: string): string {
  return path.split('/').filter(Boolean).pop() ?? path
}

export function preview(text: string, width: number): string {
  const lines = text.trim().split('\n')
  const first = (lines[0] ?? '').trim()
  const line = lines.length > 1 ? `${first} …` : first
  return line.length > width ? `${line.slice(0, Math.max(1, width - 1))}…` : line
}

export function renderPane(ctx: PaneContext) {
  const { Box, Button, Text } = ctx.el
  const textWidth = Math.max(10, ctx.width - ROW_META_COLUMNS)
  const count = ctx.items.length

  const scopeButton = (scope: StashScope, label: string) =>
    ctx.scope === scope ? (
      <Button key={`scope-${scope}`} variant="primary" label={label} onPress={() => ctx.actions.setScope(scope)} />
    ) : (
      <Button key={`scope-${scope}`} plain label={label} onPress={() => ctx.actions.setScope(scope)} />
    )

  const clearControl = ctx.isClearing ? (
    <Box flexDirection="row" gap={1}>
      <Text color="error">{`remove ${count} ${count === 1 ? 'item' : 'items'}?`}</Text>
      <Button key="clear-yes" plain label="yes" onPress={ctx.actions.clear} />
      <Button key="clear-no" plain label="no" onPress={ctx.actions.cancelClear} />
    </Box>
  ) : (
    count > 0 && <Button key="clear" plain label="clear" onPress={ctx.actions.askClear} />
  )

  return (
    <Box flexDirection="column">
      <Text bold>{`Stashed prompts (${count})`}</Text>
      <Box flexDirection="row" gap={1}>
        {scopeButton('project', 'this project')}
        {scopeButton('all', 'all projects')}
        {clearControl}
      </Box>
      {count === 0 && <Text dimColor>{ctx.scope === 'project' ? 'Nothing stashed in this project.' : 'Nothing stashed.'}</Text>}
      {ctx.items.map(item => (
        <Box key={item.id} flexDirection="row" gap={1}>
          <Button key={`recall-${item.id}`} plain onPress={() => ctx.actions.recall(item)}>
            {preview(item.text, textWidth)} <Text dimColor>{`${ago(ctx.now - item.at)} · ${projectName(item.project)}`}</Text>
          </Button>
          <Button key={`rm-${item.id}`} plain label="×" onPress={() => ctx.actions.remove(item.id)} />
        </Box>
      ))}
    </Box>
  )
}

export function renderBand(ctx: BandContext) {
  const { Box, Button, Text } = ctx.el

  return (
    <Box flexDirection="row" gap={2}>
      <Text dimColor>{`${ctx.count} stashed`}</Text>
      <Button key="stash" plain hotkey="s" label="stash draft" onPress={ctx.actions.stash} />
      <Button key="list" plain hotkey="l" label="list" onPress={ctx.actions.open} />
    </Box>
  )
}
