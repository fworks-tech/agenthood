import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadProjectEnv } from '../../../src/core/projectEnv.ts'

function envFile(content: string): string {
  const path = join(mkdtempSync(join(tmpdir(), 'agenthood-env-')), '.env')
  writeFileSync(path, content)
  return path
}

describe('loadProjectEnv', () => {
  it('overrides an inherited variable with the project value', () => {
    const env: NodeJS.ProcessEnv = { OPENCODE_API_KEY: 'host-key', KEEP: '1' }
    loadProjectEnv(envFile('OPENCODE_API_KEY=project-key\nQUOTED="a b"\n'), env)
    expect(env.OPENCODE_API_KEY).toBe('project-key')
    expect(env.QUOTED).toBe('a b')
    expect(env.KEEP).toBe('1')
  })

  it('ignores a missing file', () => {
    const env: NodeJS.ProcessEnv = { KEEP: '1' }
    loadProjectEnv(join(tmpdir(), 'agenthood-missing-env-file'), env)
    expect(env).toEqual({ KEEP: '1' })
  })
})
