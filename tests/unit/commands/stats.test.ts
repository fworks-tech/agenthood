import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { readSkillStats, recordSkillActivation, triggerRate } from '../../../src/skills/activation/SkillStats.ts'
import { command } from '../../../src/commands/stats.ts'
import { ActivateSkillTool } from '../../../src/skills/activation/ActivateSkillTool.ts'
import type { ISkillManifest } from '../../../src/skills/discovery/ISkillManifest.ts'
import { createTestContext } from '../../helpers/testContext.ts'

describe('skill stats (#625)', () => {
  let projectDir: string

  beforeEach(() => {
    projectDir = join(tmpdir(), `agenthood-skill-stats-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    mkdirSync(join(projectDir, '.agenthood'), { recursive: true })
  })

  afterEach(() => rmSync(projectDir, { recursive: true, force: true }))

  it('counts successes and failures per skill', () => {
    recordSkillActivation(projectDir, 'pdf-form-fill', true)
    recordSkillActivation(projectDir, 'pdf-form-fill', true)
    recordSkillActivation(projectDir, 'pdf-form-fill', false)
    recordSkillActivation(projectDir, 'docx-ooxml', true)

    const stats = readSkillStats(projectDir)
    expect(stats['pdf-form-fill']).toMatchObject({ activations: 3, successes: 2, failures: 1 })
    expect(stats['docx-ooxml']).toMatchObject({ activations: 1, successes: 1, failures: 0 })
    expect(stats['pdf-form-fill'].lastRun).not.toBeNull()
  })

  it('stores only counters — no prompt, argument or result content', () => {
    recordSkillActivation(projectDir, 'pdf-form-fill', true)
    const raw = JSON.stringify(readSkillStats(projectDir))
    expect(Object.keys(JSON.parse(raw)['pdf-form-fill']).sort()).toEqual([
      'activations', 'failures', 'lastRun', 'successes',
    ])
  })

  it('opt-out stops recording', () => {
    writeFileSync(
      join(projectDir, '.agenthood', 'config.json'),
      JSON.stringify({ analytics: { enabled: false } }),
    )
    recordSkillActivation(projectDir, 'pdf-form-fill', true)
    expect(readSkillStats(projectDir)).toEqual({})
  })

  it('treats a corrupt stats file as empty instead of throwing', () => {
    writeFileSync(join(projectDir, '.agenthood', 'skill-stats.json'), '{ not json')
    expect(readSkillStats(projectDir)).toEqual({})
  })

  it('trigger rate is null when a skill was never attempted', () => {
    expect(triggerRate({ activations: 0, successes: 0, failures: 0, lastRun: null })).toBeNull()
    expect(triggerRate({ activations: 4, successes: 3, failures: 1, lastRun: null })).toBe(0.75)
  })

  it('has a well-formed descriptor', () => {
    expect(command.name).toBe('stats')
    expect(typeof command.handler).toBe('function')
  })
})

describe('ActivateSkillTool analytics wiring', () => {
  let projectDir: string
  const manifest: ISkillManifest = {
    name: 'pdf-form-fill',
    description: 'fill forms',
    tier: 'community',
    location: 'local',
    directory: '/tmp/pdf-form-fill',
    body: 'do the thing',
    resources: [],
  }
  const context = () => createTestContext({ project: { localPath: projectDir, name: 'p' } })

  beforeEach(() => {
    projectDir = join(tmpdir(), `agenthood-skill-stats-tool-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    mkdirSync(join(projectDir, '.agenthood'), { recursive: true })
  })

  afterEach(() => rmSync(projectDir, { recursive: true, force: true }))

  it('records a successful activation', async () => {
    const tool = new ActivateSkillTool(new Map([['pdf-form-fill', manifest]]))
    const result = await tool.execute({ skill_name: 'pdf-form-fill' }, context())
    expect(result.success).toBe(true)
    expect(readSkillStats(projectDir)['pdf-form-fill']).toMatchObject({ activations: 1, successes: 1, failures: 0 })
  })

  it('records a failed activation so error rates are tracked', async () => {
    const tool = new ActivateSkillTool(new Map([['pdf-form-fill', manifest]]))
    const result = await tool.execute({ skill_name: 'ghost-skill' }, context())
    expect(result.success).toBe(false)
    expect(readSkillStats(projectDir)['ghost-skill']).toMatchObject({ activations: 1, successes: 0, failures: 1 })
  })
})
