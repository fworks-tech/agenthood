import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PROVIDER_KEYS } from '../../src/llm/validateApiKeys.ts'
import { MemberRegistry } from '../../src/members/MemberRegistry.ts'

const repoRoot = join(import.meta.dirname, '..', '..')

describe('configuration samples', () => {
  const envExample = readFileSync(join(repoRoot, '.env.example'), 'utf8')
  const configExample = JSON.parse(
    readFileSync(join(repoRoot, '.agenthood', 'config.example.json'), 'utf8'),
  ) as { members: string[] }
  const gitignore = readFileSync(join(repoRoot, '.gitignore'), 'utf8')

  it('.env.example lists every provider API key', () => {
    for (const { envVar } of Object.values(PROVIDER_KEYS)) {
      expect(envExample, `${envVar} is missing from .env.example`).toContain(`${envVar}=`)
    }
  })

  it('.env.example contains no values', () => {
    const assignments = envExample
      .split('\n')
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
    expect(assignments.length).toBeGreaterThan(0)
    for (const line of assignments) {
      expect(line, `${line} carries a value`).toMatch(/^[A-Z0-9_]+=$/)
    }
  })

  it('config.example.json activates every registered member', () => {
    const registered = new MemberRegistry().list().map((spec) => spec.name)
    expect(new Set(configExample.members)).toEqual(new Set(registered))
  })

  it('.gitignore ignores env files but keeps the sample', () => {
    expect(gitignore).toMatch(/^\.env$/m)
    expect(gitignore).toMatch(/^\.env\.\*$/m)
    expect(gitignore).toMatch(/^!\.env\.example$/m)
  })
})
