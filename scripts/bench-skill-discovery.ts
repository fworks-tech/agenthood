/**
 * Skill discovery benchmark (#614). Generates 50 fixture skills and measures
 * the startup scan repeatedly, reporting median and p95. Cold clears the
 * metadata cache first; warm reuses it. The gate is the issue's budget: cold
 * startup under 500 ms with 50 skills, and a warm run that actually uses the
 * cache.
 *
 *   npm run bench:skills
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { SkillDiscovery } from '../src/skills/discovery/SkillDiscovery.ts'

const SKILL_COUNT = 50
const RUNS = 10
const BUDGET_MS = 500

// Isolate the fixture: user-scope roots resolve from the home directory, and a
// machine with installed skills would measure a different set.
const fakeHome = mkdtempSync(join(tmpdir(), 'agenthood-bench-home-'))
process.env.USERPROFILE = fakeHome
process.env.HOME = fakeHome

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

/** Nearest-rank percentile over an ascending array. */
function percentile(sorted: number[], p: number): number {
  const rank = Math.ceil((p / 100) * sorted.length) - 1
  return sorted[Math.min(Math.max(rank, 0), sorted.length - 1)]
}

const fmt = (ms: number) => ms.toFixed(1)

const project = makeProject()
try {
  const cold: number[] = []
  const warm: number[] = []
  let lastCold: ReturnType<typeof measure> | undefined
  let lastWarm: ReturnType<typeof measure> | undefined
  for (let run = 0; run < RUNS; run++) {
    rmSync(join(project, '.agenthood', 'skill-cache'), { recursive: true, force: true })
    lastCold = measure(project)
    lastWarm = measure(project)
    if (lastCold.skills !== SKILL_COUNT || lastCold.cacheHits !== 0) {
      throw new Error(`cold run measured ${lastCold.skills} skills / ${lastCold.cacheHits} cache hits, expected ${SKILL_COUNT} / 0`)
    }
    if (lastWarm.cacheHits !== SKILL_COUNT) {
      throw new Error(`warm run used the cache ${lastWarm.cacheHits} times, expected ${SKILL_COUNT}`)
    }
    cold.push(lastCold.ms)
    warm.push(lastWarm.ms)
  }
  cold.sort((a, b) => a - b)
  warm.sort((a, b) => a - b)
  const coldMedian = percentile(cold, 50)
  const warmMedian = percentile(warm, 50)
  const reduction = ((coldMedian - warmMedian) / coldMedian) * 100

  console.log(`skills: ${SKILL_COUNT} (isolated fixture, ${RUNS} runs)`)
  console.log(`cold: median ${fmt(coldMedian)} ms, p95 ${fmt(percentile(cold, 95))} ms (full parse)`)
  console.log(`warm: median ${fmt(warmMedian)} ms, p95 ${fmt(percentile(warm, 95))} ms (cache hits ${lastWarm?.cacheHits ?? 0})`)
  console.log(`reduction: ${reduction.toFixed(0)}% (warm median vs cold median)`)

  const problems: string[] = []
  if (coldMedian > BUDGET_MS) problems.push(`cold median ${fmt(coldMedian)} ms exceeds ${BUDGET_MS} ms`)
  if (percentile(cold, 95) > BUDGET_MS) problems.push(`cold p95 ${fmt(percentile(cold, 95))} ms exceeds ${BUDGET_MS} ms`)
  if (warmMedian >= coldMedian) problems.push('warm discovery is not faster than cold')
  if (problems.length > 0) {
    for (const problem of problems) console.error(`FAIL: ${problem}`)
    process.exitCode = 1
  }
} finally {
  rmSync(project, { recursive: true, force: true })
  rmSync(fakeHome, { recursive: true, force: true })
}
