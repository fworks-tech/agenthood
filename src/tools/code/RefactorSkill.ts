import { readFile, writeFile } from 'node:fs/promises'
import type { ITool, ToolResult } from '../ITool.ts'
import type { ExecutionContext } from '../../core/ExecutionContext.ts'
import { resolveInsideProject } from '../pathGuard.ts'

export class RefactorSkill implements ITool {
  name = 'refactor'
  description = 'Refactor code in a file for better structure, readability, or performance'
  inputSchema = {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Path to the file to refactor' },
      goal: { type: 'string', description: 'Refactoring goal and description' },
    },
    required: ['path', 'goal'],
  }

  async execute(input: unknown, context: ExecutionContext): Promise<ToolResult> {
    const { path, goal } = input as { path: string; goal: string }
    const resolved = await resolveInsideProject(context.project.localPath, path)
    if (!resolved.ok) return { success: false, output: '', error: resolved.error }

    let original: string
    try {
      original = await readFile(resolved.path, 'utf-8')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return { success: false, output: '', error: `Cannot read "${path}": ${msg}` }
    }

    const prompt = `Refactor the following code. Goal: ${goal}\n\nOutput only the refactored code; no explanations, no markdown fences.\n\n${original}`

    let refactored: string
    try {
      const response = await context.llm.complete({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
      })
      if (context.usage && response.usage) {
        context.usage.promptTokens += response.usage.promptTokens ?? 0
        context.usage.completionTokens += response.usage.completionTokens ?? 0
        context.usage.totalTokens += response.usage.totalTokens ?? 0
      }
      refactored = response.content
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return { success: false, output: '', error: `refactor LLM call failed: ${msg}` }
    }

    try {
      await writeFile(resolved.path, refactored, 'utf-8')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return { success: false, output: '', error: `Cannot write "${path}": ${msg}` }
    }

    return { success: true, output: refactored }
  }
}
