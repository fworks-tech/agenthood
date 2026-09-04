import { describe, it, expect } from 'vitest'
import pluginModule, { memberNames } from '../../src/opencode-plugin.ts'

type HookConfig = {
  skills?: { paths?: string[]; urls?: string[] }
  instructions?: string[]
  agent?: Record<string, { description?: string; mode?: string }>
}

describe('agenthood opencode plugin', () => {
  it('default-exports a PluginModule with id and server', () => {
    expect(pluginModule.id).toBe('agenthood')
    expect(typeof pluginModule.server).toBe('function')
  })

  it('config hook wires the skills dir, AGENTS.md, and the-steward agent', async () => {
    const hooks = await pluginModule.server()
    const cfg: HookConfig = { skills: {}, instructions: [], agent: {} }
    await hooks.config?.(cfg as never)

    expect(cfg.skills?.paths?.some((p) => p.endsWith('skills'))).toBe(true)
    expect(cfg.instructions?.some((i) => i.endsWith('AGENTS.md'))).toBe(true)
    expect(cfg.agent?.['the-steward']?.mode).toBe('primary')
    expect(cfg.agent?.['the-steward']?.description).toBeTruthy()
  })

  it('registers agenthood_run_member with a member enum and task string', async () => {
    const hooks = await pluginModule.server()
    const def = hooks.tool?.['agenthood_run_member']
    expect(def).toBeDefined()
    expect(def?.description).toContain('the-reviewer')
    expect(def?.args.member).toBeDefined()
    expect(def?.args.task).toBeDefined()
  })

  it('derives the member list from the shipped skills directory', () => {
    expect(memberNames).toContain('the-reviewer')
    expect(memberNames).toContain('the-warden')
    expect(memberNames).toContain('the-builder')
    expect(memberNames).toHaveLength(20)
  })
})