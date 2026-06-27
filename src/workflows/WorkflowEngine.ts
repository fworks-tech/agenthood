import type { ExecutionContext } from '../core/ExecutionContext.js'
import type { IProtocol } from './protocols/IProtocol.js'
import type { WorkflowStep, WorkflowContext, WorkflowDefinition } from './types.js'
import { UserProtocol } from './protocols/UserProtocol.js'
import { AgentProtocol } from './protocols/AgentProtocol.js'
import { ToolProtocol } from './protocols/ToolProtocol.js'
import { WorkflowCheckpoint } from './WorkflowCheckpoint.js'

export class WorkflowEngine {
  private protocols: Map<string, IProtocol<unknown, unknown>> = new Map()
  private checkpoint: WorkflowCheckpoint

  constructor() {
    this.protocols.set('user-protocol', new UserProtocol())
    this.protocols.set('agent-protocol', new AgentProtocol())
    this.protocols.set('tool-protocol', new ToolProtocol())
    this.checkpoint = new WorkflowCheckpoint()
  }

  registerProtocol(name: string, protocol: IProtocol<unknown, unknown>): void {
    this.protocols.set(name, protocol)
  }

  async execute(definition: WorkflowDefinition, context: ExecutionContext): Promise<WorkflowContext> {
    const wfContext: WorkflowContext = {
      executionId: context.executionId,
      artifacts: new Map(),
      stepResults: new Map(),
      metadata: { workflowName: definition.name },
    }

    console.log(`\n[WorkflowEngine] Starting "${definition.name}" (${definition.steps.length} steps)\n`)

    for (const step of definition.steps) {
      if (step.type === 'agent' || step.type === 'tool') {
        const cpId = this.checkpoint.save(step.name, wfContext)
        console.log(`[WorkflowEngine] Checkpoint saved for step "${step.name}" (${cpId})`)
      }

      try {
        const result = await this.executeStep(step, context, wfContext)
        wfContext.stepResults.set(step.name, result)
      } catch (err) {
        if (step.type === 'human-in-loop') {
          const latest = this.checkpoint.getLatest()
          if (latest) {
            console.log(`[WorkflowEngine] Human rejected step "${step.name}" — restoring checkpoint "${latest.id}"`)
            this.checkpoint.restore(latest.id, wfContext)
            this.checkpoint.clear(latest.id)
          }
        }
        throw err
      }

      if (step.type === 'human-in-loop') {
        this.checkpoint.clearAll()
        console.log(`[WorkflowEngine] Human approved step "${step.name}" — checkpoints cleared`)
      }
    }

    return wfContext
  }

  private async executeStep(step: WorkflowStep, context: ExecutionContext, wfContext: WorkflowContext): Promise<unknown> {
    const protocol = step.protocol ?? this.resolveProtocol(step)

    if (!protocol) {
      console.log(`[WorkflowEngine] Step "${step.name}" has no protocol — skipping`)
      return null
    }

    const maxRetries = protocol.config.retryPolicy.maxRetries
    const backoffMs = protocol.config.retryPolicy.backoffMs

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await protocol.execute(step.input ?? {}, context)
        return result
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err))
        const action = protocol.onFailure(error, attempt)

        console.log(`[WorkflowEngine] Step "${step.name}" failed (attempt ${attempt + 1}/${maxRetries + 1}): ${error.message}`)

        if (action === 'abort') {
          throw error
        }
        if (action === 'escalate') {
          console.log(`[WorkflowEngine] Escalating failure for step "${step.name}"`)
          throw error
        }
        if (action === 'retry' && attempt < maxRetries) {
          const delay = backoffMs * Math.pow(2, attempt)
          console.log(`[WorkflowEngine] Retrying step "${step.name}" in ${delay}ms`)
          await new Promise((resolve) => setTimeout(resolve, delay))
        }
      }
    }

    throw new Error(`Step "${step.name}" failed after ${maxRetries + 1} attempts`)
  }

  private resolveProtocol(step: WorkflowStep): IProtocol<unknown, unknown> | undefined {
    switch (step.type) {
      case 'agent':
      case 'goal':
        return this.protocols.get('agent-protocol')
      case 'human-in-loop':
        return this.protocols.get('user-protocol')
      case 'tool':
        return this.protocols.get('tool-protocol')
      case 'parallel':
        return undefined
      default:
        return undefined
    }
  }
}
