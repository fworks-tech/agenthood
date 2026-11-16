import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { ManifestCache, clearSkillCaches, readMetadataStats } from '../../../src/skills/discovery/manifestCache.ts'

let dir: string
let file: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'manifest-cache-'))
  file = join(dir, 'SKILL.md')
  writeFileSync(file, 'first')
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('ManifestCache (#614, #617)', () => {
  it('misses on the first run and hits on the next', () => {
    const first = new ManifestCache<string>(dir)
    expect(first.lookup(file)).toBeUndefined()
    first.remember(file, 'parsed')
    first.persist()

    expect(new ManifestCache<string>(dir).lookup(file)?.value).toBe('parsed')
  })

  it('invalidates on a size change', () => {
    const cache = new ManifestCache<string>(dir)
    cache.remember(file, 'parsed')
    cache.persist()

    writeFileSync(file, 'a longer body')
    expect(new ManifestCache<string>(dir).lookup(file)).toBeUndefined()
  })

  it('invalidates on an mtime change even when the size is identical', () => {
    const cache = new ManifestCache<string>(dir)
    cache.remember(file, 'parsed')
    cache.persist()

    const later = new Date(Date.now() + 60_000)
    utimesSync(file, later, later)
    expect(new ManifestCache<string>(dir).lookup(file)).toBeUndefined()
  })

  it('drops entries it did not see, so a deleted skill does not linger', () => {
    const other = join(dir, 'other.md')
    writeFileSync(other, 'other')
    const cache = new ManifestCache<string>(dir)
    cache.remember(file, 'one')
    cache.remember(other, 'two')
    cache.persist()
    expect(readMetadataStats(dir).entries).toBe(2)

    const second = new ManifestCache<string>(dir)
    second.lookup(file)
    second.persist()
    expect(readMetadataStats(dir).entries).toBe(1)
  })

  it('clears the metadata and output caches', () => {
    const cache = new ManifestCache<string>(dir)
    cache.remember(file, 'parsed')
    cache.persist()
    clearSkillCaches(dir)
    expect(readMetadataStats(dir).entries).toBe(0)
  })
})
