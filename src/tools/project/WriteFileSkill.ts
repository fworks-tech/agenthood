import { writeFile, mkdir, lstat, realpath } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import type { ITool } from '../ITool.ts'
import type { ToolResult } from '../ITool.ts'
import type { ExecutionContext } from '../../core/ExecutionContext.ts'

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
    const resolvedPath = resolve(context.project.localPath, path)

    if (!resolvedPath.startsWith(context.project.localPath)) {
      return { success: false, output: '', error: `Path traversal denied: "${path}"` }
    }

    try {
      const stats = await lstat(resolvedPath).catch(() => null)
      if (stats?.isSymbolicLink()) {
        const real = await realpath(resolvedPath)
        if (!real.startsWith(context.project.localPath)) {
          return { success: false, output: '', error: `Symlink traversal denied: "${path}" -> "${real}"` }
        }
      }
    } catch {
      // lstat/realpath failed — proceed, mkdir/writeFile will surface real errors
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
