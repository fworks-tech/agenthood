import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  catalogEndpoint,
  catalogRef,
  loadCatalog,
  parseCatalog,
  type CatalogSource,
} from '../../../src/skills/catalog/wellKnown.ts'

const CATALOG = {
  version: 1,
  skills: [
    {
      name: 'reviewer',
      owner: 'acme',
      description: 'Reviews code.',
      version: '1.2.0',
      url: 'https://skills.test/reviewer/SKILL.md',
      integrity: 'sha256-abc',
    },
  ],
}

describe('catalogEndpoint (#522)', () => {
  it('appends the well-known suffix to a base URL', () => {
    expect(catalogEndpoint('https://skills.test')).toBe('https://skills.test/.well-known/agentskills')
    expect(catalogEndpoint('https://skills.test/')).toBe('https://skills.test/.well-known/agentskills')
  })

  it('leaves a full endpoint URL alone', () => {
    expect(catalogEndpoint('https://skills.test/.well-known/agentskills')).toBe(
      'https://skills.test/.well-known/agentskills',
    )
  })

  it('rejects a non-https or private host', () => {
    expect(() => catalogEndpoint('http://skills.test')).toThrow(/https/)
    expect(() => catalogEndpoint('https://127.0.0.1')).toThrow(/private|loopback/)
  })
})

describe('parseCatalog (#522)', () => {
  it('parses JSON', () => {
    const catalog = parseCatalog(JSON.stringify(CATALOG))
    expect(catalog.version).toBe(1)
    expect(catalog.skills[0]).toMatchObject({ name: 'reviewer', owner: 'acme', version: '1.2.0' })
  })

  it('parses the same shape as YAML', () => {
    const yaml = [
      'version: 1',
      'skills:',
      '  - name: reviewer',
      '    owner: acme',
      '    url: https://skills.test/reviewer/SKILL.md',
    ].join('\n')
    expect(parseCatalog(yaml).skills[0]).toMatchObject({ name: 'reviewer', owner: 'acme' })
  })

  it('ignores unknown fields so the schema can grow', () => {
    const withExtra = { ...CATALOG, skills: [{ ...CATALOG.skills[0], signature: 'ed25519:...' }] }
    expect(parseCatalog(JSON.stringify(withExtra)).skills[0]).not.toHaveProperty('signature')
  })

  it('rejects an unknown format version', () => {
    expect(() => parseCatalog(JSON.stringify({ ...CATALOG, version: 2 }))).toThrow(/unsupported catalog version/)
  })

  it('rejects an entry without a name or url', () => {
    expect(() => parseCatalog(JSON.stringify({ version: 1, skills: [{ url: 'https://a.test/x' }] }))).toThrow(/no "name"/)
    expect(() => parseCatalog(JSON.stringify({ version: 1, skills: [{ name: 'x' }] }))).toThrow(/no "url"/)
  })

  it('rejects an entry URL that is not https', () => {
    const bad = { version: 1, skills: [{ name: 'x', url: 'http://skills.test/x.md' }] }
    expect(() => parseCatalog(JSON.stringify(bad))).toThrow(/https/)
  })
})

describe('catalogRef (#522)', () => {
  it('shows the namespace when the catalog supplies one', () => {
    expect(catalogRef({ name: 'reviewer', owner: 'acme', url: 'https://a.test/x' })).toBe('acme/reviewer')
    expect(catalogRef({ name: 'reviewer', url: 'https://a.test/x' })).toBe('reviewer')
  })
})

describe('loadCatalog (#522)', () => {
  let cacheDir: string
  const source: CatalogSource = { url: 'https://skills.test' }

  beforeEach(() => {
    cacheDir = mkdtempSync(join(tmpdir(), 'catalog-'))
  })

  afterEach(() => {
    rmSync(cacheDir, { recursive: true, force: true })
  })

  const okFetch = async () => JSON.stringify(CATALOG)

  it('fetches, then serves the cache within the TTL', async () => {
    const first = await loadCatalog(source, { cacheDir, fetchText: okFetch })
    expect(first.origin).toBe('network')

    let calls = 0
    const second = await loadCatalog(source, {
      cacheDir,
      fetchText: async () => {
        calls++
        return JSON.stringify(CATALOG)
      },
    })
    expect(second.origin).toBe('cache')
    expect(calls).toBe(0)
  })

  it('refetches when --refresh is set', async () => {
    await loadCatalog(source, { cacheDir, fetchText: okFetch })
    const refreshed = await loadCatalog(source, { cacheDir, refresh: true, fetchText: okFetch })
    expect(refreshed.origin).toBe('network')
  })

  it('refetches once the TTL has passed', async () => {
    await loadCatalog(source, { cacheDir, fetchText: okFetch })
    const expired = await loadCatalog(source, { cacheDir, ttlSeconds: 0, fetchText: okFetch })
    expect(expired.origin).toBe('network')
  })

  it('serves a stale cache when the network fails', async () => {
    await loadCatalog(source, { cacheDir, fetchText: okFetch })
    const stale = await loadCatalog(source, {
      cacheDir,
      refresh: true,
      fetchText: async () => {
        throw new Error('offline')
      },
    })
    expect(stale.origin).toBe('stale')
    expect(stale.catalog.skills).toHaveLength(1)
  })

  it('throws when the network fails and nothing is cached', async () => {
    await expect(
      loadCatalog(source, {
        cacheDir,
        fetchText: async () => {
          throw new Error('offline')
        },
      }),
    ).rejects.toThrow(/unavailable/)
  })

  it('sends a bearer token only from the configured environment variable', async () => {
    const seen: (Record<string, string> | undefined)[] = []
    process.env.AGENTHOOD_TEST_CATALOG_TOKEN = 'secret-token'
    try {
      await loadCatalog(
        { url: 'https://skills.test', tokenEnv: 'AGENTHOOD_TEST_CATALOG_TOKEN' },
        {
          cacheDir,
          fetchText: async (_url, headers) => {
            seen.push(headers)
            return JSON.stringify(CATALOG)
          },
        },
      )
    } finally {
      delete process.env.AGENTHOOD_TEST_CATALOG_TOKEN
    }
    expect(seen[0]?.Authorization).toBe('Bearer secret-token')
  })

  it('keys the cache by endpoint, so two catalogs do not collide', async () => {
    await loadCatalog(source, { cacheDir, fetchText: okFetch })
    const other = await loadCatalog(
      { url: 'https://other.test' },
      { cacheDir, fetchText: async () => JSON.stringify({ version: 1, skills: [] }) },
    )
    expect(other.origin).toBe('network')
    expect(other.catalog.skills).toEqual([])
    expect(readdirSync(cacheDir)).toHaveLength(2)
  })
})
