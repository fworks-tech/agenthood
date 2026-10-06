import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { load as loadYaml } from 'js-yaml'
import { rawSpecs } from '../../src/members/member-specs.ts'

const repoRoot = join(import.meta.dirname, '..', '..')

const DEPRECATED_ALIASES = [
  'test-driven-development',
  'security-and-hardening',
  'code-review',
  'implementation-planner',
  'institutional-knowledge',
  'runtime-health',
  'release-notes',
  'validation-and-enforcement',
  'debugging-and-error-recovery',
  'commit-messages',
]

interface ChainNode {
  member: string
  tools?: string[]
}

interface Chain {
  name: string
  sequence: ChainNode[]
  guards: { stop_on_blocking: boolean; doorman_before_merge: boolean; scribe_before_commit: boolean }
  max_rounds: number
}

function loadChains(): Chain[] {
  const raw = readFileSync(join(repoRoot, 'chains.yaml'), 'utf8')
  const doc = loadYaml(raw) as { chains: Chain[] }
  return doc.chains
}

describe('chains.yaml', () => {
  const members = rawSpecs.map((s) => s.name)
  const skills = readdirSync(join(repoRoot, 'skills'))
  const chains = loadChains()

  it('chains every standard flow plus incident triage', () => {
    const names = chains.map((c) => c.name).sort()
    expect(names).toEqual(
      ['authoring', 'bug', 'build', 'full', 'incident-triage', 'planning', 'release', 'review', 'security'].sort(),
    )
  })

  it('sequences only registered members with existing non-deprecated tools', () => {
    expect(chains.length).toBeGreaterThan(0)
    for (const chain of chains) {
      expect(chain.sequence.length, chain.name).toBeGreaterThan(0)
      for (const node of chain.sequence) {
        expect(members, `${chain.name}:${node.member}`).toContain(node.member)
        for (const tool of node.tools ?? []) {
          expect(skills, `${chain.name}:${tool}`).toContain(tool)
          expect(DEPRECATED_ALIASES, `${chain.name}:${tool}`).not.toContain(tool)
        }
      }
    }
  })

  it('carries the full guard set and a round cap on every chain', () => {
    for (const chain of chains) {
      expect(chain.guards.stop_on_blocking, chain.name).toBe(true)
      expect(chain.guards.doorman_before_merge, chain.name).toBe(true)
      expect(chain.guards.scribe_before_commit, chain.name).toBe(true)
      expect(chain.max_rounds, chain.name).toBe(3)
    }
  })

  it('never routes through a deprecated alias', () => {
    const text = readFileSync(join(repoRoot, 'chains.yaml'), 'utf8')
    for (const alias of DEPRECATED_ALIASES) {
      expect(text, alias).not.toContain(alias)
    }
  })

  it('incident-triage chain references only existing infra skills', () => {
    const incidentChain = chains.find((c) => c.name === 'incident-triage')
    expect(incidentChain).toBeDefined()
    for (const node of incidentChain!.sequence) {
      for (const tool of node.tools ?? []) {
        const skillPath = join(repoRoot, 'skills', tool)
        expect(existsSync(skillPath), `${tool} skill directory must exist at ${skillPath}`).toBe(true)
      }
    }
  })
})
