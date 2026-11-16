/**
 * Skill discovery benchmark (#614). Cold measures a full parse of 50 skills;
 * warm measures the same scan with the metadata cache populated. The gate is
 * the issue's startup budget: cold discovery must stay under 500 ms.
 *
 *   npx tsx scripts/bench-skill-discovery.ts
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { SkillDiscovery } from '../src/skills/discovery/SkillDiscovery.ts'

const SKILL_COUNT = 50
const BUDGET_MS = 500

function makeProject(): string {
  const root = mkdtempSync(join(tmpdir(), 'agenthood-bench-'))
  for (let i = 0; i < SKILL_COUNT; i++) {
    const dir = join(root, '.agents', 'skills', `skill-${i}`)
    mkdirSync(dir, { recursive: true })
    const body = `# Skill ${i}\n\n${'Detail line for the benchmark.\n'.repeat(40)}`
    writeFileSync(
      join(dir, 'SKILL.md'),
      `---\nname: skill-${i}\ndescription: Benchmark skill ${i}\n---\n${body}`,
    )
  }
  return root
}

function measure(project: string): { ms: number; directories: number; skills: number; cacheHits: number } {
  const discovery = new SkillDiscovery(project)
  // Warnings are not part of load time, and console writes would dominate a
  // short scan: the benchmark measures parsing, not printing.
  const warn = console.warn
  console.warn = () => {}
  try {
    const started = performance.now()
    discovery.discover(project)
    const stats = discovery.lastStats()
    return {
      ms: performance.now() - started,
      directories: stats.directories,
      skills: stats.skills,
      cacheHits: stats.cacheHits,
    }
  } finally {
    console.warn = warn
  }
}

const project = makeProject()
try {
  const cold = measure(project)
  const warm = measure(project)
  const reduction = ((cold.ms - warm.ms) / cold.ms) * 100

  console.log(`skills: ${SKILL_COUNT}`)
  console.log(`cold: ${cold.ms.toFixed(1)} ms (directories ${cold.directories}, skills ${cold.skills})`)
  console.log(`warm: ${warm.ms.toFixed(1)} ms (cache hits ${warm.cacheHits})`)
  console.log(`reduction: ${reduction.toFixed(0)}%`)

  const problems: string[] = []
  if (cold.ms > BUDGET_MS) problems.push(`cold discovery ${cold.ms.toFixed(0)} ms exceeds ${BUDGET_MS} ms`)
  if (warm.cacheHits < SKILL_COUNT) problems.push(`warm run used the cache only ${warm.cacheHits} times`)
  if (warm.ms >= cold.ms) problems.push('warm discovery is not faster than cold')
  if (problems.length > 0) {
    for (const problem of problems) console.error(`FAIL: ${problem}`)
    process.exitCode = 1
  }
} finally {
  rmSync(project, { recursive: true, force: true })
}
