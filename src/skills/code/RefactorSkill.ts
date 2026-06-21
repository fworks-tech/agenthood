import { readFile, writeFile, lstat, realpath } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { ISkill, SkillResult } from '../ISkill.js'
import type { ExecutionContext } from '../../core/ExecutionContext.js'

export class RefactorSkill implements ISkill {
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

  async execute(input: unknown, context: ExecutionContext): Promise<SkillResult> {
    const { path, goal } = input as { path: string; goal: string }
    const resolvedPath = resolve(context.project.localPath, path)

    if (!resolvedPath.startsWith(context.project.localPath)) {
      return { success: false, output: '', error: `Path traversal denied: "${path}"` }
    }

    try {
      const stats = await lstat(resolvedPath).catch(() => null)
      if (stats?.isSymbolicLink()) {
        const real = await realpath(resolvedPath)
        if (!real.startsWith(context.project.localPath)) {
          return { success: false, output: '', error: `Symlink traversal denied: "${path}"` }
        }
      }
    } catch {
      // lstat/realpath failure handled below
    }

    let original: string
    try {
      original = await readFile(resolvedPath, 'utf-8')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return { success: false, output: '', error: `Cannot read "${path}": ${msg}` }
    }

    const prompt = `Refactor the following code. Goal: ${goal}\n\nOutput only the refactored code — no explanations, no markdown fences.\n\n${original}`

    let refactored: string
    try {
      const response = await context.llm.complete({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
      })
      refactored = response.content
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return { success: false, output: '', error: `refactor LLM call failed: ${msg}` }
    }

    try {
      await writeFile(resolvedPath, refactored, 'utf-8')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return { success: false, output: '', error: `Cannot write "${path}": ${msg}` }
    }

    return { success: true, output: refactored }
  }
}
