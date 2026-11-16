import { describe, it, expect, vi, afterEach } from 'vitest'
import { SkillRegistryClient } from '../../../src/skills/registry/SkillRegistryClient.ts'

describe('SkillRegistryClient namespaces (#593)', () => {
  afterEach(() => vi.restoreAllMocks())

  const mock = (body: unknown, status = 200) => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: status < 400,
      status,
      statusText: status === 404 ? 'Not Found' : 'OK',
      json: async () => body,
      text: async () => String(body),
    })
    vi.stubGlobal('fetch', fetchMock)
    return fetchMock
  }

  it('addresses an owned skill as two path segments', async () => {
    const fetchMock = mock({ name: 'reviewer', version: '1.0.0' })
    await new SkillRegistryClient('https://reg.test').get('@acme/reviewer')
    expect(fetchMock.mock.calls[0][0]).toBe('https://reg.test/api/skills/acme/reviewer')
  })

  it('keeps a bare legacy name on a single segment', async () => {
    const fetchMock = mock({ name: 'reviewer', version: '1.0.0' })
    await new SkillRegistryClient('https://reg.test').get('reviewer')
    expect(fetchMock.mock.calls[0][0]).toBe('https://reg.test/api/skills/reviewer')
  })

  it('builds version and download URLs from the same reference', async () => {
    const fetchMock = mock({ versions: ['1.0.0'] })
    await new SkillRegistryClient('https://reg.test').versions('acme/reviewer')
    expect(fetchMock.mock.calls[0][0]).toBe('https://reg.test/api/skills/acme/reviewer/versions')

    await new SkillRegistryClient('https://reg.test').download('acme/reviewer', '1.0.0')
    expect(fetchMock.mock.calls[1][0]).toBe('https://reg.test/api/skills/acme/reviewer/download/1.0.0')
  })

  it('returns undefined for an unknown skill', async () => {
    mock('not found', 404)
    await expect(new SkillRegistryClient('https://reg.test').get('acme/nope')).resolves.toBeUndefined()
  })
})
