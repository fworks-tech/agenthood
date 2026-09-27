#!/usr/bin/env tsx
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))

const STALE_PATTERNS = [
  'clear-implementation',
]

const LEGITIMATE_DIRS = [
  '.agenthood/decisions/',
]

function main(): void {
  const errors: string[] = []
  for (const pattern of STALE_PATTERNS) {
    const files = [
      join(ROOT, 'skills/the-steward/SKILL.md'),
      join(ROOT, 'skills/the-mediator/SKILL.md'),
      join(ROOT, 'AGENTS.md'),
    ]
    for (const file of files) {
      try {
        const content = readFileSync(file, 'utf8')
        if (content.includes(pattern)) {
          errors.push(`${pattern} found in ${file}`)
        }
      } catch {
        // skip missing files
      }
    }
  }

  if (errors.length > 0) {
    console.error('Stale patterns detected in generated artifacts:')
    for (const err of errors) {
      console.error(`  - ${err}`)
    }
    console.error('Regenerate agenthood-site artifacts from the published package, not a local build.')
    process.exit(1)
  }

  console.log('No stale patterns detected — generated artifacts are in sync.')
}

main()
