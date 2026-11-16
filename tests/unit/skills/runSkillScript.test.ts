import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { runSkillScript, type RunScriptDeps } from '../../../src/skills/execution/runSkillScript.ts'
import type { ISkillManifest } from '../../../src/skills/discovery/ISkillManifest.ts'

let root: string
let skillDir: string
let projectPath: string

const manifest = (extra: Partial<ISkillManifest> = {}): ISkillManifest => ({
  name: 'demo',
  description: 'demo skill',
  tier: 'official',
  location: join(skillDir, 'SKILL.md'),
  directory: skillDir,
  body: 'body',
  resources: [],
  ...extra,
})

const deps = (overrides: Partial<RunScriptDeps> = {}): RunScriptDeps => ({
  projectPath,
  executionId: 'exec-1',
  manifests: new Map([['demo', manifest()]]),
  activeSkills: new Set(['demo']),
  sandbox: false,
  ...overrides,
})

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'skill-run-'))
  skillDir = join(root, 'skill')
  projectPath = join(root, 'project')
  mkdirSync(join(skillDir, 'scripts'), { recursive: true })
  mkdirSync(join(projectPath, '.agenthood'), { recursive: true })
  writeFileSync(join(skillDir, 'scripts', 'ok.js'), "console.log('hello from skill')")
  writeFileSync(join(skillDir, 'scripts', 'fail.js'), "console.error('boom')\nprocess.exit(2)")
  writeFileSync(join(skillDir, 'scripts', 'big.js'), "console.log('x'.repeat(40000))")
  writeFileSync(join(skillDir, 'scripts', 'tool.rb'), 'puts 1')
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('runSkillScript authorization (#607, ADR-036)', () => {
  it('refuses a skill that was not activated in this run', async () => {
    const result = await runSkillScript({ skill: 'demo', script: 'scripts/ok.js' }, deps({ activeSkills: new Set() }))
    expect(result.success).toBe(false)
    expect(result.error).toContain('not active')
  })

  it('refuses a path that escapes the skill directory', async () => {
    writeFileSync(join(root, 'outside.js'), 'console.log(1)')
    const result = await runSkillScript({ skill: 'demo', script: '../outside.js' }, deps())
    expect(result.success).toBe(false)
    expect(result.error).toContain('Path traversal')
  })

  it('refuses an unsupported language instead of guessing', async () => {
    const result = await runSkillScript({ skill: 'demo', script: 'scripts/tool.rb' }, deps())
    expect(result.success).toBe(false)
    expect(result.error).toContain('Unsupported script')
  })

  it('refuses an unpinned one-off command', async () => {
    const result = await runSkillScript({ skill: 'demo', script: 'npx cowsay hi' }, deps())
    expect(result.success).toBe(false)
    expect(result.error).toContain('Pin the version')
  })
})

describe('runSkillScript execution (#546, #544)', () => {
  it('runs a bundled script from the skill directory with a runtime header', async () => {
    const result = await runSkillScript({ skill: 'demo', script: 'scripts/ok.js' }, deps())
    expect(result.success).toBe(true)
    expect(result.output).toContain('hello from skill')
    expect(result.output).toContain('[skill_script')
    expect(result.output).toContain('exit="0"')
    expect(result.output).toContain('sandbox="host"')
  })

  it('surfaces a non-zero exit as an error, with the stderr', async () => {
    const result = await runSkillScript({ skill: 'demo', script: 'scripts/fail.js' }, deps())
    expect(result.success).toBe(false)
    expect(result.error).toContain('status 2')
    expect(result.output).toContain('boom')
  })

  it('writes large output to a file and reads it back by page', async () => {
    const result = await runSkillScript({ skill: 'demo', script: 'scripts/big.js' }, deps())
    expect(result.success).toBe(true)
    expect(result.output).toContain('Full output')
    expect(result.output).toContain('{ "page": 1 }')

    const page = await runSkillScript({ skill: 'demo', script: 'scripts/big.js', page: 1 }, deps())
    expect(page.success).toBe(true)
    expect(page.output.length).toBeGreaterThan(0)
  })

  it('appends one audit row per run', async () => {
    await runSkillScript({ skill: 'demo', script: 'scripts/ok.js' }, deps())
    const log = readFileSync(join(projectPath, '.agenthood', 'skill-exec-audit.ndjson'), 'utf8')
    const row = JSON.parse(log.trim())
    expect(row).toMatchObject({ skill: 'demo', script: 'scripts/ok.js', sandbox: 'host', exit: 0 })
  })

  it('stops a script that overruns its timeout', async () => {
    writeFileSync(join(skillDir, 'scripts', 'slow.js'), 'setTimeout(() => {}, 5000)')
    const result = await runSkillScript({ skill: 'demo', script: 'scripts/slow.js' }, deps({ timeoutMs: 300 }))
    expect(result.success).toBe(false)
    expect(result.error).toContain('timed out')
  })

  it('fails closed when sandboxing is required but Docker is absent', async () => {
    const previous = process.env.PATH
    process.env.PATH = ''
    try {
      const result = await runSkillScript(
        { skill: 'demo', script: 'scripts/ok.js' },
        deps({ manifests: new Map([['demo', manifest({ tier: 'community' })]]) }),
      )
      expect(result.success).toBe(false)
      expect(result.error).toContain('Docker is not available')
      expect(existsSync(join(projectPath, '.agenthood', 'skill-exec-audit.ndjson'))).toBe(false)
    } finally {
      process.env.PATH = previous
    }
  })
})

describe('runSkillScript output cache (#598)', () => {
  it('serves the second identical run from cache while the script is unchanged', async () => {
    const first = await runSkillScript({ skill: 'demo', script: 'scripts/ok.js' }, deps({ cacheTtlMs: 60_000 }))
    const second = await runSkillScript({ skill: 'demo', script: 'scripts/ok.js' }, deps({ cacheTtlMs: 60_000 }))

    expect(first.success).toBe(true)
    expect(first.output).not.toContain('cache="hit"')
    expect(second.output).toContain('cache="hit"')
    expect(second.output).toContain('hello from skill')
  })

  it('never serves an edited script from cache', async () => {
    await runSkillScript({ skill: 'demo', script: 'scripts/ok.js' }, deps({ cacheTtlMs: 60_000 }))
    writeFileSync(join(skillDir, 'scripts', 'ok.js'), "console.log('rewritten')")
    const second = await runSkillScript({ skill: 'demo', script: 'scripts/ok.js' }, deps({ cacheTtlMs: 60_000 }))

    expect(second.output).toContain('rewritten')
    expect(second.output).not.toContain('cache="hit"')
  })

  it('honours no_cache on an otherwise warm entry', async () => {
    await runSkillScript({ skill: 'demo', script: 'scripts/ok.js' }, deps({ cacheTtlMs: 60_000 }))
    const bypass = await runSkillScript(
      { skill: 'demo', script: 'scripts/ok.js', no_cache: true },
      deps({ cacheTtlMs: 60_000 }),
    )

    expect(bypass.output).not.toContain('cache="hit"')
  })

  it('does not cache when the TTL is unset', async () => {
    await runSkillScript({ skill: 'demo', script: 'scripts/ok.js' }, deps())
    const second = await runSkillScript({ skill: 'demo', script: 'scripts/ok.js' }, deps())
    expect(second.output).not.toContain('cache="hit"')
  })
})
