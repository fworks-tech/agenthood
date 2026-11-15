import { readFile } from 'node:fs/promises'
import type { ITool } from '../ITool.ts'
import type { ToolResult } from '../ITool.ts'
import type { ExecutionContext } from '../../core/ExecutionContext.ts'
import { resolveInsideProject } from '../pathGuard.ts'

export class ReadFileSkill implements ITool {
  name = 'read_file'
  description = 'Read the contents of a file at the given path'
  inputSchema = {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Path to the file to read' },
    },
    required: ['path'],
  }

  async execute(input: unknown, context: ExecutionContext): Promise<ToolResult> {
    const { path } = input as { path: string }
    const resolved = await resolveInsideProject(context.project.localPath, path)
    if (!resolved.ok) return { success: false, output: '', error: resolved.error }

    try {
      const content = await readFile(resolved.path, 'utf-8')
      return { success: true, output: content }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return { success: false, output: '', error: `Cannot read file "${path}": ${msg}` }
    }
  }
}
