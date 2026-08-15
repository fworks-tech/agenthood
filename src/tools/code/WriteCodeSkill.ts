import type { ITool } from '../ITool.ts'
import type { ToolResult } from '../ITool.ts'
import type { ExecutionContext } from '../../core/ExecutionContext.ts'

export class WriteCodeSkill implements ITool {
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

  async execute(input: unknown, context: ExecutionContext): Promise<ToolResult> {
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
    if (context.usage && response.usage) {
      context.usage.promptTokens += response.usage.promptTokens ?? 0
      context.usage.completionTokens += response.usage.completionTokens ?? 0
      context.usage.totalTokens += response.usage.totalTokens ?? 0
    }

    return { success: true, output: response.content }
  }
}
