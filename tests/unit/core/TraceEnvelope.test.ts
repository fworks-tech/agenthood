import { describe, it, expect } from 'vitest'
import { createTraceEnvelope } from '../../../src/core/TraceEnvelope.js'
import { contentHash } from '../../../src/utils/hash.js'

describe('createTraceEnvelope', () => {
  it('produces a complete envelope with hashes and defaults', () => {
    const env = createTraceEnvelope({
      member: 'the-scribe',
      input: 'input text',
      output: 'output text',
      durationMs: 42,
      tokenCount: { input: 5, output: 7, total: 12 },
      cost: 0.001,
      qualityScore: 0.9,
      status: 'success',
      correlationId: 'corr-1',
    })

    expect(env).toMatchObject({
      member: 'the-scribe',
      inputHash: contentHash('input text'),
      outputHash: contentHash('output text'),
      durationMs: 42,
      tokenCount: { input: 5, output: 7, total: 12 },
      cost: 0.001,
      qualityScore: 0.9,
      status: 'success',
      correlationId: 'corr-1',
      source: 'api',
    })
    expect(new Date(env.timestamp).getTime()).not.toBeNaN()
    expect(env.model).toBeUndefined()
  })

  it('honours source and model overrides', () => {
    const env = createTraceEnvelope({
      member: 'the-builder',
      input: 'i',
      output: 'o',
      durationMs: 1,
      tokenCount: { input: 0, output: 0, total: 0 },
      cost: 0,
      qualityScore: null,
      status: 'error',
      correlationId: 'corr-2',
      source: 'cli',
      model: 'llama-3',
    })

    expect(env.source).toBe('cli')
    expect(env.model).toBe('llama-3')
    expect(env.status).toBe('error')
  })
})
