/**
 * Skill discovery benchmark (#614). Generates 50 fixture skills and measures
 * the startup scan repeatedly, reporting median and p95. Cold clears the
 * metadata cache first; warm reuses it. Full parses bodies for every skill;
 * lazy (metadata-only) is the startup path after #614, where activation reads
 * the body on demand.
 *
 * The gate is the issue's budget: cold startup under 500 ms with 50 skills,
 * and a warm run that actually uses the cache.
 *
 *   npm run bench:skills
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { SkillDiscovery, type DiscoverOptions } from '../src/skills/discovery/SkillDiscovery.ts'

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

function measure(
  project: string,
  options: DiscoverOptions,
): { ms: number; directories: number; skills: number; cacheHits: number } {
  const discovery = new SkillDiscovery(project)
  // Warnings are not part of load time, and console writes would dominate a
  // short scan: the benchmark measures parsing, not printing.
  const warn = console.warn
  console.warn = () => {}
  try {
    const started = performance.now()
    discovery.discover(project, options)
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

interface Series {
  cold: number[]
  warm: number[]
  coldStats: ReturnType<typeof measure>
  warmStats: ReturnType<typeof measure>
}

function series(project: string, options: DiscoverOptions): Series {
  const cold: number[] = []
  const warm: number[] = []
  let coldStats: ReturnType<typeof measure> | undefined
  let warmStats: ReturnType<typeof measure> | undefined
  for (let run = 0; run < RUNS; run++) {
    rmSync(join(project, '.agenthood', 'skill-cache'), { recursive: true, force: true })
    coldStats = measure(project, options)
    warmStats = measure(project, options)
    if (coldStats.skills !== SKILL_COUNT || coldStats.cacheHits !== 0) {
      throw new Error(`cold run measured ${coldStats.skills} skills / ${coldStats.cacheHits} cache hits, expected ${SKILL_COUNT} / 0`)
    }
    if (warmStats.cacheHits !== SKILL_COUNT) {
      throw new Error(`warm run used the cache ${warmStats.cacheHits} times, expected ${SKILL_COUNT}`)
    }
    cold.push(coldStats.ms)
    warm.push(warmStats.ms)
  }
  cold.sort((a, b) => a - b)
  warm.sort((a, b) => a - b)
  return { cold, warm, coldStats: coldStats as ReturnType<typeof measure>, warmStats: warmStats as ReturnType<typeof measure> }
}

const project = makeProject()
try {
  const full = series(project, {})
  const lazy = series(project, { metadataOnly: true })

  const fullCold = percentile(full.cold, 50)
  const lazyCold = percentile(lazy.cold, 50)
  const lazyWarm = percentile(lazy.warm, 50)
  const initialReduction = ((fullCold - lazyCold) / fullCold) * 100
  const secondLoadReduction = ((fullCold - lazyWarm) / fullCold) * 100

  console.log(`skills: ${SKILL_COUNT} (isolated fixture, ${RUNS} runs)`)
  console.log(`full cold: median ${fmt(fullCold)} ms, p95 ${fmt(percentile(full.cold, 95))} ms (bodies parsed)`)
  console.log(`full warm: median ${fmt(percentile(full.warm, 50))} ms, p95 ${fmt(percentile(full.warm, 95))} ms (cache hits ${full.warmStats.cacheHits})`)
  console.log(`lazy cold: median ${fmt(lazyCold)} ms, p95 ${fmt(percentile(lazy.cold, 95))} ms (metadata only)`)
  console.log(`lazy warm: median ${fmt(lazyWarm)} ms, p95 ${fmt(percentile(lazy.warm, 95))} ms (cache hits ${lazy.warmStats.cacheHits})`)
  console.log(`initial-load reduction: ${initialReduction.toFixed(0)}% (lazy cold vs full cold)`)
  console.log(`second-load reduction: ${secondLoadReduction.toFixed(0)}% (lazy warm vs full cold)`)

  const problems: string[] = []
  if (fullCold > BUDGET_MS) problems.push(`full cold median ${fmt(fullCold)} ms exceeds ${BUDGET_MS} ms`)
  if (lazyCold > BUDGET_MS) problems.push(`lazy cold median ${fmt(lazyCold)} ms exceeds ${BUDGET_MS} ms`)
  if (percentile(lazy.cold, 95) > BUDGET_MS) problems.push(`lazy cold p95 ${fmt(percentile(lazy.cold, 95))} ms exceeds ${BUDGET_MS} ms`)
  if (lazyCold >= fullCold) problems.push('lazy discovery is not faster than full discovery')
  if (problems.length > 0) {
    for (const problem of problems) console.error(`FAIL: ${problem}`)
    process.exitCode = 1
  }
} finally {
  rmSync(project, { recursive: true, force: true })
  rmSync(fakeHome, { recursive: true, force: true })
}
