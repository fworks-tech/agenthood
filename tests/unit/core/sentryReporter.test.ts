import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createTestContext } from '../../helpers/testContext.ts'

const captureException = vi.fn()
const init = vi.fn()

vi.mock('@sentry/node', () => ({
  init,
  captureException,
}))

import { reportErrorToSentry, reportBackgroundFailure, isDevEnvironment } from '../../../src/core/sentryReporter.js'
import { BaseAgent } from '../../../src/agents/base/BaseAgent.ts'
import { ReActLoop } from '../../../src/reasoning/ReActLoop.ts'
import { ToolRegistry } from '../../../src/tools/ToolRegistry.ts'
import type { ILLMProvider } from '../../../src/llm/ILLMProvider.js'
import type { ITool } from '../../../src/tools/ITool.js'

class TestAgent extends BaseAgent {
  role = 'test-agent'
  protected tools: ITool[] = []

  protected async getSystemPrompt(): Promise<string> {
    return 'test system prompt'
  }
}

function failingLlm(): ILLMProvider {
  return {
    complete: vi.fn().mockRejectedValue(new Error('boom')),
    stream: vi.fn(),
    embed: vi.fn(),
    getContextWindow: vi.fn().mockReturnValue(8192),
  }
}

const DSN = 'https://public@example.ingest.sentry.io/123'

describe('reportErrorToSentry', () => {
  beforeEach(() => {
    captureException.mockClear()
    init.mockClear()
  })

  it('is a no-op when no DSN is configured', async () => {
    const context = createTestContext()
    await reportErrorToSentry(new Error('boom'), context, {
      member: 'test-agent',
      model: 'm',
      durationMs: 10,
      status: 'error',
      correlationId: 'c',
    })
    expect(captureException).not.toHaveBeenCalled()
    expect(init).not.toHaveBeenCalled()
  })

  it('captures the error with member tags when a DSN is configured', async () => {
    const context = createTestContext({ sentry: { dsn: DSN } })
    const error = new Error('boom')
    await reportErrorToSentry(error, context, {
      member: 'test-agent',
      model: 'mock-model',
      durationMs: 42,
      status: 'error',
      correlationId: 'corr-1',
    })

    expect(init).toHaveBeenCalledWith({ dsn: DSN, tracesSampleRate: 0 })
    expect(captureException).toHaveBeenCalledWith(error, {
      tags: { member: 'test-agent', model: 'mock-model', status: 'error' },
      extra: { durationMs: 42, correlationId: 'corr-1' },
    })
  })

  it('initializes Sentry only once per DSN', async () => {
    const dsn = 'https://public@other.ingest.sentry.io/456'
    const context = createTestContext({ sentry: { dsn } })
    await reportErrorToSentry(new Error('a'), context, { member: 'm', model: 'x', durationMs: 1, status: 'error', correlationId: 'a' })
    await reportErrorToSentry(new Error('b'), context, { member: 'm', model: 'x', durationMs: 1, status: 'error', correlationId: 'b' })
    expect(init).toHaveBeenCalledTimes(1)
    expect(captureException).toHaveBeenCalledTimes(2)
  })

  it('never throws even when Sentry fails', async () => {
    captureException.mockImplementationOnce(() => {
      throw new Error('sentry exploded')
    })
    const context = createTestContext({ sentry: { dsn: DSN } })
    await expect(
      reportErrorToSentry(new Error('boom'), context, { member: 'm', model: 'x', durationMs: 1, status: 'error', correlationId: 'c' }),
    ).resolves.toBeUndefined()
  })
})

describe('isDevEnvironment', () => {
  it('is true only for the development environment', () => {
    expect(isDevEnvironment('development')).toBe(true)
    expect(isDevEnvironment('production')).toBe(false)
    expect(isDevEnvironment('test')).toBe(false)
    expect(isDevEnvironment(undefined)).toBe(false)
  })
})

describe('reportBackgroundFailure', () => {
  const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

  beforeEach(() => {
    consoleSpy.mockClear()
    captureException.mockClear()
    init.mockClear()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('reports to Sentry and not the console in non-dev environments', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    const context = createTestContext({ sentry: { dsn: DSN } })

    await reportBackgroundFailure(new Error('trace failed'), context, 'trace recording failed', { member: 'test-agent' })

    expect(captureException).toHaveBeenCalledTimes(1)
    expect(consoleSpy).not.toHaveBeenCalled()
  })

  it('reports to Sentry and the console in development', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    const context = createTestContext({ sentry: { dsn: DSN } })

    await reportBackgroundFailure(new Error('trace failed'), context, 'trace recording failed', { member: 'test-agent' })

    expect(captureException).toHaveBeenCalledTimes(1)
    expect(consoleSpy).toHaveBeenCalledWith('[trace recording failed] trace failed')
  })

  it('keeps dev console visibility without a DSN', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    const context = createTestContext()

    await reportBackgroundFailure(new Error('trace failed'), context, 'trace recording failed')

    expect(captureException).not.toHaveBeenCalled()
    expect(consoleSpy).toHaveBeenCalledWith('[trace recording failed] trace failed')
  })
})

describe('BaseAgent sentry integration', () => {
  beforeEach(() => {
    captureException.mockClear()
    init.mockClear()
  })

  it('captures the error when Sentry is configured', async () => {
    const llm = failingLlm()
    const agent = new TestAgent(llm, new ReActLoop(llm, new ToolRegistry()), new ToolRegistry())
    const context = createTestContext({ sentry: { dsn: DSN } })

    await expect(agent.run('task', context)).rejects.toThrow('boom')
    expect(captureException).toHaveBeenCalled()
    const [error, options] = captureException.mock.calls[0]
    expect(error.message).toBe('boom')
    expect(options.tags.member).toBe('test-agent')
  })

  it('does not import or capture without Sentry configuration', async () => {
    captureException.mockClear()
    init.mockClear()
    const llm = failingLlm()
    const agent = new TestAgent(llm, new ReActLoop(llm, new ToolRegistry()), new ToolRegistry())
    const context = createTestContext()

    await expect(agent.run('task', context)).rejects.toThrow('boom')
    expect(captureException).not.toHaveBeenCalled()
    expect(init).not.toHaveBeenCalled()
  })
})
