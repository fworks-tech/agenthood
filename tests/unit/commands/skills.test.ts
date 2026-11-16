import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { skills } from '../../../src/commands/skills.ts'

function skill(dir: string, name: string, extra = ''): void {
  const target = join(dir, '.agents', 'skills', name)
  mkdirSync(target, { recursive: true })
  writeFileSync(join(target, 'SKILL.md'), `---\nname: ${name}\ndescription: ${name} description\n${extra}---\n# Overview\nBody.`)
}

describe('skills command (#537, #611)', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'skills-cmd-'))
    mkdirSync(join(dir, '.agenthood'), { recursive: true })
    skill(dir, 'noisy')
    skill(dir, 'hidden-one', 'hidden: true\n')
    skill(dir, 'prioritised', 'metadata:\n  priority: 80\n')
    writeFileSync(
      join(dir, '.agenthood', 'config.json'),
      JSON.stringify({ skills: { disabled: ['noisy'] } }),
    )
    vi.spyOn(process, 'cwd').mockReturnValue(dir)
    vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
    rmSync(dir, { recursive: true, force: true })
  })

  const output = () => vi.mocked(console.log).mock.calls.flat().join('\n')

  it('lists catalog-order skills and hides the filtered ones', async () => {
    await skills([])
    const text = output()
    expect(text).toContain('prioritised')
    expect(text).not.toContain('noisy')
    expect(text).not.toContain('hidden-one')
  })

  it('names what is filtered and why with --show-disabled', async () => {
    await skills(['--show-disabled'])
    const text = output()
    expect(text).toContain('noisy')
    expect(text).toContain('disabled in config')
    expect(text).toContain('hidden-one')
    expect(text).toContain('hidden: true')
  })

  it('emits JSON including each skill priority', async () => {
    await skills(['--json'])
    const payload = JSON.parse(vi.mocked(console.log).mock.calls.at(-1)![0] as string)
    expect(payload.skills.find((s: { name: string }) => s.name === 'prioritised')).toMatchObject({ priority: 80 })
    expect(payload.filtered).toBeUndefined()
  })

  it('describes the flags in --help', async () => {
    await skills(['--help'])
    expect(output()).toContain('--show-disabled')
  })
})
