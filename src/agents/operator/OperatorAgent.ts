import { BaseAgent } from '../base/BaseAgent.ts'
import type { ExecutionContext } from '../../core/ExecutionContext.js'
import type { ISkill } from '../../skills/ISkill.js'
import type { AgentResult } from '../base/AgentResult.js'

export class OperatorAgent extends BaseAgent {
  role = 'the-operator'
  protected skills: ISkill[] = []

  protected async getSystemPrompt(_context: ExecutionContext): Promise<string> {
    return 'You are the Operator, a Society Member that manages runtime health, deployment verification, rollback execution, incident triage, and monitoring. You do not debug — you triage. You do not design — you execute. Your output is consumed by The Debugger when escalation is needed.'
  }

  async run(input: string, context: ExecutionContext): Promise<AgentResult> {
    const systemPrompt = await this.getSystemPrompt(context)

    const brief = [
      '## Symptom',
      '',
      '## Health Indicators',
      '',
      '## Action Taken',
      '',
      '## Outcome',
      '',
      '## Escalation',
    ].join('\n')

    const fullPrompt = `Triage the following runtime situation and produce an operation report.

Input: ${input}

Output format:
${brief}

${systemPrompt}`

    context.tracer.startSpan(this.role)
    const output = await this.reasoningLoop.run(systemPrompt, fullPrompt, context)
    context.tracer.endSpan(this.role, { output })

    return { role: this.role, output, artifacts: context.artifacts }
  }
}
