import { readdirSync, watch as fsWatch } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { ITool } from './ITool.ts'
import type { ToolSchema } from '../llm/types.ts'

export class ToolNotFoundError extends Error {
  constructor(toolName: string) {
    super(`Tool not found: "${toolName}"`)
    this.name = 'ToolNotFoundError'
  }
}

function isToolShape(module: unknown): module is ITool {
  if (typeof module !== 'object' || module === null) return false
  const s = module as Record<string, unknown>
  return (
    typeof s.name === 'string' &&
    typeof s.description === 'string' &&
    typeof s.inputSchema === 'object' &&
    typeof s.execute === 'function'
  )
}

export class ToolRegistry {
  private tools = new Map<string, ITool>()
  private watchers = new Set<() => void>()
  private discoveredDirs = new Set<string>()

  register(tool: ITool): void {
    this.tools.set(tool.name, tool)
  }

  get(name: string): ITool {
    const tool = this.tools.get(name)
    if (!tool) {
      throw new ToolNotFoundError(name)
    }
    return tool
  }

  getSchemas(): ToolSchema[] {
    const schemas: ToolSchema[] = []
    for (const tool of this.tools.values()) {
      schemas.push({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      })
    }
    return schemas
  }

  has(name: string): boolean {
    return this.tools.has(name)
  }

  list(): ITool[] {
    return Array.from(this.tools.values())
  }

  async discover(dir: string): Promise<ITool[]> {
    const found: ITool[] = []
    const entries = readdirSync(dir, { withFileTypes: true })

    const files: string[] = []
    for (const entry of entries) {
      const fullPath = join(dir, entry.name)
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        const nested = await this.discover(fullPath)
        found.push(...nested)
      } else if (entry.isFile() && entry.name.endsWith('.js')) {
        files.push(fullPath)
      }
    }

    for (const filePath of files) {
      try {
        const mod = await import(pathToFileURL(filePath).href)
        for (const key of Object.keys(mod)) {
          const exported = mod[key]
          if (isToolShape(exported)) {
            this.register(exported)
            found.push(exported)
          }
        }
      } catch {
        // Silently skip files that fail to import (e.g. non-skill modules)
      }
    }

    this.discoveredDirs.add(dir)
    return found
  }

  async watch(dir: string): Promise<void> {
    if (this.discoveredDirs.has(dir)) return

    await this.discover(dir)
    this.discoveredDirs.add(dir)

    const watcher = fsWatch(dir, { recursive: true }, async (eventType, filename) => {
      if (filename && (filename.endsWith('.js') || filename.endsWith('.ts'))) {
        const key = filename.replace(/\.(js|ts)$/, '').replace(/\\/g, '/').split('/').pop()!
        if (this.has(key)) {
          // Re-discover to pick up changes
          await this.discover(dir)
        }
      }
    })

    const cleanup = () => {
      watcher.close()
    }
    this.watchers.add(cleanup)
  }

  close(): void {
    for (const cleanup of this.watchers) {
      cleanup()
    }
    this.watchers.clear()
  }
}
