import { expect, test } from 'claude-code/testing'

import type { StashItem } from '../types'
import { addItem, changeItems, clearItems, itemsIn, loadItems, MAX_ITEMS, removeItem } from './store'

const texts = (items: readonly StashItem[]) => items.map(item => item.text)

test('addItem puts the newest first and ignores whitespace-only drafts', () => {
  const one = addItem([], 'a', '/repo', 1)
  expect(texts(addItem(one, 'b', '/repo', 2))).toEqual(['b', 'a'])
  expect(addItem(one, '  \n ', '/repo', 2)).toEqual(one)
})

test('addItem moves an identical text to the top instead of duplicating it', () => {
  const list = addItem(addItem(addItem([], 'a', '/x', 1), 'b', '/x', 2), 'c', '/x', 3)
  const moved = addItem(list, ' a ', '/y', 4)
  expect(texts(moved)).toEqual([' a ', 'c', 'b'])
  expect(moved[0]?.project).toBe('/y')
  expect(moved[0]?.at).toBe(4)
})

test('addItem keeps at most MAX_ITEMS, dropping the oldest', () => {
  let list: StashItem[] = []
  for (let i = 1; i <= MAX_ITEMS + 1; i++) {
    list = addItem(list, `t${i}`, '/repo', i)
  }
  expect(list.length).toBe(MAX_ITEMS)
  expect(list[0]?.text).toBe(`t${MAX_ITEMS + 1}`)
  expect(texts(list)).not.toContain('t1')
})

test('removeItem removes only the given item', () => {
  const list = addItem(addItem(addItem([], 'a', '/x', 1), 'b', '/x', 2), 'c', '/x', 3)
  const target = list.find(item => item.text === 'b')!
  expect(texts(removeItem(list, target.id))).toEqual(['c', 'a'])
})

test('clearItems with a project removes only that project, without one removes all', () => {
  const list = addItem(addItem(addItem([], 'a', '/x', 1), 'b', '/y', 2), 'c', '/x', 3)
  expect(texts(clearItems(list, '/x'))).toEqual(['b'])
  expect(clearItems(list)).toEqual([])
  expect(texts(itemsIn(list, '/x'))).toEqual(['c', 'a'])
  expect(texts(itemsIn(list))).toEqual(['c', 'b', 'a'])
})

test('changeItems reads the store fresh, applies the change and writes it back', async () => {
  const held = new Map<string, unknown>([['items', addItem([], 'a', '/x', 1)]])
  const $ = { store: { get: async (key: string) => held.get(key), set: async (key: string, value: unknown) => void held.set(key, value) } } as never
  held.set('items', addItem(await loadItems($), 'from another session', '/x', 2))
  const next = await changeItems($, list => addItem(list, 'b', '/x', 3))
  expect(texts(next)).toEqual(['b', 'from another session', 'a'])
  expect(texts(await loadItems($))).toEqual(['b', 'from another session', 'a'])
})
