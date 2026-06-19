import { writeFile, mkdir } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import type { ISkill } from '../ISkill.js'
import type { SkillResult } from '../ISkill.js'
import type { ExecutionContext } from '../../core/ExecutionContext.js'

export class WriteFileSkill implements ISkill {
  name = 'write_file'
  description = 'Write content to a file, creating directories as needed'
  inputSchema = {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Path to the file to write' },
      content: { type: 'string', description: 'Content to write to the file' },
    },
    required: ['path', 'content'],
  }

  async execute(input: unknown, context: ExecutionContext): Promise<SkillResult> {
    const { path, content } = input as { path: string; content: string }
    const resolvedPath = resolve(context.project.localPath, path)

    if (!resolvedPath.startsWith(context.project.localPath)) {
      return { success: false, output: '', error: `Path traversal denied: "${path}"` }
    }

    try {
      await mkdir(dirname(resolvedPath), { recursive: true })
      await writeFile(resolvedPath, content, 'utf-8')
      return { success: true, output: `Written ${resolvedPath}` }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return { success: false, output: '', error: `Cannot write file "${path}": ${msg}` }
    }
  }
}
