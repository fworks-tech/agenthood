import { describe, it, expect, vi } from 'vitest'
import { OperatorAgent } from '../../../../src/agents/operator/OperatorAgent.js'

describe('OperatorAgent', () => {
  it('has role the-operator', () => {
    const agent = new OperatorAgent({} as any, {} as any, {} as any)
    expect(agent.role).toBe('the-operator')
  })

  it('generates system prompt', async () => {
    const agent = new OperatorAgent({} as any, {} as any, {} as any)
    const prompt = await agent.getSystemPrompt({} as any)
    expect(prompt).toContain('Operator')
    expect(prompt).toContain('rollback')
  })

  it('run method includes brief sections in prompt', async () => {
    const mockLoop = { run: vi.fn().mockResolvedValue('ok') }
    const agent = new OperatorAgent({} as any, mockLoop as any, {} as any)
    const context = { tracer: { startSpan: vi.fn(), endSpan: vi.fn() }, artifacts: {} } as any

    const result = await agent.run('service is down', context)

    expect(mockLoop.run).toHaveBeenCalled()
    const promptArg = mockLoop.run.mock.calls[0][1] as string
    expect(promptArg).toContain('## Symptom')
    expect(promptArg).toContain('## Health Indicators')
    expect(promptArg).toContain('## Action Taken')
    expect(promptArg).toContain('## Outcome')
    expect(promptArg).toContain('## Escalation')
    expect(result.role).toBe('the-operator')
    expect(result.output).toBe('ok')
  })
})
