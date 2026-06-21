import type { ISkill, SkillResult } from '../ISkill.js'
import type { ExecutionContext } from '../../core/ExecutionContext.js'

export class ExplainCodeSkill implements ISkill {
  name = 'explain_code'
  description = 'Explain what a piece of code does in natural language'
  inputSchema = {
    type: 'object',
    properties: {
      code: { type: 'string', description: 'Code to explain' },
      language: { type: 'string', description: 'Programming language (optional)' },
    },
    required: ['code'],
  }

  async execute(input: unknown, context: ExecutionContext): Promise<SkillResult> {
    const { code, language } = input as { code: string; language?: string }

    const languageHint = language ? ` ${language}` : ''
    const prompt = `Explain what the following${languageHint} code does in plain English. Be concise and focus on behavior, not implementation details.\n\n\`\`\`${language ?? ''}\n${code}\n\`\`\``

    try {
      const response = await context.llm.complete({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
      })
      return { success: true, output: response.content }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return { success: false, output: '', error: `explain_code failed: ${msg}` }
    }
  }
}
