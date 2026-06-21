import { describe, it, expect, vi } from 'vitest'
import { RiskManager } from '../../../src/core/RiskManager.js'
import type { ISkill, SkillResult } from '../../../src/skills/ISkill.js'
import type { ExecutionContext } from '../../../src/core/ExecutionContext.js'

function mockSkill(name: string): ISkill {
  return {
    name,
    description: name,
    inputSchema: { type: 'object', properties: {} },
    execute: vi.fn().mockResolvedValue({ success: true, output: 'ok' } as SkillResult),
  }
}

describe('RiskManager', () => {
  describe('validate — path blocking', () => {
    const strict = new RiskManager({
      allowedPaths: ['src/**', 'tests/**'],
      blockedPaths: ['.env', '**/.git/**'],
      allowedHosts: ['**'],
      maxExecutionMs: 30_000,
      maxFileSizeBytes: 1024,
    })

    it('allows writes to allowed paths', () => {
      const skill = mockSkill('write_file')
      expect(strict.validate(skill, { path: 'src/main.ts', content: '' })).toBeNull()
    })

    it('blocks writes to blocked paths', () => {
      const skill = mockSkill('write_file')
      const violation = strict.validate(skill, { path: '.env', content: '' })
      expect(violation).not.toBeNull()
      expect(violation!.type).toBe('path')
    })

    it('blocks writes to paths under blocked pattern', () => {
      const skill = mockSkill('write_file')
      const violation = strict.validate(skill, { path: 'src/.git/config', content: '' })
      expect(violation).not.toBeNull()
      expect(violation!.type).toBe('path')
    })

    it('blocks writes outside allowed paths', () => {
      const skill = mockSkill('write_file')
      const violation = strict.validate(skill, { path: 'node_modules/foo.js', content: '' })
      expect(violation).not.toBeNull()
      expect(violation!.type).toBe('path')
    })

    it('returns null for read skills', () => {
      const skill = mockSkill('read_file')
      expect(strict.validate(skill, { path: '/etc/passwd' })).toBeNull()
    })
  })

  describe('validate — file size cap', () => {
    const capped = new RiskManager({
      allowedPaths: ['**'],
      blockedPaths: [],
      allowedHosts: ['**'],
      maxExecutionMs: 30_000,
      maxFileSizeBytes: 10,
    })

    it('rejects content exceeding maxFileSizeBytes', () => {
      const skill = mockSkill('write_code')
      const violation = capped.validate(skill, { path: 'src/test.ts', content: 'a'.repeat(20) })
      expect(violation).not.toBeNull()
      expect(violation!.type).toBe('filesize')
    })

    it('allows content within file size cap', () => {
      const skill = mockSkill('write_code')
      expect(capped.validate(skill, { path: 'src/test.ts', content: 'short' })).toBeNull()
    })
  })

  describe('validate — host blocking', () => {
    const restricted = new RiskManager({
      allowedPaths: ['**'],
      blockedPaths: [],
      allowedHosts: ['api.github.com'],
      maxExecutionMs: 30_000,
      maxFileSizeBytes: 1024,
    })

    it('allows web requests to allowed hosts', () => {
      const skill = mockSkill('web_search')
      expect(restricted.validate(skill, { url: 'https://api.github.com/repos' })).toBeNull()
    })

    it('blocks web requests to disallowed hosts', () => {
      const skill = mockSkill('web_search')
      const violation = restricted.validate(skill, { url: 'https://evil.com/steal' })
      expect(violation).not.toBeNull()
      expect(violation!.type).toBe('host')
    })
  })

  describe('wrap — timeout enforcement', () => {
    it('rejects if executor exceeds maxExecutionMs', async () => {
      const rm = new RiskManager({
        allowedPaths: ['**'],
        blockedPaths: [],
        allowedHosts: ['**'],
        maxExecutionMs: 10,
        maxFileSizeBytes: 1024,
      })

      const slow = async () => {
        await new Promise((r) => setTimeout(r, 100))
        return 'done'
      }

      const wrapped = rm.wrap(slow)
      await expect(wrapped('input', {})).rejects.toThrow('timed out')
    })

    it('resolves if executor finishes within timeout', async () => {
      const rm = new RiskManager({
        allowedPaths: ['**'],
        blockedPaths: [],
        allowedHosts: ['**'],
        maxExecutionMs: 5_000,
        maxFileSizeBytes: 1024,
      })

      const fast = async () => 'done'
      const wrapped = rm.wrap(fast)
      await expect(wrapped('input', {})).resolves.toBe('done')
    })
  })

  describe('violation structure', () => {
    it('includes type, skill, reason, and input', () => {
      const rm = new RiskManager({
        allowedPaths: ['src/**'],
        blockedPaths: [],
        allowedHosts: ['**'],
        maxExecutionMs: 30_000,
        maxFileSizeBytes: 1024,
      })

      const skill = mockSkill('write_file')
      const violation = rm.validate(skill, { path: 'node_modules/x.js', content: '' })

      expect(violation).toHaveProperty('type')
      expect(violation).toHaveProperty('skill')
      expect(violation).toHaveProperty('reason')
      expect(violation).toHaveProperty('input')
      expect(violation!.skill).toBe('write_file')
    })
  })

  describe('default permissive policy', () => {
    it('allows everything by default', () => {
      const rm = new RiskManager()
      const skill = mockSkill('write_file')
      expect(rm.validate(skill, { path: '/etc/passwd', content: 'data' })).toBeNull()
      expect(rm.validate(skill, { path: '.env', content: 'key=val' })).toBeNull()
      expect(rm.validate(skill, { path: 'node_modules/bad.js', content: 'x' })).toBeNull()
    })
  })
})
