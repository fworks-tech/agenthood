import { describe, it, expect, beforeEach } from 'vitest'
import {
  SafetyGuard,
  SafetyLimitError,
  LoopDetectedError,
  CatastrophicCommandError,
} from '../../../src/core/SafetyGuard.js'

describe('SafetyGuard', () => {
  let guard: SafetyGuard

  beforeEach(() => {
    guard = new SafetyGuard(undefined, 'standard')
  })

  describe('catastrophic command blocklist', () => {
    const catastrophic = [
      'rm -rf /',
      'rm -rf /*',
      'mkfs.ext4 /dev/sda',
      'dd if=/dev/zero of=/dev/sda',
      'DROP DATABASE production',
      'git push --force origin main',
    ]

    for (const cmd of catastrophic) {
      it(`blocks catastrophic command: "${cmd}"`, () => {
        expect(() => guard.checkCommand(cmd)).toThrow(CatastrophicCommandError)
      })
    }

    it('allows safe commands', () => {
      expect(() => guard.checkCommand('npm run build')).not.toThrow()
      expect(() => guard.checkCommand('git status')).not.toThrow()
      expect(() => guard.checkCommand('ls -la')).not.toThrow()
    })
  })

  describe('permission profiles', () => {
    it('restricted profile blocks terminal commands', () => {
      const restricted = new SafetyGuard(undefined, 'restricted')
      expect(() => restricted.checkCommand('ls')).toThrow(SafetyLimitError)
    })

    it('standard profile allows terminal commands', () => {
      expect(() => guard.checkCommand('npm run build')).not.toThrow()
    })
  })

  describe('tool invocation cap', () => {
    it('throws when tool invocations exceed max', () => {
      for (let i = 0; i < 400; i++) {
        guard.countToolInvocation()
      }
      expect(() => guard.countToolInvocation()).toThrow(SafetyLimitError)
    })

    it('allows invocations within cap', () => {
      for (let i = 0; i < 100; i++) {
        expect(() => guard.countToolInvocation()).not.toThrow()
      }
    })
  })

  describe('stream event cap', () => {
    it('throws when stream events exceed cap', () => {
      for (let i = 0; i < 2_000; i++) {
        guard.countStreamEvent()
      }
      expect(() => guard.countStreamEvent()).toThrow(SafetyLimitError)
    })
  })

  describe('file edit loop detection', () => {
    it('throws LoopDetectedError on 4th edit to same file', () => {
      expect(() => guard.registerFileEdit('src/main.ts')).not.toThrow()
      expect(() => guard.registerFileEdit('src/main.ts')).not.toThrow()
      expect(() => guard.registerFileEdit('src/main.ts')).not.toThrow()
      expect(() => guard.registerFileEdit('src/main.ts')).toThrow(LoopDetectedError)
    })

    it('does not throw for edits to different files', () => {
      expect(() => guard.registerFileEdit('src/a.ts')).not.toThrow()
      expect(() => guard.registerFileEdit('src/b.ts')).not.toThrow()
      expect(() => guard.registerFileEdit('src/c.ts')).not.toThrow()
      expect(() => guard.registerFileEdit('src/d.ts')).not.toThrow()
    })

    it('hasLoop returns true at threshold', () => {
      guard.registerFileEdit('file.ts') // 1 — also counts as tool call
      guard.registerFileEdit('file.ts') // 2
      guard.registerFileEdit('file.ts') // 3
      expect(guard.hasLoop('file.ts')).toBe(false) // 3 < 4
      // 4th triggers LoopDetectedError but counter still records it
      expect(() => guard.registerFileEdit('file.ts')).toThrow(LoopDetectedError)
      expect(guard.hasLoop('file.ts')).toBe(true)
    })
  })

  describe('terminal command cap', () => {
    it('throws when terminal commands exceed max', () => {
      const g = new SafetyGuard(undefined, 'standard')
      for (let i = 0; i < 10; i++) {
        expect(() => g.checkCommand(`echo ${i}`)).not.toThrow()
      }
      expect(() => g.checkCommand('ls')).toThrow(SafetyLimitError)
    })
  })

  describe('web search cap', () => {
    it('throws when web searches exceed max', () => {
      for (let i = 0; i < 8; i++) {
        guard.registerWebSearch()
      }
      expect(() => guard.registerWebSearch()).toThrow(SafetyLimitError)
    })
  })

  describe('session runtime', () => {
    it('does not throw when within runtime limit', () => {
      expect(() => guard.checkSessionRuntime()).not.toThrow()
    })
  })

  describe('budget reporting', () => {
    it('returns remaining budget as strings', () => {
      const budget = guard.remainingBudget()
      expect(budget.streamEvents).toBe('0/2000')
      expect(budget.toolInvocations).toBe('0/400')
      expect(budget.terminalCommands).toBe('0/10')
      expect(budget.webSearches).toBe('0/8')
    })

    it('updates after usage', () => {
      guard.countToolInvocation()
      guard.countToolInvocation()
      guard.checkCommand('echo test')
      guard.registerWebSearch()

      const budget = guard.remainingBudget()
      expect(budget.toolInvocations).toBe('3/400') // 2 explicit + 1 from checkCommand
      expect(budget.terminalCommands).toBe('1/10')
      expect(budget.webSearches).toBe('1/8')
    })
  })

  describe('reset', () => {
    it('clears all counters', () => {
      guard.countToolInvocation()
      guard.checkCommand('echo test')
      guard.registerWebSearch()
      guard.registerFileEdit('file.ts')

      guard.reset()

      const budget = guard.remainingBudget()
      expect(budget.toolInvocations).toBe('0/400')
      expect(budget.terminalCommands).toBe('0/10')
      expect(budget.webSearches).toBe('0/8')
      expect(guard.hasLoop('file.ts')).toBe(false)
    })
  })
})
