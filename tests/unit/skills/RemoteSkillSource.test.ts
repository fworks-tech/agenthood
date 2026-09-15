import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { rmSync, mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { RemoteSkillFetcher, validateRemoteUrl, type RemoteSkillSource } from '../../../src/skills/discovery/RemoteSkillSource.ts'

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

  it('rejects non-URL input', () => {
    expectBlocked('not a url')
    expectBlocked('git@github.com:org/repo.git')
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
