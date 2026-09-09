import { describe, it, expect, vi } from 'vitest'

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>()
  return { ...actual }
})

import { command } from '../../../src/commands/cost.ts'

describe('cost command', () => {
  it('has correct descriptor', () => {
    expect(command.name).toBe('cost')
    expect(command.description).toContain('cost')
    expect(typeof command.handler).toBe('function')
  })
})
