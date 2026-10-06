#!/usr/bin/env tsx
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { rawSpecs } from '../src/members/member-specs.ts'

const ROOT = fileURLToPath(new URL('..', import.meta.url))

function skillDescription(repoRoot: string, name: string): string {
  const text = readFileSync(join(repoRoot, 'skills', name, 'SKILL.md'), 'utf8')
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  const front = match?.[1] ?? ''
  const line = front.split('\n').find((l) => l.startsWith('description:')) ?? ''
  return line.replace(/^description:\s*/, '').trim()
}

function titleCase(name: string): string {
  return name
    .split('-')
    .map((w) => (w[0] ?? '').toUpperCase() + w.slice(1))
    .join(' ')
}

export function syncOpencodeAgents(repoRoot: string, outDir: string): string[] {
  mkdirSync(outDir, { recursive: true })
  const written: string[] = []
  for (const spec of rawSpecs) {
    const body =
      `---\ndescription: ${skillDescription(repoRoot, spec.name)}\nmode: subagent\n---\n\n` +
      `# ${titleCase(spec.name)}\n\nLoad the ${spec.name} skill and follow its process.\n`
    writeFileSync(join(outDir, `${spec.name}.md`), body)
    written.push(`${spec.name}.md`)
  }
  return written.sort()
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const out = process.argv[2] ?? join(ROOT, '.opencode', 'agents')
  const written = syncOpencodeAgents(ROOT, out)
  console.log(`synced ${written.length} member agents to ${out}`)
}
