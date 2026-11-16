import { describe, it, expect, vi, afterEach } from 'vitest'
import { license } from '../../../src/commands/license.ts'

describe('license command (#580)', () => {
  afterEach(() => vi.restoreAllMocks())

  it('prints the SPDX id of the member it is given', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    await license(['scribe'])
    expect(log.mock.calls.flat().join('\n')).toContain('MIT')
  })

  it('lists every member when no name is given', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    await license([])
    const out = log.mock.calls.flat().join('\n')
    expect(out).toContain('scribe')
    expect(out).toContain('warden')
  })

  it('rejects a name that is not a member', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any)
    await license(['not-a-member'])
    expect(exit).toHaveBeenCalledWith(1)
  })
})
