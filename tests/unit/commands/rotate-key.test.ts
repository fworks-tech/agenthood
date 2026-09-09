import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockReinitialize = vi.fn().mockResolvedValue({ complete: vi.fn().mockResolvedValue({ content: 'pong', usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 }, model: 'test' }) })
const mockWriteFile = vi.fn().mockResolvedValue(undefined)
const mockCreateInterface = vi.fn()

vi.mock('node:readline', () => ({
  createInterface: () => mockCreateInterface(),
}))

vi.mock('node:fs/promises', () => ({
  writeFile: (...args: unknown[]) => mockWriteFile(...args),
}))

vi.mock('../../../src/llm/LLMRouter.ts', () => ({
  LLMRouter: {
    knownProviders: () => ['groq', 'openai', 'anthropic', 'ollama', 'stub'],
    reinitializeProvider: (...args: unknown[]) => mockReinitialize(...args),
  },
}))

vi.mock('../../../src/commands/config.ts', () => ({
  loadConfig: vi.fn().mockResolvedValue({ provider: 'groq', apiKey: 'old-key' }),
}))

import { command } from '../../../src/commands/rotate-key.ts'

describe('rotate-key command', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreateInterface.mockReturnValue({
      question: (_q: string, cb: (answer: string) => void) => cb('new-api-key'),
      close: vi.fn(),
    })
  })

  it('has correct descriptor', () => {
    expect(command.name).toBe('rotate-key')
    expect(command.description).toContain('API key')
    expect(typeof command.handler).toBe('function')
  })

  it('exits with error when no provider given', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit') as never })
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    await expect(command.handler([])).rejects.toThrow('exit')
    expect(exitSpy).toHaveBeenCalledWith(1)
    exitSpy.mockRestore()
    stderrSpy.mockRestore()
  })

  it('exits with error for unknown provider', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit') as never })
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    await expect(command.handler(['unknown-provider'])).rejects.toThrow('exit')
    expect(exitSpy).toHaveBeenCalledWith(1)
    exitSpy.mockRestore()
    stderrSpy.mockRestore()
  })

  it('validates key, updates config, and reinitializes provider', async () => {
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    await command.handler(['groq'])
    expect(mockReinitialize).toHaveBeenCalledWith('groq', expect.objectContaining({ provider: 'groq', apiKey: 'new-api-key' }))
    expect(mockWriteFile).toHaveBeenCalled()
    stdoutSpy.mockRestore()
  })

  it('exits with error when key validation fails', async () => {
    mockReinitialize.mockRejectedValueOnce(new Error('invalid key'))
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit') as never })
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    await expect(command.handler(['groq'])).rejects.toThrow('exit')
    expect(exitSpy).toHaveBeenCalledWith(2)
    exitSpy.mockRestore()
    stderrSpy.mockRestore()
  })

  it('exits with error when no key provided', async () => {
    mockCreateInterface.mockReturnValue({
      question: (_q: string, cb: (answer: string) => void) => cb(''),
      close: vi.fn(),
    })
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('exit') as never })
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    await expect(command.handler(['groq'])).rejects.toThrow('exit')
    expect(exitSpy).toHaveBeenCalledWith(1)
    exitSpy.mockRestore()
    stderrSpy.mockRestore()
  })
})
