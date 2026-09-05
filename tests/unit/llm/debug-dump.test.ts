import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { existsSync, readFileSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { writeDebugDump } from '../../../src/llm/debug-dump.ts'

const TEST_DIR = join(import.meta.dirname ?? '.', '.test-debug-dump')

describe('writeDebugDump', () => {
  beforeEach(() => {
    mkdirSync(TEST_DIR, { recursive: true })
  })

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true })
  })

  it('creates a debug JSON file in .agenthood/debug/', () => {
    writeDebugDump(
      TEST_DIR,
      'corr-123',
      'groq',
      'llama-3.3-70b-versatile',
      { messages: [{ role: 'user', content: 'hello' }] },
      { content: 'hi there', usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 }, model: 'llama-3.3-70b-versatile' },
      123,
    )

    const debugDir = join(TEST_DIR, '.agenthood', 'debug')
    expect(existsSync(debugDir)).toBe(true)

    const files = require('node:fs').readdirSync(debugDir)
    expect(files.length).toBe(1)
    expect(files[0]).toMatch(/\.json$/)

    const data = JSON.parse(readFileSync(join(debugDir, files[0]), 'utf-8'))
    expect(data.correlationId).toBe('corr-123')
    expect(data.provider).toBe('groq')
    expect(data.model).toBe('llama-3.3-70b-versatile')
    expect(data.request.messages[0]).toEqual({ role: 'user', content: 'hello' })
    expect(data.response.content).toBe('hi there')
    expect(data.durationMs).toBe(123)
  })

  it('redacts API keys from request content', () => {
    writeDebugDump(
      TEST_DIR,
      undefined,
      'openai',
      'gpt-4',
      { messages: [{ role: 'user', content: 'api_key=sk-abc123secret' }] },
      { content: 'ok', usage: { promptTokens: 5, completionTokens: 2, totalTokens: 7 }, model: 'gpt-4' },
      50,
    )

    const debugDir = join(TEST_DIR, '.agenthood', 'debug')
    const files = require('node:fs').readdirSync(debugDir)
    const data = JSON.parse(readFileSync(join(debugDir, files[0]), 'utf-8'))
    expect(data.request.messages[0].content).not.toContain('sk-abc123secret')
  })
})
