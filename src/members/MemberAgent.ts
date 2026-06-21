/**
 * src/members/MemberAgent.ts
 *
 * Concrete `BaseAgent` subclass for each of the 14 Society members.
 * The system prompt is derived from the member's `SKILL.md` file at
 * runtime via `MemberRegistry`.
 */

import { BaseAgent } from '../agents/base/BaseAgent.ts'
import type { MemberSpec } from './types.ts'
import type { ExecutionContext } from '../core/ExecutionContext.ts'
import type { ISkill } from '../skills/ISkill.ts'
import type { ReActLoop } from '../reasoning/ReActLoop.ts'
import type { SkillRegistry } from '../skills/SkillRegistry.ts'
import type { ILLMProvider } from '../llm/ILLMProvider.ts'
import { ReadFileSkill } from '../skills/project/ReadFileSkill.ts'
import { WriteFileSkill } from '../skills/project/WriteFileSkill.ts'
import { SearchCodebaseSkill } from '../skills/code/SearchCodebaseSkill.ts'
import { ExplainCodeSkill } from '../skills/code/ExplainCodeSkill.ts'
import { PrSyncSkill } from '../skills/pr/PrSyncSkill.ts'

export class MemberAgent extends BaseAgent {
  role: string
  protected skills: ISkill[]

  constructor(
    private spec: MemberSpec,
    llm: ILLMProvider,
    reasoningLoop: ReActLoop,
    skillRegistry: SkillRegistry,
  ) {
    super(llm, reasoningLoop, skillRegistry)
    this.role = spec.name
    this.skills = [
      new ReadFileSkill(),
      new WriteFileSkill(),
      new SearchCodebaseSkill(),
      new ExplainCodeSkill(),
      new PrSyncSkill(),
    ]
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

    return parts.join('\n')
  }
}
