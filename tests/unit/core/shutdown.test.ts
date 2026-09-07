import { describe, it, expect, afterEach } from 'vitest'
import { requestShutdown, isShutdownRequested, resetShutdown } from '../../../src/core/shutdown.ts'

describe('shutdown signal', () => {
  afterEach(() => resetShutdown())

  it('is clear by default, set by request, cleared by reset', () => {
    resetShutdown()
    expect(isShutdownRequested()).toBe(false)
    requestShutdown()
    expect(isShutdownRequested()).toBe(true)
    resetShutdown()
    expect(isShutdownRequested()).toBe(false)
  })
})
