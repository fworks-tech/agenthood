import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { oath } from '../../src/commands/oath.js'

describe('oath command', () => {
  let output = ''

  beforeEach(() => {
    output = ''
    vi.spyOn(console, 'log').mockImplementation((...args) => {
      output += args.join(' ')
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('prints all five oath principles', async () => {
    await oath()
    expect(output).toContain('I commit with intention.')
    expect(output).toContain('I branch with purpose.')
    expect(output).toContain('I review with honesty.')
    expect(output).toContain('I ship with confidence.')
    expect(output).toContain('I never push to main.')
  })

  it('prints the Agenthood heading', async () => {
    await oath()
    expect(output).toContain('The Oath of the Agenthood')
  })
})
