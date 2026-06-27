import { describe, it, expect } from 'vitest'
import { UserProtocol } from '../../../src/workflows/protocols/UserProtocol.js'
import { AgentProtocol } from '../../../src/workflows/protocols/AgentProtocol.js'
import { ToolProtocol } from '../../../src/workflows/protocols/ToolProtocol.js'

describe('UserProtocol', () => {
  it('returns escalate on failure', () => {
    const protocol = new UserProtocol()
    const action = protocol.onFailure(new Error('timeout'), 0)
    expect(action).toBe('escalate')
  })

  it('uses default config when no overrides provided', () => {
    const protocol = new UserProtocol()
    expect(protocol.config.retryPolicy.maxRetries).toBe(2)
    expect(protocol.config.timeoutMs).toBe(30000)
  })

  it('accepts partial config overrides', () => {
    const protocol = new UserProtocol({ timeoutMs: 5000 })
    expect(protocol.config.timeoutMs).toBe(5000)
    expect(protocol.config.retryPolicy.maxRetries).toBe(2)
  })
})

describe('AgentProtocol', () => {
  it('returns retry on first failure', () => {
    const protocol = new AgentProtocol()
    const action = protocol.onFailure(new Error('service unavailable'), 0)
    expect(action).toBe('retry')
  })

  it('returns abort after maxRetries exceeded', () => {
    const protocol = new AgentProtocol()
    const action = protocol.onFailure(new Error('service unavailable'), 2)
    expect(action).toBe('abort')
  })

  it('returns abort on attempt beyond maxRetries', () => {
    const protocol = new AgentProtocol()
    const action = protocol.onFailure(new Error('service unavailable'), 5)
    expect(action).toBe('abort')
  })
})

describe('ToolProtocol', () => {
  it('returns abort on failure', () => {
    const protocol = new ToolProtocol()
    const action = protocol.onFailure(new Error('timeout'), 1)
    expect(action).toBe('abort')
  })

  it('uses default config when no overrides provided', () => {
    const protocol = new ToolProtocol()
    expect(protocol.config.retryPolicy.maxRetries).toBe(1)
    expect(protocol.config.timeoutMs).toBe(30000)
  })
})
