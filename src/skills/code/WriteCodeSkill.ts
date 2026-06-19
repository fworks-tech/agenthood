import type { ISkill } from '../ISkill.js'
import type { SkillResult } from '../ISkill.js'
import type { ExecutionContext } from '../../core/ExecutionContext.js'

export class WriteCodeSkill implements ISkill {
  name = 'write_code'
  description = 'Write code for a given specification following project conventions'
  inputSchema = {
    type: 'object',
    properties: {
      spec: { type: 'string', description: 'Specification of the code to write' },
      targetFile: { type: 'string', description: 'Target file path for the code' },
      language: { type: 'string', description: 'Programming language' },
    },
    required: ['spec', 'targetFile', 'language'],
  }

  async execute(input: unknown, context: ExecutionContext): Promise<SkillResult> {
    const { spec, targetFile, language } = input as {
      spec: string
      targetFile: string
      language: string
    }

    const conventions = await context.memory.project.getConventions()
    const prompt = context.prompts.build('write_code', {
      spec,
      targetFile,
      language,
      conventions: conventions.map(c => `${c.name}: ${c.value}`).join('\n'),
    })

    const response = await context.llm.complete({
      messages: [prompt, { role: 'user', content: spec }],
      temperature: 0.2,
    })

    return { success: true, output: response.content }
  }
}
