import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SubagentTaskSkill, subagentTaskInputSchema, DELEGATED_TASK_LABEL } from '../../../src/tools/core/SubagentTaskSkill.ts'
import { AgentRegistry } from '../../../src/core/AgentRegistry.ts'
import type { BaseAgent } from '../../../src/agents/base/BaseAgent.ts'
import type { ExecutionContext } from '../../../src/core/ExecutionContext.ts'
import { createTestContext } from '../../helpers/testContext.ts'
import { ReviewerAgent } from '../../../src/agents/ReviewerAgent.ts'
import { ReActLoop } from '../../../src/reasoning/ReActLoop.ts'
import { ToolRegistry } from '../../../src/tools/ToolRegistry.ts'
import { ReadFileSkill } from '../../../src/tools/project/ReadFileSkill.ts'
import { WriteFileSkill } from '../../../src/tools/project/WriteFileSkill.ts'
import { WriteCodeSkill } from '../../../src/tools/code/WriteCodeSkill.ts'
import { createMockLLM, createMockAgent } from '../../helpers/agentFixtures.ts'

describe('SubagentTaskSkill', () => {
  let registry: AgentRegistry
  let skill: SubagentTaskSkill
  let context: ExecutionContext

  beforeEach(() => {
    registry = new AgentRegistry()
    skill = new SubagentTaskSkill(registry)
    context = createTestContext()
  })

  describe('basic properties', () => {
    it('has correct name', () => {
      expect(skill.name).toBe('delegate_task')
    })

    it('has descriptive description', () => {
      expect(skill.description.toLowerCase()).toContain('delegate')
      expect(skill.description.toLowerCase()).toContain('subagent')
    })

    it('has proper input schema', () => {
      expect(skill.inputSchema).toBe(subagentTaskInputSchema)
    })

    it('labels delegated content as untrusted and forbids propagation', () => {
      expect(DELEGATED_TASK_LABEL).toContain('untrusted data')
      expect(DELEGATED_TASK_LABEL).toMatch(/never (adopt|propagate|forward)/i)
    })
  })

  describe('execute() - success cases', () => {
    it('delegates task to registered agent successfully', async () => {
      const reviewerAgent = createMockAgent('reviewer', 'Code looks good!')
      registry.register(reviewerAgent)

      const result = await skill.execute(
        { role: 'reviewer', task: 'Review the login function' },
        context,
      )

      expect(result.success).toBe(true)
      expect(result.output).toBe('Code looks good!')
      expect(reviewerAgent.run).toHaveBeenCalledWith(
        `<delegated_task>\n${DELEGATED_TASK_LABEL}\nReview the login function\n</delegated_task>`,
        context,
      )
    })

    it('passes artifacts from subagent back to parent', async () => {
      const testerAgent = {
        role: 'tester',
        run: vi.fn().mockResolvedValue({
          role: 'tester',
          output: 'Tests written',
          artifacts: [
            {
              type: 'test' as const,
              path: 'test.spec.ts',
              content: 'test code',
              createdBy: 'tester',
            },
          ],
        }),
      } as unknown as BaseAgent

      registry.register(testerAgent)

      const result = await skill.execute(
        { role: 'tester', task: 'Write tests for auth module' },
        context,
      )

      expect(result.success).toBe(true)
      expect(result.artifacts).toHaveLength(1)
      expect(result.artifacts?.[0].path).toBe('test.spec.ts')
    })

    it('works with different agent types', async () => {
      const developer = createMockAgent('developer', 'Code implemented')
      const auditor = createMockAgent('auditor', 'Security scan complete')

      registry.register(developer)
      registry.register(auditor)

      const devResult = await skill.execute(
        { role: 'developer', task: 'Implement login' },
        context,
      )
      const auditResult = await skill.execute(
        { role: 'auditor', task: 'Check for vulnerabilities' },
        context,
      )

      expect(devResult.success).toBe(true)
      expect(devResult.output).toBe('Code implemented')
      expect(auditResult.success).toBe(true)
      expect(auditResult.output).toBe('Security scan complete')
    })

    it('awaits agent execution before returning', async () => {
      let executed = false
      const slowAgent = {
        role: 'slow',
        run: vi.fn().mockImplementation(async () => {
          await new Promise((resolve) => setTimeout(resolve, 10))
          executed = true
          return { role: 'slow', output: 'done', artifacts: [] }
        }),
      } as unknown as BaseAgent

      registry.register(slowAgent)

      const result = await skill.execute(
        { role: 'slow', task: 'slow task' },
        context,
      )

      expect(executed).toBe(true)
      expect(result.success).toBe(true)
    })
  })

  describe('execute() - error cases', () => {
    it('returns error when agent role not found', async () => {
      registry.register(createMockAgent('developer'))
      registry.register(createMockAgent('reviewer'))

      const result = await skill.execute(
        { role: 'nonexistent', task: 'some task' },
        context,
      )

      expect(result.success).toBe(false)
      expect(result.output).toBe('')
      expect(result.error).toContain('No agent found for role "nonexistent"')
    })

    it('does not enumerate registered roles in the error message', async () => {
      registry.register(createMockAgent('developer'))
      registry.register(createMockAgent('reviewer'))
      registry.register(createMockAgent('tester'))

      const result = await skill.execute(
        { role: 'invalid', task: 'task' },
        context,
      )

      expect(result.error).toContain('No agent found for role "invalid"')
      expect(result.error).not.toContain('developer')
      expect(result.error).not.toContain('reviewer')
      expect(result.error).not.toContain('tester')
    })

    it('handles subagent execution failure gracefully', async () => {
      const failingAgent = {
        role: 'failing',
        run: vi.fn().mockRejectedValue(new Error('Agent crashed')),
      } as unknown as BaseAgent

      registry.register(failingAgent)

      const result = await skill.execute(
        { role: 'failing', task: 'task' },
        context,
      )

      expect(result.success).toBe(false)
      expect(result.output).toBe('')
      expect(result.error).toBe('Subagent failed: Agent crashed')
    })

    it('handles non-Error exceptions from subagent', async () => {
      const failingAgent = {
        role: 'failing',
        run: vi.fn().mockRejectedValue('string error'),
      } as unknown as BaseAgent

      registry.register(failingAgent)

      const result = await skill.execute(
        { role: 'failing', task: 'task' },
        context,
      )

      expect(result.success).toBe(false)
      expect(result.error).toBe('Subagent failed: string error')
    })

    it('returns empty artifacts array on failure', async () => {
      const result = await skill.execute(
        { role: 'nonexistent', task: 'task' },
        context,
      )

      expect(result.success).toBe(false)
      expect(result.artifacts).toBeUndefined()
    })
  })

  describe('context sharing', () => {
    it('passes same ExecutionContext to subagent', async () => {
      const agent = createMockAgent('agent')
      registry.register(agent)

      await skill.execute({ role: 'agent', task: 'task' }, context)

      expect(agent.run).toHaveBeenCalledWith(expect.any(String), context)
      expect(agent.run).toHaveBeenCalledWith(expect.stringContaining('<delegated_task>'), context)
    })

    it('allows subagent to access parent execution ID', async () => {
      const agent = {
        role: 'agent',
        run: vi
          .fn()
          .mockImplementation(async (task: string, ctx: ExecutionContext) => {
            expect(ctx.executionId).toBe(context.executionId)
            return { role: 'agent', output: 'ok', artifacts: [] }
          }),
      } as unknown as BaseAgent

      registry.register(agent)

      await skill.execute({ role: 'agent', task: 'task' }, context)

      expect(agent.run).toHaveBeenCalled()
    })
  })

  describe('tool isolation', () => {
    it('keeps a delegated subagent on its read-only tool surface', async () => {
      // caller side: a broad, write-capable registry
      const callerReg = new ToolRegistry()
      callerReg.register(new WriteFileSkill())
      callerReg.register(new WriteCodeSkill())

      // subagent side: a restricted reviewer with its own registry + loop,
      // mirroring ApplicationContext.setupAgents (one ToolRegistry per agent)
      const llm = createMockLLM()
      const reviewerReg = new ToolRegistry()
      const reviewer = new ReviewerAgent(llm, new ReActLoop(llm, reviewerReg), reviewerReg)
      reviewerReg.register(new ReadFileSkill())

      const agents = new AgentRegistry()
      agents.register(reviewer)
      const delegated = new SubagentTaskSkill(agents, { allowedRoles: ['reviewer'] })

      const result = await delegated.execute(
        { role: 'reviewer', task: 'review x' },
        createTestContext(),
      )

      expect(result.success).toBe(true)
      expect(callerReg.getSchemas().map((s) => s.name)).toEqual(
        expect.arrayContaining(['write_file', 'write_code']),
      )
      // the delegated reviewer's surface is its own — caller tools never leak in
      expect(reviewerReg.getSchemas().map((s) => s.name)).toEqual(['read_file'])
    })
  })

  describe('edge cases', () => {
    it('handles empty agent registry', async () => {
      const result = await skill.execute(
        { role: 'any', task: 'task' },
        context,
      )

      expect(result.success).toBe(false)
      expect(result.error).toContain('No agent found for role "any"')
    })

    it('handles agent returning empty output', async () => {
      const agent = createMockAgent('agent', '')
      registry.register(agent)

      const result = await skill.execute(
        { role: 'agent', task: 'task' },
        context,
      )

      expect(result.success).toBe(true)
      expect(result.output).toBe('')
    })

    it('handles task with special characters', async () => {
      const agent = createMockAgent('agent')
      registry.register(agent)

      const specialTask = 'Review code with "quotes" and \n newlines'
      await skill.execute({ role: 'agent', task: specialTask }, context)

      expect(agent.run).toHaveBeenCalledWith(expect.stringContaining(specialTask), context)
    })

    it('handles role name with spaces (if registry allows)', async () => {
      const agent = createMockAgent('senior developer')
      registry.register(agent)

      const result = await skill.execute(
        { role: 'senior developer', task: 'task' },
        context,
      )

      expect(result.success).toBe(true)
    })
  })
})
describe('SubagentTaskSkill skill delegation and isolation (#534, #612)', () => {
  const manifest = {
    name: 'review',
    description: 'review skill',
    tier: 'official' as const,
    location: '/skills/review/SKILL.md',
    directory: '/skills/review',
    body: 'REVIEW BODY',
    resources: [],
  }

  it('rejects a skill that was never discovered', async () => {
    const registry = new AgentRegistry()
    const agent = createMockAgent('reviewer', 'should not run')
    registry.register(agent)
    const tool = new SubagentTaskSkill(registry)

    const result = await tool.execute({ role: 'reviewer', task: 'go', skill: 'missing' }, createTestContext())

    expect(result.success).toBe(false)
    expect(result.error).toContain('not discovered')
    expect(agent.run).not.toHaveBeenCalled()
  })

  it('injects the named skill into the delegated task', async () => {
    const registry = new AgentRegistry()
    const agent = createMockAgent('reviewer', 'done')
    registry.register(agent)
    const tool = new SubagentTaskSkill(registry)
    const context = createTestContext()
    context.skillManifests = new Map([['review', manifest]])

    const result = await tool.execute({ role: 'reviewer', task: 'audit it', skill: 'review' }, context)

    const delegated = vi.mocked(agent.run).mock.calls[0][0] as string
    expect(result.success).toBe(true)
    expect(delegated).toContain('[SKILL_ACTIVATION]')
    expect(delegated).toContain('REVIEW BODY')
    expect(delegated).toContain('audit it')
  })

  it('partitions artifacts and the activated-skill scope under full isolation', async () => {
    const registry = new AgentRegistry()
    const seen: { artifacts: unknown[]; skills: string[] } = { artifacts: [], skills: [] }
    const loop = { activatedSkills: new Set(['caller-skill']) }
    const agent = {
      role: 'reviewer',
      run: vi.fn(async (_task: string, ctx: ExecutionContext) => {
        seen.artifacts = ctx.artifacts
        seen.skills = [...loop.activatedSkills]
        loop.activatedSkills.add('subagent-skill')
        return { role: 'reviewer', output: 'done', artifacts: [] }
      }),
    } as unknown as BaseAgent
    registry.register(agent)
    const tool = new SubagentTaskSkill(registry, { loop })
    const context = createTestContext()
    context.artifacts = [{ type: 'file', path: 'parent.txt', createdBy: 'parent' }] as never

    const result = await tool.execute({ role: 'reviewer', task: 'audit', isolation: 'full' }, context)

    expect(result.success).toBe(true)
    expect(seen.skills).toEqual([])
    expect(seen.artifacts).not.toBe(context.artifacts)
    expect(seen.artifacts).toEqual([])
    expect([...loop.activatedSkills]).toEqual(['caller-skill'])
  })

  it('leaves the calling context and skill scope intact by default', async () => {
    const registry = new AgentRegistry()
    const loop = { activatedSkills: new Set(['caller-skill']) }
    let seenContext: ExecutionContext | undefined
    let seenSkills: string[] = []
    const agent = {
      role: 'reviewer',
      run: vi.fn(async (_task: string, ctx: ExecutionContext) => {
        seenContext = ctx
        seenSkills = [...loop.activatedSkills]
        return { role: 'reviewer', output: 'done', artifacts: [] }
      }),
    } as unknown as BaseAgent
    registry.register(agent)
    const tool = new SubagentTaskSkill(registry, { loop })
    const context = createTestContext()

    await tool.execute({ role: 'reviewer', task: 'audit' }, context)

    expect(seenContext).toBe(context)
    expect(seenSkills).toEqual(['caller-skill'])
  })
})
