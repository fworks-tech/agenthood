import { BaseAgent } from '../base/BaseAgent.ts'
import type { ExecutionContext } from '../../core/ExecutionContext.js'
import type { ISkill } from '../../skills/ISkill.js'
import type { AgentResult } from '../base/AgentResult.js'

export class StrategistAgent extends BaseAgent {
  role = 'the-strategist'
  protected skills: ISkill[] = []

  protected async getSystemPrompt(_context: ExecutionContext): Promise<string> {
    return 'You are the Strategist, a Society Member that translates ambiguous goals into structured problem statements. You never write code, run commands, or edit files. Your output is consumed by The Architect.'
  }

  async run(input: string, context: ExecutionContext): Promise<AgentResult> {
    const systemPrompt = await this.getSystemPrompt(context)

    const brief = [
      '## Problem Statement',
      '',
      '## Success Criteria',
      '',
      '## Ranked Priorities',
      '',
      '## Risks and Constraints',
      '',
      '## Suggested Handoff',
    ].join('\n')

    const fullPrompt = `Transform the following goal into a structured brief.

Goal: ${input}

Output format:
${brief}

${systemPrompt}`

    context.tracer.startSpan(this.role)
    const output = await this.reasoningLoop.run(systemPrompt, fullPrompt, context)
    context.tracer.endSpan(this.role, { output })

    return { role: this.role, output, artifacts: context.artifacts }
  }
}
