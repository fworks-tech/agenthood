import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, existsSync, mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { TokenCounter } from '../../../src/core/TokenCounter.ts'
import { compressSkillBody, stripProcess, SkillBudget, SKILL_BUDGET_RATIO } from '../../../src/skills/activation/SkillBudget.ts'
import { ActivateSkillTool } from '../../../src/skills/activation/ActivateSkillTool.ts'
import type { ISkillManifest } from '../../../src/skills/discovery/ISkillManifest.ts'
import type { ExecutionContext } from '../../../src/core/ExecutionContext.ts'

const SKILLS_DIR = join(process.cwd(), 'skills')

function readMember(name: string): string {
  return readFileSync(join(SKILLS_DIR, name, 'SKILL.md'), 'utf-8')
}

/** Body as SkillParser hands it over: frontmatter already stripped. */
function bodyOf(name: string): string {
  return readMember(name).replace(/^---\n[\s\S]*?\n---\n?/, '').trim()
}

const MEMBERS = readdirSync(SKILLS_DIR)
  .filter((d) => existsSync(join(SKILLS_DIR, d, 'SKILL.md')))
  .sort()

/** Non-empty lines of one `## ` section. */
function sectionOf(body: string, name: string): string[] {
  const lines = body.split('\n')
  const start = lines.findIndex((l) => new RegExp(`^##\\s+${name}\\s*$`, 'i').test(l))
  if (start < 0) return []
  const end = lines.findIndex((l, i) => i > start && /^##\s+/.test(l))
  return lines.slice(start, end < 0 ? undefined : end).filter((l) => l.trim())
}

describe('compressSkillBody', () => {
  it('keeps everything outside ## Process verbatim', () => {
    const body = bodyOf('the-scribe')
    const squeezed = compressSkillBody(body)

    for (const section of ['Overview', 'When to Use', 'Red Flags', 'Verification']) {
      expect(sectionOf(body, section).length).toBeGreaterThan(0)
      expect(sectionOf(squeezed, section)).toEqual(sectionOf(body, section))
    }
  })

  it('keeps the first line of each Process step and drops the elaboration', () => {
    const body = bodyOf('the-scribe')
    const squeezed = compressSkillBody(body)

    const before = sectionOf(body, 'Process').length
    const after = sectionOf(squeezed, 'Process').length
    expect(after).toBeLessThan(before)
    expect(sectionOf(squeezed, 'Process').join('\n')).toContain('### Writing a Commit Message')
    expect(sectionOf(squeezed, 'Process').join('\n')).toMatch(/^\d+\. /m)
    expect(squeezed).toContain('skill-budget')
    expect(squeezed.length).toBeLessThan(body.length)
  })

  it('reports what each degradation step is actually worth', () => {
    // Level 1 is a gentle squeeze, because a step-dense member loses little:
    // the Scribe's Process is mostly numbered steps, and those are the
    // instruction. Level 2 is the real lever. Measured, not aspirational.
    const counter = new TokenCounter()
    const body = bodyOf('the-scribe')

    const full = counter.countTokens(body)
    const level1 = counter.countTokens(compressSkillBody(body))
    const level2 = counter.countTokens(stripProcess(body))

    expect(level1).toBeLessThan(full)
    expect(level2).toBeLessThan(level1 * 0.5)
  })

  it('drops Process entirely but keeps the rest when the budget is exhausted', () => {
    const body = bodyOf('the-scribe')
    const stripped = stripProcess(body)

    expect(sectionOf(stripped, 'Process').length).toBe(0)
    for (const section of ['Overview', 'When to Use', 'Red Flags', 'Verification']) {
      const withoutNotices = sectionOf(stripped, section).filter((l) => !l.includes('skill-budget'))
      expect(withoutNotices).toEqual(sectionOf(body, section))
    }
  })

  it('still returns a usable body when there is no ## Process', () => {
    const body = '# Title\n\nSome content with no process section.\n'
    expect(compressSkillBody(body).trim()).toBe(body.trim())
  })

  it('does not mistake a similarly named heading for ## Process', () => {
    const body = '## Processing Notes\n\n1. keep me\n'
    expect(compressSkillBody(body).trim()).toBe(body.trim())
  })
})

describe('SkillBudget', () => {
  it('leaves a body alone while the budget has room', () => {
    const budget = new SkillBudget(undefined, 128000)
    const body = bodyOf('the-scribe')
    const fit = budget.fit(body)

    expect(fit.compressed).toBe(false)
    expect(fit.body).toBe(body)
  })

  it('compresses once the running total passes the ratio', () => {
    // 8192 is ContextCompressor's default and a real small-model window.
    const budget = new SkillBudget(undefined, 8192)
    let compressedAt = -1

    MEMBERS.forEach((name, i) => {
      const fit = budget.fit(bodyOf(name))
      if (fit.compressed && compressedAt < 0) compressedAt = i
    })

    expect(compressedAt).toBeGreaterThanOrEqual(0)
  })

  it('keeps 10+ members inside the window — the acceptance criterion', () => {
    const budget = new SkillBudget(undefined, 8192)

    for (const name of MEMBERS.slice(0, 12)) budget.fit(bodyOf(name))

    expect(budget.consumed).toBeLessThanOrEqual(budget.limit)
    expect(budget.limit).toBe(Math.floor(8192 * SKILL_BUDGET_RATIO))
  })

  it('clamps rather than overflowing when even the compressed body is too big', () => {
    const budget = new SkillBudget(undefined, 512)
    const fit = budget.fit(bodyOf('the-reviewer'))

    expect(fit.compressed).toBe(true)
    expect(fit.body).toContain('skill-budget')
    expect(fit.body.length).toBeLessThan(bodyOf('the-reviewer').length)
  })
})

describe('ActivateSkillTool budget wiring', () => {
  function manifestFor(name: string): ISkillManifest {
    return {
      name,
      description: 'test',
      tier: 'official',
      location: join(SKILLS_DIR, name),
      directory: join(SKILLS_DIR, name),
      body: bodyOf(name),
      resources: [],
    }
  }

  const context = {
    project: { localPath: mkdtempSync(join(tmpdir(), 'skill-budget-')) },
  } as unknown as ExecutionContext

  it('injects the full body and no notice when there is room', async () => {
    const tool = new ActivateSkillTool(new Map([['the-scribe', manifestFor('the-scribe')]]), 128000)
    const result = await tool.execute({ skill_name: 'the-scribe' }, context)

    expect(result.success).toBe(true)
    expect(result.output).toContain(manifestFor('the-scribe').body)
    expect(result.output).not.toContain('skill_budget')
  })

  it('compresses and says so when the window is small', async () => {
    const tool = new ActivateSkillTool(new Map([['the-reviewer', manifestFor('the-reviewer')]]), 2048)
    const result = await tool.execute({ skill_name: 'the-reviewer' }, context)

    expect(result.success).toBe(true)
    expect(result.output).toContain('<skill_budget>')
    expect(result.output).toContain('## Red Flags')
    expect(result.output).toContain('Skill directory:')
  })
})
