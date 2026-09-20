import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>()
  return {
    ...actual,
    existsSync: vi.fn(),
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
  }
})

import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { create } from '../../../src/commands/create.ts'

function exitSpy() {
  return vi.spyOn(process, 'exit').mockImplementation((() => {
    throw new Error('process.exit')
  }) as never)
}

describe('create command', () => {
  let output: string[] = []

  beforeEach(() => {
    output = []
    vi.spyOn(console, 'log').mockImplementation((...a) => { output.push(a.join(' ')) })
    vi.spyOn(console, 'error').mockImplementation((...a) => { output.push(a.join(' ')) })
    vi.mocked(existsSync).mockReturnValue(false)
    vi.mocked(mkdirSync).mockClear()
    vi.mocked(writeFileSync).mockClear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('requires a skill name', async () => {
    const exit = exitSpy()
    await expect(create([])).rejects.toThrow('process.exit')
    expect(exit).toHaveBeenCalledWith(1)
  })

  it('rejects names that do not match the skill spec', async () => {
    const exit = exitSpy()
    await expect(create(['My_Cool Skill'])).rejects.toThrow('process.exit')
    expect(vi.mocked(writeFileSync)).not.toHaveBeenCalled()
  })

  it('refuses Society member names', async () => {
    const exit = exitSpy()
    await expect(create(['the-scribe'])).rejects.toThrow('process.exit')
    expect(output.join('\n')).toContain('reserved')
    expect(vi.mocked(writeFileSync)).not.toHaveBeenCalled()
  })

  it('refuses an existing SKILL.md', async () => {
    vi.mocked(existsSync).mockImplementation((p) => String(p).endsWith('SKILL.md'))
    const exit = exitSpy()
    await expect(create(['my-cool-skill'])).rejects.toThrow('process.exit')
    expect(output.join('\n')).toContain('already exists')
    expect(vi.mocked(writeFileSync)).not.toHaveBeenCalled()
  })

  it('--dry-run writes nothing', async () => {
    await create(['my-cool-skill', 'reviews terraform', '--dry-run'])
    expect(output.join('\n')).toContain('Dry run')
    expect(vi.mocked(mkdirSync)).not.toHaveBeenCalled()
    expect(vi.mocked(writeFileSync)).not.toHaveBeenCalled()
  })

  it('scaffolds a SKILL.md with name and description frontmatter', async () => {
    await create(['my-cool-skill', 'reviews terraform plans for drift'])
    expect(vi.mocked(mkdirSync)).toHaveBeenCalledWith(expect.stringContaining('my-cool-skill'), { recursive: true })
    const written = vi.mocked(writeFileSync).mock.calls[0]
    expect(String(written![0])).toMatch(/[\\/]my-cool-skill[\\/]SKILL\.md$/)
    const content = String(written![1])
    expect(content).toContain('name: my-cool-skill')
    expect(content).toContain('description: reviews terraform plans for drift')
  })

  it('falls back to a TODO description', async () => {
    await create(['my-cool-skill'])
    const content = String(vi.mocked(writeFileSync).mock.calls[0]![1])
    expect(content).toContain('TODO — describe what my-cool-skill does')
  })
})
