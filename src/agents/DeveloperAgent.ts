import { BaseAgent } from './base/BaseAgent.js'
import { WriteCodeSkill } from '../skills/code/WriteCodeSkill.js'
import { RefactorSkill } from '../skills/code/RefactorSkill.js'
import { ExplainCodeSkill } from '../skills/code/ExplainCodeSkill.js'
import { SearchCodebaseSkill } from '../skills/code/SearchCodebaseSkill.js'
import { ReadFileSkill } from '../skills/project/ReadFileSkill.js'
import { WriteFileSkill } from '../skills/project/WriteFileSkill.js'
import type { ISkill } from '../skills/ISkill.js'
import type { ExecutionContext } from '../core/ExecutionContext.js'

export class DeveloperAgent extends BaseAgent {
  role = 'developer'
  protected skills: ISkill[] = [
    new WriteCodeSkill(),
    new RefactorSkill(),
    new ReadFileSkill(),
    new WriteFileSkill(),
    new SearchCodebaseSkill(),
    new ExplainCodeSkill(),
  ]

  protected async getSystemPrompt(context: ExecutionContext): Promise<string> {
    const conventions = await context.memory.project.getConventions()
    const archDecisions = await context.memory.project.getArchitecturalDecisions()
    const stack = context.project.stack

    return context.prompts.build('developer.system', {
      conventions: conventions.map(c => `${c.name}: ${c.value}`).join('\n'),
      archDecisions: archDecisions.join('\n'),
      stack: JSON.stringify(stack),
    }).content
  }
}
