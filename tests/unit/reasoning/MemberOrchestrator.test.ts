import { describe, it, expect } from 'vitest'
import { MemberOrchestrator } from '../../../src/reasoning/MemberOrchestrator.js'
import type { DetectionContext } from '../../../src/reasoning/MemberOrchestrator.js'

describe('MemberOrchestrator', () => {
  const orchestrator = new MemberOrchestrator()

  it('detects the-reviewer for review tasks', () => {
    const context: DetectionContext = {
      userMessage: 'review this pull request for correctness',
    }

    const results = orchestrator.detectMembers(context)
    const members = results.map((r) => r.member)

    expect(members).toContain('the-reviewer')
  })

  it('detects the-architect for design tasks', () => {
    const context: DetectionContext = {
      userMessage: 'plan the architecture for the OAuth2 integration',
    }

    const results = orchestrator.detectMembers(context)
    const members = results.map((r) => r.member)

    expect(members).toContain('the-architect')
  })

  it('detects the-tester when tests are mentioned', () => {
    const context: DetectionContext = {
      userMessage: 'write unit tests for the auth module',
    }

    const results = orchestrator.detectMembers(context)
    const members = results.map((r) => r.member)

    expect(members).toContain('the-tester')
  })

  it('detects the-scribe for commit messages', () => {
    const context: DetectionContext = {
      userMessage: 'write a commit message for the staged changes',
    }

    const results = orchestrator.detectMembers(context)
    const members = results.map((r) => r.member)

    expect(members).toContain('the-scribe')
  })

  it('detects the-debugger for error messages', () => {
    const context: DetectionContext = {
      userMessage: 'debug the CI failure in the test suite',
    }

    const results = orchestrator.detectMembers(context)
    const members = results.map((r) => r.member)

    expect(members).toContain('the-debugger')
  })

  it('detects the-auditor for security tasks', () => {
    const context: DetectionContext = {
      userMessage: 'run a security audit on the authentication module',
    }

    const results = orchestrator.detectMembers(context)
    const members = results.map((r) => r.member)

    expect(members).toContain('the-auditor')
  })

  it('detects the-herald for release tasks', () => {
    const context: DetectionContext = {
      userMessage: 'prepare the release notes and bump the version',
    }

    const results = orchestrator.detectMembers(context)
    const members = results.map((r) => r.member)

    expect(members).toContain('the-herald')
  })

  it('detects the-oracle when files in docs/members/ changed', () => {
    const context: DetectionContext = {
      userMessage: 'what does the-scribe do',
      changedFiles: ['docs/members/the-scribe/SKILL.md'],
    }

    const results = orchestrator.detectMembers(context)
    const members = results.map((r) => r.member)

    expect(members).toContain('the-oracle')
  })

  it('returns empty for unrelated tasks below threshold', () => {
    const context: DetectionContext = {
      userMessage: 'hello world',
    }

    const results = orchestrator.detectMembers(context)

    expect(results.length).toBe(0)
  })

  it('returns multiple members for complex tasks', () => {
    const context: DetectionContext = {
      userMessage: 'design the architecture, write tests, and review the code',
    }

    const results = orchestrator.detectMembers(context)
    const members = results.map((r) => r.member)

    expect(members).toContain('the-architect')
    expect(members).toContain('the-tester')
    expect(members).toContain('the-reviewer')
  })

  it('ranks results by score', () => {
    const context: DetectionContext = {
      userMessage: 'design architecture plan for review',
    }

    const results = orchestrator.detectMembers(context)

    for (let i = 1; i < results.length; i++) {
      expect(results[i].score).toBeLessThanOrEqual(results[i - 1].score)
    }
  })

  it('getDefaultMember returns highest scoring member', () => {
    const context: DetectionContext = {
      userMessage: 'review the code for security issues in the design',
    }

    const results = orchestrator.detectMembers(context)
    const defaultMember = orchestrator.getDefaultMember(results)

    expect(defaultMember).toBeTruthy()
    if (defaultMember) {
      expect(['the-reviewer', 'the-auditor', 'the-architect']).toContain(defaultMember)
    }
  })

  it('returns null for getDefaultMember when no members detected', () => {
    const context: DetectionContext = {
      userMessage: 'hello',
    }

    const results = orchestrator.detectMembers(context)
    const defaultMember = orchestrator.getDefaultMember(results)

    expect(defaultMember).toBeNull()
  })
})
