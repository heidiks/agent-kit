import { expect, test } from 'claude-code/testing'

import { COMMANDS, helpText, VERBS } from './help'

test('help covers every verb the command parser handles', () => {
  const usages = COMMANDS.map(command => command.usage).join('\n')
  for (const verb of VERBS.filter(verb => verb !== '' && verb !== 'all')) {
    expect(usages).toContain(verb)
  }
  expect(helpText().split('\n').length).toBe(COMMANDS.length + 4)
})
