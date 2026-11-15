import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { resolveInsideProject } from '../../../src/tools/pathGuard.ts'

describe('resolveInsideProject', () => {
  let root: string
  let sibling: string

  beforeEach(() => {
    const base = mkdtempSync(join(tmpdir(), 'agenthood-guard-'))
    root = join(base, 'proj')
    sibling = join(base, 'proj-evil')
    mkdirSync(root)
    mkdirSync(sibling)
    writeFileSync(join(sibling, 'secret.txt'), 'leaked')
  })

  afterEach(() => {
    rmSync(join(root, '..'), { recursive: true, force: true })
  })

  it('allows a path inside the project', async () => {
    const result = await resolveInsideProject(root, 'src/index.ts')
    expect(result).toEqual({ ok: true, path: join(root, 'src', 'index.ts') })
  })

  it('rejects a parent-directory escape', async () => {
    const result = await resolveInsideProject(root, '../outside.txt')
    expect(result.ok).toBe(false)
  })

  it('rejects a sibling directory that shares the project prefix', async () => {
    const result = await resolveInsideProject(root, '../proj-evil/secret.txt')
    expect(result.ok).toBe(false)
  })

  it('rejects a symlink pointing outside the project', async () => {
    symlinkSync(join(sibling, 'secret.txt'), join(root, 'link.txt'))
    const result = await resolveInsideProject(root, 'link.txt')
    expect(result.ok).toBe(false)
  })

  it('does not treat a missing file as a guard failure', async () => {
    const result = await resolveInsideProject(root, 'not-created-yet.txt')
    expect(result.ok).toBe(true)
  })
})
