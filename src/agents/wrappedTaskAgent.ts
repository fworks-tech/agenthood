import { BaseAgent } from './base/BaseAgent.ts'
import { USER_QUERY_GUARD, wrapUserQuery } from './memberLore.ts'
import type { ExecutionContext } from '../core/ExecutionContext.ts'
import type { AgentResult } from './base/AgentResult.ts'

/** Render a list of `## `-headed sections as the shared output-format block. */
export function buildOutputFormat(headers: string[]): string {
  return headers.map((h) => `## ${h}`).join('\n\n')
}

/**
 * Shared skeleton for agents whose task is a single wrapped user query
 * rendered against a fixed output format (currently the Strategist and the
 * Operator). Input delimiters are stripped and re-wrapped so the guard in
 * the system prompt describes reality.
 */
export abstract class WrappedTaskAgent extends BaseAgent {
  protected abstract readonly taskIntro: string
  protected abstract readonly outputFormat: string
  protected readonly guardSuffix: string = ''

  async run(input: string, context: ExecutionContext): Promise<AgentResult> {
    const prepared = `${this.taskIntro}\n\n${wrapUserQuery(input)}\n\nOutput format:\n${this.outputFormat}\n`
    return super.run(prepared, context)
  }

  protected buildSystemPrompt(identity: string): string {
    return [identity, USER_QUERY_GUARD + this.guardSuffix].join('\n')
  }
}
