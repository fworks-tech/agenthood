/**
 * src/members/MemberAgent.ts
 *
 * Concrete `BaseAgent` subclass for each Society member.
 * The system prompt is derived from the member's `SKILL.md` file at
 * runtime via `MemberRegistry`.
 */

import { BaseAgent } from '../agents/base/BaseAgent.ts'
import type { MemberSpec } from './types.ts'
import type { ExecutionContext } from '../core/ExecutionContext.ts'
import type { ITool } from '../tools/ITool.ts'
import type { ReActLoop } from '../reasoning/ReActLoop.ts'
import type { ToolRegistry } from '../tools/ToolRegistry.ts'
import type { ILLMProvider } from '../llm/ILLMProvider.ts'
import type { AgentRegistry } from '../core/AgentRegistry.ts'
import { ReadFileSkill } from '../tools/project/ReadFileSkill.ts'
import { WriteFileSkill } from '../tools/project/WriteFileSkill.ts'
import { WriteCodeSkill } from '../tools/code/WriteCodeSkill.ts'
import { SearchCodebaseSkill } from '../tools/code/SearchCodebaseSkill.ts'
import { ExplainCodeSkill } from '../tools/code/ExplainCodeSkill.ts'
import { RefactorSkill } from '../tools/code/RefactorSkill.ts'
import { PrSyncSkill } from '../tools/pr/PrSyncSkill.ts'
import { SubagentTaskSkill } from '../tools/core/SubagentTaskSkill.ts'

const TOOL_MAP: Record<string, new (...args: never[]) => ITool> = {
  'file.read': ReadFileSkill,
  'file.write': WriteFileSkill,
  'file.search': SearchCodebaseSkill,
  'code.grep': SearchCodebaseSkill,
  'code.write': WriteCodeSkill,
  'code.refactor': RefactorSkill,
  'code.explain': ExplainCodeSkill,
  'tasks.read': ExplainCodeSkill,
  'pr_sync': PrSyncSkill,
}

export class MemberAgent extends BaseAgent {
  role: string
  protected tools: ITool[]

  constructor(
    private spec: MemberSpec,
    llm: ILLMProvider,
    reasoningLoop: ReActLoop,
    toolRegistry: ToolRegistry,
    private agentRegistry?: AgentRegistry,
  ) {
    super(llm, reasoningLoop, toolRegistry)
    this.role = spec.name
    this.tools = this.buildTools()
  }

  private buildTools(): ITool[] {
    const tools: ITool[] = []

    for (const toolName of this.spec.tools) {
      const Ctor = TOOL_MAP[toolName]
      if (Ctor) {
        try {
          const instance = new Ctor() as ITool
          if (!tools.some((t) => t.name === instance.name)) {
            tools.push(instance)
          }
        } catch {
          // skip tools that fail to instantiate
        }
      }
    }

    if (this.agentRegistry && !tools.some((t) => t.name === 'delegate_task')) {
      try {
        tools.push(new SubagentTaskSkill(this.agentRegistry))
      } catch {
        // delegation not available
      }
    }

    if (tools.length === 0) {
      tools.push(new ReadFileSkill(), new WriteFileSkill())
    }

    return tools
  }

  protected async getSystemPrompt(context: ExecutionContext): Promise<string> {
    const conventions = await context.memory.project.getConventions()
    const archDecisions = await context.memory.project.getArchitecturalDecisions()

    const parts: string[] = [
      `You are **${this.spec.name}**, a Society Member.`,
      this.spec.description,
      '',
      '---',
      '',
    ]
    if (this.spec.systemPrompt) {
      parts.push(this.spec.systemPrompt)
    }
    parts.push(
      '',
      '## Project Context',
    )
    for (const c of conventions) {
      parts.push(`- Convention: ${c.name} = ${c.value}`)
    }
    for (const ad of archDecisions) {
      parts.push(`- ADR: ${ad}`)
    }

    if (context.skillsCatalog) {
      parts.push('', '## Available Skills', context.skillsCatalog)
    }

    return parts.join('\n')
  }
}
