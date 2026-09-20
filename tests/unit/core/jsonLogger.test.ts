import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setJsonMode, isJsonMode, logOutput } from '../../../src/core/jsonLogger.ts'

describe('jsonLogger', () => {
  beforeEach(() => {
    setJsonMode(false)
  })

  afterEach(() => {
    setJsonMode(false)
    vi.restoreAllMocks()
  })

  it('defaults to non-JSON mode', () => {
    expect(isJsonMode()).toBe(false)
  })

  it('setJsonMode enables JSON mode', () => {
    setJsonMode(true)
    expect(isJsonMode()).toBe(true)
  })

  it('logOutput is a no-op in non-JSON mode', () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {})
    logOutput({ test: 'data' })
    expect(spy).not.toHaveBeenCalled()
  })

  it('logOutput does not throw in JSON mode', () => {
    setJsonMode(true)
    expect(() => logOutput({ test: 'data' })).not.toThrow()
  })
})
