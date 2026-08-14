import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

vi.mock('node:readline', () => ({
  createInterface: vi.fn(() => ({
    question: vi.fn((_query: string, callback: (answer: string) => void) => callback('')),
    close: vi.fn(),
  })),
}))

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>()
  return { ...actual, copyFile: vi.fn(), mkdir: vi.fn(), readFile: vi.fn(), writeFile: vi.fn() }
})

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>()
  return { ...actual, existsSync: vi.fn() }
})

import { copyFile, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'

describe('init command', () => {
  let output = ''

  beforeEach(() => {
    output = ''
    vi.spyOn(console, 'log').mockImplementation((...args) => { output += args.join(' ') + '\n' })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(copyFile).mockResolvedValue(undefined)
    vi.mocked(copyFile).mockClear()
    vi.mocked(writeFile).mockResolvedValue(undefined)
    vi.mocked(writeFile).mockClear()
    vi.mocked(readFile).mockRejectedValue(new Error('not found'))
    vi.mocked(existsSync).mockClear()
    vi.mocked(existsSync).mockImplementation((p) => {
      if (typeof p !== 'string') return true
      if (p.includes('config.json') && !p.includes('config.example')) return false
      if (p.includes('config.example.json')) return false
      return true
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('prints the welcome message', async () => {
    const { init } = await import('../../src/commands/init.js')
    await init()
    expect(output).toContain('Welcome to the Agenthood')
  })

  it('prints the completion message', async () => {
    const { init } = await import('../../src/commands/init.js')
    await init()
    expect(output).toContain('Society is ready')
  })

  it('writes agenthood config', async () => {
    vi.mocked(existsSync).mockReturnValue(false)
    const { init } = await import('../../src/commands/init.js')
    await init()
    const writeCalls = vi.mocked(writeFile).mock.calls.map((c) => c as [string, string, object])
    const configCalls = writeCalls.filter(([path]) => path.includes('config.json'))
    expect(configCalls.length).toBeGreaterThanOrEqual(1)
  })

  it('--dry-run lists planned files without writing anything', async () => {
    vi.mocked(existsSync).mockReturnValue(false)
    const { init } = await import('../../src/commands/init.js')
    await init(['--dry-run'])
    expect(output).toContain('Dry run')
    expect(output).toMatch(/\.agenthood[\\/]config\.json/)
    expect(vi.mocked(writeFile)).not.toHaveBeenCalled()
    expect(vi.mocked(copyFile)).not.toHaveBeenCalled()
  })
})

  it('scaffolds the observability config block', async () => {
    vi.mocked(existsSync).mockImplementation((p) => typeof p === 'string' && !p.endsWith('config.json'))
    const example = readFileSync(join(process.cwd(), '.agenthood', 'config.example.json'), 'utf8')
    vi.mocked(readFile).mockResolvedValue(example)
    const { init } = await import('../../src/commands/init.js')
    await init()
    const writeCalls = vi.mocked(writeFile).mock.calls.map((c) => c as [string, string, object])
    const configCall = writeCalls.find(([path]) => path.includes('config.json') && !path.includes('example'))
    expect(configCall).toBeTruthy()
    const config = JSON.parse(configCall![1])
    expect(config.observability).toBeDefined()
    expect(config.observability.redaction.enabled).toBe(false)
    expect(config.observability.retention.ttlDays).toBe(30)
    expect(config.observability.alerts.burstThreshold).toBe(10)
    expect(config.observability.tracePath).toContain('traces.ndjson')
  })
