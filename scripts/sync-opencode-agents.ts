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

const LIVE_AGENT = `---
description: Run the Agenthood Society end-to-end: orchestrate member subagents in parallel with a Redis audit trail. Start here for any Agenthood task.
mode: primary
permission:
  task:
    'the-*': allow
    '*': deny
  skill:
    'the-*': allow
  edit: allow
  bash: allow
---

# Agenthood Live

Autonomous multi-agent orchestrator. Only the-* members route and sequence;
infra skills appear exclusively as task tools, never as chain nodes.

## Loop

1. CLASSIFY intent via mediator (confidence cascade, routing record).
2. PLAN the member sequence; fan out independent members in parallel via the
   task tool (one member per call, exact return shape, depth <= 2).
3. COLLECT returns, then GATE: reviewer zero [blocking], doorman pass,
   tests and build green.
4. APPROVE fans out no further — done. REVISE re-runs (max 3 rounds; round 2
   still [blocking] routes to architect for a rewrite). ESCALATE via the
   question tool, then abort — never auto-merge past a standing block.
5. Termination is participants plus mandatory gates; non-participants abstain.

## Audit

Persist every step to the .agenthood trail (routing, decisions, provenance);
mirror to Redis when configured. Never print secrets.
`

export function syncLiveAgent(outDir: string): string {
  mkdirSync(outDir, { recursive: true })
  writeFileSync(join(outDir, 'agenthood-live.md'), LIVE_AGENT)
  return 'agenthood-live.md'
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const out = process.argv[2] ?? join(ROOT, '.opencode', 'agents')
  const written = syncOpencodeAgents(ROOT, out)
  written.push(syncLiveAgent(out))
  console.log(`synced ${written.length} agents to ${out}`)
}
