import { describe, it, expect, afterEach } from 'vitest'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { applyDedup, planDedup } from '../../../src/skills/dedup.ts'

const made: string[] = []
function root(): string {
  const dir = mkdtempSync(join(tmpdir(), 'dedup-'))
  made.push(dir)
  return dir
}

afterEach(() => {
  for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true })
})

function put(rootDir: string, name: string, version: string | undefined, body: string): string {
  const dir = join(rootDir, name)
  mkdirSync(dir, { recursive: true })
  const meta = version ? `metadata:\n  version: ${version}\n` : ''
  writeFileSync(join(dir, 'SKILL.md'), `---\nname: ${name}\ndescription: ${name} skill\n${meta}---\n${body}`)
  return dir
}

describe('cross-location skill dedup (#616)', () => {
  it('detects a duplicate installed in three locations', () => {
    const user = root()
    const projectA = root()
    const projectB = root()
    put(user, 'shared', '1.0.0', 'user body')
    put(projectA, 'shared', '2.0.0', 'project body v2')
    put(projectB, 'shared', '1.5.0', 'project body v1.5')

    const plan = planDedup([
      { path: user, scope: 'user' },
      { path: projectA, scope: 'project' },
      { path: projectB, scope: 'project' },
    ])

    expect(plan.groups).toHaveLength(1)
    const group = plan.groups[0]
    expect(group.name).toBe('shared')
    expect(group.copies.map((copy) => copy.scope)).toEqual(['user', 'project', 'project'])
    expect(group.action).toBe('merge')
    expect(group.winner?.directory).toBe(join(projectA, 'shared'))
    expect(group.losers).toHaveLength(2)
    expect(plan.savedTokens).toBeGreaterThan(0)
  })

  it('does not resolve a version tie with different contents', () => {
    const projectA = root()
    const projectB = root()
    put(projectA, 'shared', '1.0.0', 'body from A')
    put(projectB, 'shared', '1.0.0', 'body from B')
    const projectDir = root()

    const plan = planDedup([
      { path: projectA, scope: 'project' },
      { path: projectB, scope: 'project' },
    ])
    expect(plan.groups[0].action).toBe('conflict')
    expect(plan.groups[0].winner).toBeUndefined()
    expect(plan.savedTokens).toBe(0)

    const result = applyDedup(plan, projectDir)
    expect(result.conflicts).toHaveLength(1)
    expect(result.removed).toHaveLength(0)
    expect(existsSync(join(projectA, 'shared'))).toBe(true)
    expect(existsSync(join(projectB, 'shared'))).toBe(true)
    expect(existsSync(join(projectDir, '.agenthood', 'dedup'))).toBe(false)
  })

  it('is idempotent: the second merge changes nothing', () => {
    const project = root()
    const user = root()
    put(project, 'shared', '2.0.0', 'newer body')
    put(user, 'shared', '1.0.0', 'older body')
    const roots = [
      { path: project, scope: 'project' as const },
      { path: user, scope: 'user' as const },
    ]

    const first = applyDedup(planDedup(roots), project)
    expect(first.removed).toHaveLength(1)
    const diffAfterFirst = readFileSync(first.diffPath as string, 'utf8')

    const secondPlan = planDedup(roots)
    expect(secondPlan.groups).toHaveLength(0)
    const second = applyDedup(secondPlan, project)
    expect(second.removed).toHaveLength(0)
    expect(readFileSync(first.diffPath as string, 'utf8')).toBe(diffAfterFirst)
    expect(existsSync(join(project, 'shared'))).toBe(true)
    expect(existsSync(join(user, 'shared'))).toBe(false)
  })

  it('never mutates without the merge flag', () => {
    const project = root()
    const user = root()
    put(project, 'shared', '1.0.0', 'project body')
    put(user, 'shared', '1.0.0', 'user body')
    const projectDir = root()

    const plan = planDedup([
      { path: project, scope: 'project' },
      { path: user, scope: 'user' },
    ])
    expect(plan.groups).toHaveLength(1)
    expect(existsSync(join(project, 'shared', 'SKILL.md'))).toBe(true)
    expect(existsSync(join(user, 'shared', 'SKILL.md'))).toBe(true)
    expect(existsSync(join(projectDir, '.agenthood'))).toBe(false)
  })

  it('writes the diff to disk before removing the losing copy', () => {
    const project = root()
    const user = root()
    put(project, 'shared', '2.0.0', 'kept body')
    put(user, 'shared', '1.0.0', 'removed body')
    const projectDir = root()

    const result = applyDedup(
      planDedup([
        { path: project, scope: 'project' },
        { path: user, scope: 'user' },
      ]),
      projectDir,
    )

    expect(result.removed).toHaveLength(1)
    const diff = readFileSync(result.diffPath as string, 'utf8')
    expect(diff).toContain(join(user, 'shared'))
    expect(diff).toContain('-removed body')
    expect(diff).toContain('+kept body')
  })
})
