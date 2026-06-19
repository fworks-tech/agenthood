import type { ISkill } from '../ISkill.js'
import type { SkillResult } from '../ISkill.js'
import type { ExecutionContext } from '../../core/ExecutionContext.js'

export class ExplainCodeSkill implements ISkill {
  name = 'explain_code'
  description = 'Explain what a piece of code does in natural language'
  inputSchema = {
    type: 'object',
    properties: {
      code: { type: 'string', description: 'Code to explain' },
      language: { type: 'string', description: 'Programming language' },
    },
    required: ['code'],
  }

  async execute(input: unknown, context: ExecutionContext): Promise<SkillResult> {
    void input; void context
    return { success: true, output: 'stub' }
  }
}
