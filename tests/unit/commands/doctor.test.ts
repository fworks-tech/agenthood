import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../../../src/commands/config.ts', () => ({
  loadConfig: vi.fn(),
}))

import { doctor, command } from '../../../src/commands/doctor.ts'
import { loadConfig } from '../../../src/commands/config.ts'

const CHECK_NAMES = [
  'Node version',
  'agenthood version',
  'Config file',
  'API keys',
  'Provider readiness',
  'Skill files',
  'Lockfile integrity',
  'Git hooks',
]

describe('doctor command', () => {
  beforeEach(() => {
    vi.mocked(loadConfig).mockReset()
    // keyless provider → deterministic pass for the API-keys/readiness checks
    vi.mocked(loadConfig).mockResolvedValue({ provider: 'ollama' } as never)
    process.exitCode = undefined
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('exports a well-formed descriptor', () => {
    expect(command.name).toBe('doctor')
    expect(command.description).toBeTruthy()
    expect(typeof command.handler).toBe('function')
  })

  it('runs every diagnostic and reports pass/fail per check', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})

    await doctor()

    const output = log.mock.calls.flat().join('\n')
    expect(output).toContain('Agenthood Doctor')
    for (const name of CHECK_NAMES) {
      expect(output).toContain(name)
    }
    expect(typeof process.exitCode).toBe('number')
  })

  it('emits valid JSON with all 8 checks and a healthy flag on --json', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})

    await doctor(['--json'])

    const parsed = JSON.parse(log.mock.calls.flat().join(''))
    expect(Array.isArray(parsed.checks)).toBe(true)
    expect(parsed.checks.length).toBe(CHECK_NAMES.length)
    expect(parsed.checks.map((c: { name: string }) => c.name)).toEqual(CHECK_NAMES)
    expect(typeof parsed.healthy).toBe('boolean')
    expect(parsed.checks.every((c: { status: string }) => ['pass', 'fail', 'warn'].includes(c.status))).toBe(true)
  })

  it('exits 1 when a required key is missing', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.mocked(loadConfig).mockResolvedValue({ provider: 'groq' } as never)
    const saved = process.env.GROQ_API_KEY
    delete process.env.GROQ_API_KEY

    await doctor(['--json'])

    expect(process.exitCode).toBe(1)
    if (saved !== undefined) process.env.GROQ_API_KEY = saved
  })

  it('prints usage on --help', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})

    await doctor(['--help'])

    expect(log.mock.calls.flat().join(' ')).toContain('Exit codes')
  })
})
