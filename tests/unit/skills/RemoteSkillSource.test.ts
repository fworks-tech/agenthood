import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { rmSync, mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { RemoteSkillFetcher, validateRemoteUrl, fetchRemoteText, type RemoteSkillSource } from '../../../src/skills/discovery/RemoteSkillSource.ts'

function expectBlocked(raw: string) {
  expect(() => validateRemoteUrl(raw)).toThrow()
}

describe('validateRemoteUrl', () => {
  it('accepts public https URLs (href-normalized)', () => {
    expect(validateRemoteUrl('https://skills.sh/a/SKILL.md')).toBe('https://skills.sh/a/SKILL.md')
    expect(validateRemoteUrl('https://8.8.8.8/raw.md')).toBe('https://8.8.8.8/raw.md')
    expect(validateRemoteUrl('https://172.32.0.1/x')).toBe('https://172.32.0.1/x')
  })

  it('rejects non-https schemes (http, file, ftp, ssh)', () => {
    expectBlocked('http://skills.sh/a/SKILL.md')
    expectBlocked('file:///c/Github/agenthood/SKILL.md')
    expectBlocked('ftp://skills.sh/a/SKILL.md')
  })

  it('rejects embedded credentials', () => {
    expectBlocked('https://user:pass@skills.sh/a/SKILL.md')
  })

  it('rejects loopback and IPv6 literal hosts', () => {
    expectBlocked('https://localhost/a.md')
    expectBlocked('https://sub.localhost/a.md')
    expectBlocked('https://[::1]/a.md')
  })

  it('rejects private and reserved IPv4 literal hosts', () => {
    for (const host of ['0.0.9.0', '10.1.2.3', '127.0.0.1', '169.254.169.254', '172.16.0.9', '172.31.255.255', '192.168.1.10', '100.64.0.1']) {
      expectBlocked(`https://${host}/a.md`)
    }
  })

  it('canonicalizes and rejects non-dotted IPv4 encodings of loopback', () => {
    // WHATWG URL canonicalizes decimal/shorthand/hex/octal IPv4 forms to
    // dotted quads, so the loopback form is caught by the range check
    for (const host of ['2130706433', '127.1', '127.0.1', '0x7f000001', '017700000001', '0177.0.0.1', '0x7f.0.0.1']) {
      expectBlocked(`https://${host}/a.md`)
    }
    // Shorthand/hex forms of PUBLIC addresses normalize and pass
    expect(validateRemoteUrl('https://16843009/a.md')).toBe('https://1.1.1.1/a.md')
    expect(validateRemoteUrl('https://1.2/a.md')).toBe('https://1.0.0.2/a.md')
  })

  it('rejects non-URL input', () => {
    expectBlocked('not a url')
    expectBlocked('git@github.com:org/repo.git')
  })
})

describe('fetchRemoteText', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns the body of a successful response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('skill body', { status: 200 })))
    await expect(fetchRemoteText('https://skills.sh/a/SKILL.md')).resolves.toBe('skill body')
  })

  it('follows a redirect chain while re-validating each hop', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 301, headers: { location: 'https://cdn.example.com/b/SKILL.md' } }))
      .mockResolvedValueOnce(new Response('redirected body', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    await expect(fetchRemoteText('https://skills.sh/a/SKILL.md')).resolves.toBe('redirected body')
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[1][0]).toBe('https://cdn.example.com/b/SKILL.md')
  })

  it('throws when a redirect lands on a private target mid-chain', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, {
      status: 302,
      headers: { location: 'https://2130706433/a.md' },
    })))
    await expect(fetchRemoteText('https://skills.sh/a/SKILL.md')).rejects.toThrow('private or reserved')
  })

  it('rejects oversized bodies even with a missing content-length header', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('x'.repeat(1_048_577), { status: 200 })))
    await expect(fetchRemoteText('https://skills.sh/a/SKILL.md')).resolves.toBeUndefined()
  })

  it('gives up after the redirect limit without following hop four', async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(new Response(null, {
      status: 302,
      headers: { location: 'https://skills.sh/next/SKILL.md' },
    })))
    vi.stubGlobal('fetch', fetchMock)
    await expect(fetchRemoteText('https://skills.sh/a/SKILL.md')).resolves.toBeUndefined()
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })
})

describe('RemoteSkillFetcher SSRF fences', () => {
  let projectDir: string

  beforeEach(() => {
    projectDir = mkdtempSync(join(tmpdir(), 'agenthood-remote-'))
  })

  afterEach(() => {
    rmSync(projectDir, { recursive: true, force: true })
  })

  it('refuses private-url sources without touching the network', async () => {
    const fetcher = new RemoteSkillFetcher(projectDir)
    const sources: RemoteSkillSource[] = [
      { url: 'http://169.254.169.254/latest/meta-data/' },
      { git: 'https://10.0.0.1/org/repo.git' },
      { url: 'https://localhost/a.md' },
    ]
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    for (const source of sources) {
      await expect(fetcher.fetch(source)).resolves.toBeUndefined()
    }
    expect(warnSpy).toHaveBeenCalled()
    warnSpy.mockRestore()
  })

  it('does not follow redirects past the validation gate', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, {
      status: 302,
      headers: { location: 'http://169.254.169.254/latest/meta-data/' },
    }))
    vi.stubGlobal('fetch', fetchMock)
    try {
      const fetcher = new RemoteSkillFetcher(projectDir)
      await expect(fetcher.fetch({ url: 'https://skills.sh/a/SKILL.md' })).resolves.toBeUndefined()
      expect(fetchMock).toHaveBeenCalledTimes(1)
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
