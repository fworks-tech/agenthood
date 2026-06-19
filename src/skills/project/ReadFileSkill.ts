import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { ISkill } from '../ISkill.js'
import type { SkillResult } from '../ISkill.js'
import type { ExecutionContext } from '../../core/ExecutionContext.js'

export class ReadFileSkill implements ISkill {
  name = 'read_file'
  description = 'Read the contents of a file at the given path'
  inputSchema = {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Path to the file to read' },
    },
    required: ['path'],
  }

  async execute(input: unknown, context: ExecutionContext): Promise<SkillResult> {
    const { path } = input as { path: string }
    const resolvedPath = resolve(context.project.localPath, path)

    if (!resolvedPath.startsWith(context.project.localPath)) {
      return { success: false, output: '', error: `Path traversal denied: "${path}"` }
    }

    try {
      const content = await readFile(resolvedPath, 'utf-8')
      return { success: true, output: content }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return { success: false, output: '', error: `Cannot read file "${path}": ${msg}` }
    }
  }
}
