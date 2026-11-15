import { writeFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { ITool } from '../ITool.ts'
import type { ToolResult } from '../ITool.ts'
import type { ExecutionContext } from '../../core/ExecutionContext.ts'
import { resolveInsideProject } from '../pathGuard.ts'

export class WriteFileSkill implements ITool {
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

  async execute(input: unknown, context: ExecutionContext): Promise<ToolResult> {
    const { path, content } = input as { path: string; content: string }
    const resolved = await resolveInsideProject(context.project.localPath, path)
    if (!resolved.ok) return { success: false, output: '', error: resolved.error }

    try {
      await mkdir(dirname(resolved.path), { recursive: true })
      await writeFile(resolved.path, content, 'utf-8')
      return { success: true, output: `Written ${resolved.path}` }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return { success: false, output: '', error: `Cannot write file "${path}": ${msg}` }
    }
  }
}
