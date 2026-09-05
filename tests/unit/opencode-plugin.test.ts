import { describe, it, expect } from 'vitest'
import pluginModule, { memberNames } from '../../src/opencode-plugin.ts'
import { rawSpecs } from '../../src/members/member-specs.ts'
import type { Config } from '@opencode-ai/plugin'

describe('agenthood opencode plugin', () => {
  it('default-exports a PluginModule with id and server', () => {
    expect(pluginModule.id).toBe('agenthood')
    expect(typeof pluginModule.server).toBe('function')
  })

  it('config hook wires the skills dir, AGENTS.md, and the-steward agent', async () => {
    const hooks = await pluginModule.server()
    const cfg = {} as Config
    await hooks.config?.(cfg)

    const merged = cfg as Config & {
      skills?: { paths?: string[] }
      instructions?: string[]
      agent?: Record<string, { description?: string; mode?: string }>
    }
    expect(merged.skills?.paths?.some((p) => p.endsWith('skills'))).toBe(true)
    expect(merged.instructions?.some((i) => i.endsWith('AGENTS.md'))).toBe(true)
    expect(merged.agent?.['the-steward']?.mode).toBe('primary')
    expect(merged.agent?.['the-steward']?.description).toBeTruthy()
  })

  it('registers agenthood_run_member with a member enum and task string', async () => {
    const hooks = await pluginModule.server()
    const def = hooks.tool?.['agenthood_run_member']
    expect(def).toBeDefined()
    expect(def?.description).toContain(memberNames.join(', '))
    expect(def?.args.member).toBeDefined()
    expect(def?.args.task).toBeDefined()
  })

  it('matches the member list against the canonical registry (single manifest)', () => {
    const registryNames = rawSpecs.map((s) => s.name).sort()
    expect(memberNames).toEqual(registryNames)
  })
})
