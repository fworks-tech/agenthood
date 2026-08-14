import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../../../src/commands/run.js', () => ({
  loadConfig: vi.fn(),
}))

import { health, command } from '../../../src/commands/health.js'
import { loadConfig } from '../../../src/commands/run.js'

describe('health command', () => {
  beforeEach(() => {
    vi.mocked(loadConfig).mockReset()
    vi.mocked(loadConfig).mockResolvedValue({} as never)
    process.exitCode = undefined
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('exports a well-formed descriptor', () => {
    expect(command.name).toBe('health')
    expect(command.description).toBeTruthy()
    expect(typeof command.handler).toBe('function')
  })

  it('prints a healthy report and exits 0', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})

    await health()

    const output = log.mock.calls.flat().join(' ')
    expect(output).toContain('Agenthood Health')
    expect(output).toContain('Overall: HEALTHY')
    expect(process.exitCode).toBe(0)
  })

  it('prints JSON with --json', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})

    await health(['--json'])

    const output = log.mock.calls.flat().join(' ')
    const parsed = JSON.parse(output)
    expect(parsed.status).toBe('healthy')
    expect(parsed.checks.length).toBeGreaterThanOrEqual(3)
    expect(process.exitCode).toBe(0)
  })

  it('prints usage on --help', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})

    await health(['--help'])

    expect(log.mock.calls.flat().join(' ')).toContain('Exit codes')
  })
})
