import { describe, it, expect, vi, beforeEach } from 'vitest'
import { join } from 'node:path'
import { writeFileSync, readFileSync } from 'node:fs'

vi.mock('../../../src/core/SchemaValidator.ts', () => ({
  SchemaValidationError: class extends Error {},
}))

vi.mock('../../../src/evals/descriptionOptimizer.ts', () => ({
  DescriptionOptimizer: class {
    async optimize(member: string, _triggerSet: unknown) {
      return {
        member,
        originalDescription: 'Original desc',
        originalMetrics: { f1: 0.5, precision: 0.5, recall: 0.5 } as any,
        bestDescription: 'Optimized desc',
        bestMetrics: { f1: 0.9, precision: 0.9, recall: 0.9 } as any,
        iterations: 2,
        variants: [],
        improved: true,
      }
    }
  },
}))

vi.mock('../../../src/commands/evalTriggers.ts', () => ({
  loadTriggerSet: () => ({
    member: 'the-scribe',
    shouldTrigger: ['write a commit'],
    shouldNotTrigger: ['debug code'],
  }),
}))

vi.mock('../../../src/runtime/ApplicationContext.ts', () => ({
  ApplicationContext: {
    create: async () => ({
      llm: {
        embed: async () => [0.1, 0.2, 0.3],
      },
    }),
  },
}))

vi.mock('../../../src/commands/config.ts', () => ({
  loadConfigOrExit: async () => ({ provider: 'test', model: 'test-model' }),
}))

import { command } from '../../../src/commands/optimize.ts'

describe('optimize command', () => {
  it('has correct descriptor', () => {
    expect(command.name).toBe('optimize')
    expect(command.description).toContain('trigger accuracy')
    expect(typeof command.handler).toBe('function')
  })

  it('--help prints usage and returns', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    await command.handler(['--help'])
    const output = errorSpy.mock.calls.map((c) => c[0]).join('')
    expect(output).toContain('Usage: agenthood optimize')
    errorSpy.mockRestore()
  })

  it('missing args prints usage and exits 1', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit') as never })
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    await expect(command.handler([])).rejects.toThrow('exit')
    expect(exitSpy).toHaveBeenCalledWith(1)
    exitSpy.mockRestore()
    stderrSpy.mockRestore()
  })

  it('--json outputs machine-readable result', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    await command.handler(['the-scribe', '--triggers', 'test.json', '--json'])
    const output = logSpy.mock.calls.map((c) => c[0]).join('')
    const parsed = JSON.parse(output)
    expect(parsed.member).toBe('the-scribe')
    expect(parsed.improved).toBe(true)
    logSpy.mockRestore()
  })

  it('prints human-readable result by default', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    await command.handler(['the-scribe', '--triggers', 'test.json'])
    const output = logSpy.mock.calls.map((c) => c[0]).join('')
    expect(output).toContain('Description Optimization — the-scribe')
    expect(output).toContain('Original:')
    expect(output).toContain('Best:')
    expect(output).toContain('Improved:')
    logSpy.mockRestore()
  })
})
