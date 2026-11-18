/**
 * Cross-location skill deduplication (#616).
 *
 * Detection groups the same skill name across search roots. Consolidation
 * keeps the highest version; equal versions with different contents are a
 * conflict, never a guess, because "keep the highest" has no answer when the
 * versions are equal and picking one destroys the other's work.
 *
 * Everything here is a plan until `applyDedup` runs, and `applyDedup` writes
 * the diff to disk before it removes anything.
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { countTokens } from '../core/modelPricing.ts'
import { SkillDiscovery } from './discovery/SkillDiscovery.ts'
import { diffLines } from './lineDiff.ts'

export interface SkillRoot {
  path: string
  scope: 'user' | 'project'
}

export interface SkillCopy {
  name: string
  directory: string
  scope: 'user' | 'project'
  version?: string
  /** Full SKILL.md text: the content key for identical/tie detection. */
  content: string
  /** Catalog cost of this copy (`name: description`), for the savings report. */
  metadataTokens: number
}

export type DedupAction = 'identical' | 'merge' | 'conflict'

export interface DedupGroup {
  name: string
  copies: SkillCopy[]
  action: DedupAction
  winner?: SkillCopy
  losers: SkillCopy[]
}

export interface DedupPlan {
  groups: DedupGroup[]
  /** Catalog tokens the consolidations would remove (conflicts excluded). */
  savedTokens: number
}

export interface DedupApplyResult {
  removed: SkillCopy[]
  /** Set when the plan was written as a diff and applied. */
  diffPath?: string
  /** Groups that stopped the merge: nothing was mutated. */
  conflicts: DedupGroup[]
}

const VERSION_RE = /^(\d+)(?:\.(\d+))?(?:\.(\d+))?/

/**
 * Semver-ish compare: numeric segments when both parse, lexical otherwise.
 * shortcut: pre-release suffixes are not ordered, so 1.0.0-beta ties 1.0.0.
 * Upgrade when skills start pinning pre-release versions.
 */
export function compareVersions(a?: string, b?: string): number {
  if (a === b) return 0
  if (a === undefined) return -1
  if (b === undefined) return 1
  const pa = a.match(VERSION_RE)
  const pb = b.match(VERSION_RE)
  if (pa && pb) {
    for (let i = 1; i <= 3; i++) {
      const d = Number(pa[i] ?? 0) - Number(pb[i] ?? 0)
      if (d !== 0) return d > 0 ? 1 : -1
    }
    return 0
  }
  return a.localeCompare(b)
}

function classify(name: string, copies: SkillCopy[]): DedupGroup {
  const identical = copies.every((copy) => copy.content === copies[0].content)
  if (identical) {
    // Any copy would do; keep the one the runtime already prefers so the
    // survivor does not move locations.
    const winner = copies.find((copy) => copy.scope === 'project') ?? copies[0]
    return { name, copies, action: 'identical', winner, losers: copies.filter((copy) => copy !== winner) }
  }

  const maxVersion = copies.reduce<string | undefined>((best, copy) => {
    if (copy.version === undefined) return best
    return best === undefined || compareVersions(copy.version, best) > 0 ? copy.version : best
  }, undefined)
  const tied = copies.filter((copy) => copy.version === maxVersion)
  const tieIsAmbiguous = tied.length > 1 && !tied.every((copy) => copy.content === tied[0].content)
  if (tieIsAmbiguous) return { name, copies, action: 'conflict', losers: [] }

  const winner = tied[0]
  return { name, copies, action: 'merge', winner, losers: copies.filter((copy) => copy !== winner) }
}

/** Groups every skill name installed in more than one root. Read-only. */
export function planDedup(roots: SkillRoot[]): DedupPlan {
  const byName = new Map<string, SkillCopy[]>()
  const discovery = new SkillDiscovery()
  for (const root of roots) {
    for (const manifest of discovery.scanRoot(root.path)) {
      const copies = byName.get(manifest.name) ?? []
      // Symlinked roots can surface the same directory twice.
      if (copies.some((copy) => copy.directory === manifest.directory)) continue
      copies.push({
        name: manifest.name,
        directory: manifest.directory,
        scope: root.scope,
        version: manifest.version,
        content: readFileSync(manifest.location, 'utf8'),
        metadataTokens: countTokens(`${manifest.name}: ${manifest.description}`),
      })
      byName.set(manifest.name, copies)
    }
  }

  const groups: DedupGroup[] = []
  let savedTokens = 0
  for (const [name, copies] of byName) {
    if (copies.length < 2) continue
    const group = classify(name, copies)
    groups.push(group)
    if (group.action !== 'conflict') {
      savedTokens += group.losers.reduce((sum, loser) => sum + loser.metadataTokens, 0)
    }
  }
  groups.sort((a, b) => a.name.localeCompare(b.name))
  return { groups, savedTokens }
}

/**
 * Writes the diff under `.agenthood/dedup/` and only then removes the losing
 * directories. A plan with any conflict is refused whole: partially
 * consolidating around an unresolved tie is how someone loses work.
 */
export function applyDedup(plan: DedupPlan, projectDir: string): DedupApplyResult {
  const conflicts = plan.groups.filter((group) => group.action === 'conflict')
  if (conflicts.length > 0) return { removed: [], conflicts }

  const groups = plan.groups.filter((group) => group.winner !== undefined && group.losers.length > 0)
  if (groups.length === 0) return { removed: [], conflicts: [] }

  const diffDir = join(projectDir, '.agenthood', 'dedup')
  mkdirSync(diffDir, { recursive: true })
  const diffPath = join(diffDir, 'dedup-merge.diff')
  const lines = [`# Dedup merge ${new Date().toISOString()}`, '']
  for (const group of groups) {
    const winner = group.winner as SkillCopy
    for (const loser of group.losers) {
      lines.push(`--- ${join(loser.directory, 'SKILL.md')} (${loser.scope}${loser.version ? `, v${loser.version}` : ''})`)
      lines.push(`+++ ${join(winner.directory, 'SKILL.md')} (${winner.scope}${winner.version ? `, v${winner.version}` : ''})`)
      for (const line of diffLines(loser.content, winner.content)) lines.push(`${line.kind}${line.text}`)
      lines.push('')
    }
  }
  writeFileSync(diffPath, lines.join('\n'))

  const removed: SkillCopy[] = []
  for (const group of groups) {
    for (const loser of group.losers) {
      rmSync(loser.directory, { recursive: true, force: true })
      removed.push(loser)
    }
  }
  return { removed, diffPath, conflicts: [] }
}
