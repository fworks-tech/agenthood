import type { ISkill } from '../ISkill.js'
import type { SkillResult } from '../ISkill.js'
import type { ExecutionContext } from '../../core/ExecutionContext.js'

export class SearchCodebaseSkill implements ISkill {
  name = 'search_codebase'
  description = 'Search the codebase for symbols, patterns, or files'
  inputSchema = {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query (file name, symbol, or content pattern)' },
    },
    required: ['query'],
  }

  async execute(input: unknown, context: ExecutionContext): Promise<SkillResult> {
    void input; void context
    return { success: true, output: 'stub' }
  }
}
