import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { loadRepoInstructions } from '../../../src/runtime/repoInstructions.ts'

describe('loadRepoInstructions', () => {
  let testDir: string

  beforeEach(() => {
    testDir = join(tmpdir(), `agenthood-agents-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    mkdirSync(testDir, { recursive: true })
  })

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true })
  })

  it('returns an empty string when neither file exists', () => {
    expect(loadRepoInstructions(testDir)).toBe('')
  })

  it('loads AGENTS.md from the project root', () => {
    writeFileSync(join(testDir, 'AGENTS.md'), '# House rules\nUse tabs.\n')
    expect(loadRepoInstructions(testDir)).toContain('Use tabs.')
  })

  it('falls back to CLAUDE.md when AGENTS.md is absent', () => {
    writeFileSync(join(testDir, 'CLAUDE.md'), '# Claude rules\nBe terse.\n')
    expect(loadRepoInstructions(testDir)).toContain('Be terse.')
  })

  it('prefers AGENTS.md over CLAUDE.md when both exist', () => {
    writeFileSync(join(testDir, 'AGENTS.md'), 'agents-wins')
    writeFileSync(join(testDir, 'CLAUDE.md'), 'claude-loses')
    expect(loadRepoInstructions(testDir)).toContain('agents-wins')
    expect(loadRepoInstructions(testDir)).not.toContain('claude-loses')
  })

  it('truncates at the 64 KB bound and says so', () => {
    writeFileSync(join(testDir, 'AGENTS.md'), 'x'.repeat(70_000))
    const result = loadRepoInstructions(testDir)
    expect(result.length).toBeLessThanOrEqual(70_000)
    expect(result).toContain('truncated')
  })

  it('does not truncate content just under the bound', () => {
    writeFileSync(join(testDir, 'AGENTS.md'), 'short enough')
    const result = loadRepoInstructions(testDir)
    expect(result).toContain('short enough')
    expect(result).not.toContain('truncated')
  })

  it('returns an empty string for a whitespace-only file', () => {
    writeFileSync(join(testDir, 'AGENTS.md'), '   \n\n  \n')
    expect(loadRepoInstructions(testDir)).toBe('')
  })

  it('strips a UTF-8 BOM so the first heading survives', () => {
    writeFileSync(join(testDir, 'AGENTS.md'), '\uFEFF# Rules\nBe careful.\n', 'utf-8')
    expect(loadRepoInstructions(testDir)).toContain('Be careful.')
  })

  it('ignores AGENTS.md in a nested directory — root only', () => {
    mkdirSync(join(testDir, 'packages', 'app'), { recursive: true })
    writeFileSync(join(testDir, 'packages', 'app', 'AGENTS.md'), 'nested-only')
    expect(loadRepoInstructions(testDir)).toBe('')
  })
})
