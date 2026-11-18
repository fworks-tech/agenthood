import { EventEmitter } from 'node:events'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export type FakeChild = EventEmitter & {
  stdout: EventEmitter
  stderr: EventEmitter
  kill: () => boolean
}

export const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

export function fakeChild(): FakeChild {
  const child = new EventEmitter() as FakeChild
  child.stdout = new EventEmitter()
  child.stderr = new EventEmitter()
  child.kill = () => true
  return child
}

export function fakePluginContext(directory = '/proj') {
  const skills: any[] = []
  const tools: any[] = []
  const hooks: Record<string, (event: any) => unknown> = {}
  const registration = { dispose: async () => {} }
  const ctx = {
    location: { directory },
    skill: {
      transform: async (callback: (editor: { add: (item: unknown) => void }) => void) => {
        callback({ add: (item) => skills.push(item) })
        return registration
      },
    },
    tool: {
      transform: async (callback: (editor: { add: (item: unknown) => void }) => void) => {
        callback({ add: (item) => tools.push(item) })
        return registration
      },
      hook: async (name: string, callback: (event: any) => unknown) => {
        hooks[name] = callback
        return registration
      },
    },
  }
  return { ctx: ctx as any, skills, tools, hooks }
}

export function parseSkill(path: string): { front: Record<string, string>; body: string } {
  const content = readFileSync(path, 'utf8')
  // Normalize line endings to handle both LF and CRLF
  const lines = content.replace(/\r\n/g, '\n').split('\n')
  if (lines[0] !== '---') throw new Error(`missing frontmatter in ${path}`)
  const end = lines.indexOf('---', 1)
  if (end < 2) throw new Error(`unterminated frontmatter in ${path}`)
  const front: Record<string, string> = {}
  for (const line of lines.slice(1, end)) {
    const idx = line.indexOf(':')
    if (idx > 0) front[line.slice(0, idx).trim()] = line.slice(idx + 1).trim()
  }
  return { front, body: lines.slice(end + 1).join('\n') }
}
