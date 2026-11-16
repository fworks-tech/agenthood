import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const repoRoot = join(import.meta.dirname, '..', '..')
const { exports } = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8')) as {
  exports: Record<string, string>
}

describe('package exports, programmatic subpaths (#739)', () => {
  it('exposes the llm and core barrels the Studio/site consume', () => {
    expect(exports['./dist/llm']).toBe('./dist/llm/index.js')
    expect(exports['./dist/llm/LLMRouter.js']).toBe('./dist/llm/LLMRouter.js')
    expect(exports['./dist/core']).toBe('./dist/core/index.js')
  })

  it('points each newly exposed barrel at a source file that exists', () => {
    expect(existsSync(join(repoRoot, 'src', 'llm', 'index.ts'))).toBe(true)
    expect(existsSync(join(repoRoot, 'src', 'core', 'index.ts'))).toBe(true)
  })

  it('exposes the member registry and types for host runtimes (#1040)', () => {
    expect(exports['./dist/members/MemberRegistry.js']).toBe('./dist/members/MemberRegistry.js')
    expect(exports['./dist/members/types.js']).toBe('./dist/members/types.js')
    expect(existsSync(join(repoRoot, 'src', 'members', 'MemberRegistry.ts'))).toBe(true)
    expect(existsSync(join(repoRoot, 'src', 'members', 'types.ts'))).toBe(true)
  })

  it('keeps the exports map lockdown, no wildcard subpaths', () => {
    const wildcards = Object.keys(exports).filter((key) => key.includes('*'))
    expect(wildcards).toEqual([])
  })
})
