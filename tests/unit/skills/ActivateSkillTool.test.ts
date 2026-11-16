import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { ActivateSkillTool } from '../../../src/skills/activation/ActivateSkillTool.ts'
import { formatSkillContent, SKILL_ACTIVATION_PREFIX } from '../../../src/skills/activation/skillContent.ts'
import type { ISkillManifest } from '../../../src/skills/discovery/ISkillManifest.ts'
import type { ExecutionContext } from '../../../src/core/ExecutionContext.ts'

const manifest = (name: string, extra: Partial<ISkillManifest> = {}): ISkillManifest => ({
  name,
  description: `${name} skill`,
  tier: 'community',
  location: `/skills/${name}/SKILL.md`,
  directory: `/skills/${name}`,
  body: `${name} body`,
  resources: [],
  ...extra,
})

describe('ActivateSkillTool schema (#531)', () => {
  it('constrains skill_name to the discovered skills', () => {
    const tool = new ActivateSkillTool(new Map([['a', manifest('a')], ['b', manifest('b')]]))
    expect(tool.inputSchema.properties?.skill_name.enum).toEqual(['a', 'b'])
  })

  it('omits the enum when every skill is disabled — an empty enum is invalid', () => {
    const tool = new ActivateSkillTool(new Map([['a', manifest('a')]]), 128000, { disabled: new Set(['a']) })
    expect(tool.inputSchema.properties?.skill_name.enum).toBeUndefined()
  })

  it('refuses a skill disabled in config (#537)', async () => {
    const projectDir = mkdtempSync(join(tmpdir(), 'activate-disabled-'))
    try {
      const tool = new ActivateSkillTool(new Map([['a', manifest('a')]]), 128000, { disabled: new Set(['a']) })
      const result = await tool.execute(
        { skill_name: 'a' },
        { project: { localPath: projectDir, name: 'p' } } as unknown as ExecutionContext,
      )
      expect(result.success).toBe(false)
      expect(result.error).toContain('disabled')
    } finally {
      rmSync(projectDir, { recursive: true, force: true })
    }
  })
})

let dir: string
const context = () =>
  ({ project: { localPath: dir, name: 'p' }, events: { emit: () => {} } }) as unknown as ExecutionContext

describe('ActivateSkillTool behaviour (#531, #535)', () => {
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'activate-'))
    mkdirSync(join(dir, '.agenthood'), { recursive: true })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    rmSync(dir, { recursive: true, force: true })
  })

  it('returns the same block on a second activation (#531 idempotent)', async () => {
    const tool = new ActivateSkillTool(new Map([['a', manifest('a')]]), 128000, { now: () => '2026-01-01T00:00:00.000Z' })
    const first = await tool.execute({ skill_name: 'a' }, context())
    const second = await tool.execute({ skill_name: 'a' }, context())
    expect(second.output).toBe(first.output)
  })

  it('wraps the body with name, version, trigger and timestamp (#535)', async () => {
    const tool = new ActivateSkillTool(new Map([['a', manifest('a', { version: '1.2.3' })]]), 128000, {
      now: () => '2026-01-01T00:00:00.000Z',
    })
    const result = await tool.execute({ skill_name: 'a' }, context())
    expect(result.output.startsWith(SKILL_ACTIVATION_PREFIX)).toBe(true)
    expect(result.output).toContain('<skill_content name="a" version="1.2.3" trigger="model" activated_at="2026-01-01T00:00:00.000Z">')
    expect(result.output).toContain('a body')
  })

  it('lists bundled resources', () => {
    const block = formatSkillContent(manifest('a', { resources: ['scripts/run.sh', 'references/x.md'] }), 'body')
    expect(block).toContain('<bundled_resources>')
    expect(block).toContain('<file>scripts/run.sh</file>')
  })

  it('renders JSON when the format is json, and keeps the activation prefix', () => {
    const block = formatSkillContent(manifest('a'), 'body', { format: 'json', trigger: 'explicit' })
    expect(block.startsWith(SKILL_ACTIVATION_PREFIX)).toBe(true)
    const payload = JSON.parse(block.slice(SKILL_ACTIVATION_PREFIX.length))
    expect(payload.skill).toMatchObject({ name: 'a', trigger: 'explicit' })
    expect(payload.instructions).toBe('body')
  })
})

describe('ActivateSkillTool conditions and fallback (#610, #613)', () => {
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'activate-'))
    mkdirSync(join(dir, '.agenthood'), { recursive: true })
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
    rmSync(dir, { recursive: true, force: true })
  })

  it('refuses activation when a condition does not hold, and logs the skip', async () => {
    const tool = new ActivateSkillTool(
      new Map([['ci', manifest('ci', { conditions: ['env:AGENTHOOD_CI_ONLY=1'] })]]),
      128000,
    )
    const result = await tool.execute({ skill_name: 'ci' }, context())
    expect(result.success).toBe(false)
    expect(result.error).toContain('cannot activate here')
    expect(vi.mocked(console.warn).mock.calls.flat().join(' ')).toContain('skipped "ci"')
  })

  it('activates when the condition holds', async () => {
    process.env.AGENTHOOD_CI_ONLY = '1'
    try {
      const tool = new ActivateSkillTool(
        new Map([['ci', manifest('ci', { conditions: ['env:AGENTHOOD_CI_ONLY=1'] })]]),
        128000,
      )
      await expect(tool.execute({ skill_name: 'ci' }, context())).resolves.toMatchObject({ success: true })
    } finally {
      delete process.env.AGENTHOOD_CI_ONLY
    }
  })

  it('falls back to the next skill when the primary is unavailable', async () => {
    const tool = new ActivateSkillTool(
      new Map([
        ['primary', manifest('primary', { conditions: ['env:AGENTHOOD_NEVER_SET'], fallback: ['backup'] })],
        ['backup', manifest('backup')],
      ]),
      128000,
    )
    const result = await tool.execute({ skill_name: 'primary' }, context())
    expect(result.success).toBe(true)
    expect(result.output).toContain('name="backup"')
    expect(result.output).toContain('trigger="fallback"')
    expect(result.output).toContain('<skill_fallback from="primary" />')
  })

  it('does not fall back when fallback is disabled', async () => {
    const tool = new ActivateSkillTool(
      new Map([
        ['primary', manifest('primary', { conditions: ['env:AGENTHOOD_NEVER_SET'], fallback: ['backup'] })],
        ['backup', manifest('backup')],
      ]),
      128000,
      { fallback: false },
    )
    const result = await tool.execute({ skill_name: 'primary' }, context())
    expect(result.success).toBe(false)
  })

  it('stops a fallback cycle instead of looping', async () => {
    const tool = new ActivateSkillTool(
      new Map([
        ['a', manifest('a', { conditions: ['env:AGENTHOOD_NEVER_SET'], fallback: ['b'] })],
        ['b', manifest('b', { conditions: ['env:AGENTHOOD_NEVER_SET'], fallback: ['a'] })],
      ]),
      128000,
    )
    const result = await tool.execute({ skill_name: 'a' }, context())
    expect(result.success).toBe(false)
  })
})
