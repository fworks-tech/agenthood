import { describe, it, expect, vi } from 'vitest'
import { applySlashActivations, parseSlashActivations } from '../../../src/skills/activation/slash.ts'

describe('parseSlashActivations (#530)', () => {
  const known = new Set(['scribe', 'reviewer'])

  it('activates a leading slash token and removes it from the task', () => {
    expect(parseSlashActivations('/scribe write the message', known)).toMatchObject({
      task: 'write the message',
      activate: ['scribe'],
    })
  })

  it('activates several skills in a row', () => {
    expect(parseSlashActivations('/scribe /reviewer fix it', known).activate).toEqual(['scribe', 'reviewer'])
  })

  it('turns a skill off', () => {
    expect(parseSlashActivations('/scribe off fix it', known)).toMatchObject({
      task: 'fix it',
      activate: [],
      deactivate: ['scribe'],
    })
  })

  it('leaves an unknown name in the task and reports it', () => {
    const result = parseSlashActivations('/nope fix it', known)
    expect(result.unknown).toEqual(['nope'])
    expect(result.task).toBe('fix it')
  })

  it('does not treat a slash inside a sentence as activation', () => {
    const result = parseSlashActivations('explain the /scribe contract', known)
    expect(result.activate).toEqual([])
    expect(result.task).toBe('explain the /scribe contract')
  })
})

describe('applySlashActivations (#530)', () => {
  const known = new Set(['scribe', 'reviewer'])

  it('collects activated blocks and removes the tokens from the task', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const outcome = await applySlashActivations('  /scribe /reviewer fix it', known, async (name) => ({
        success: true,
        output: `${name} block`,
      }))
      expect(outcome.explicitSkills).toEqual(['scribe block', 'reviewer block'])
      expect(outcome.task).toBe('fix it')
    } finally {
      warn.mockRestore()
    }
  })

  it('warns about a refused activation and keeps the task', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const outcome = await applySlashActivations('/scribe fix it', known, async () => ({
        success: false,
        output: '',
        error: 'no budget',
      }))
      expect(outcome.explicitSkills).toEqual([])
      expect(warn.mock.calls.flat().join(' ')).toContain('no budget')
    } finally {
      warn.mockRestore()
    }
  })

  it('leaves a task with no leading slash exactly as it was', async () => {
    const outcome = await applySlashActivations('trim  the   diff', known, async () => undefined)
    expect(outcome).toEqual({ task: 'trim  the   diff', explicitSkills: [] })
  })

  it('falls back to a minimal task when the message was only a slash token', async () => {
    const outcome = await applySlashActivations('/scribe', known, async () => ({ success: true, output: 'b' }))
    expect(outcome.task).toBe('Follow the explicitly activated skill.')
  })
})
