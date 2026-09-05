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

export function parseSkill(path: string): { front: Record<string, string>; body: string } {
  const lines = readFileSync(path, 'utf8').split('\n')
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
