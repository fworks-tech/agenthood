import { existsSync, readFileSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { execFileSync } from 'node:child_process'
import type { ISkillManifest } from '../discovery/ISkillManifest.ts'
import { SkillParser } from '../discovery/SkillParser.ts'

export interface RemoteSkillSource {
  url?: string
  git?: string
  path?: string
  name?: string
}

interface CacheEntry {
  manifest: ISkillManifest
  cachedAt: string
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours
const REDIRECT_LIMIT = 3
const REDIRECT_STATUSES = [301, 302, 303, 307, 308]
const GIT_TIMEOUT_MS = 60_000
const MAX_REMOTE_BODY_BYTES = 1_048_576

/**
 * Only https to public hostname resolvers — blocks http, file (local read),
 * credentials in URL, localhost, IPv6 literals, and IPv4 literals in
 * private/reserved ranges (SSRF).
 * ponytail: DNS rebinding between validate() and fetch is not closed — host
 * pinning via resolve4 + SNI check if a hosted multi-tenant service ever
 * exposes discoverRemote to user input.
 */
export function validateRemoteUrl(raw: string): string {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new Error(`invalid remote skill URL: ${raw}`)
  }
  if (url.protocol !== 'https:') throw new Error(`remote skill URLs must use https: ${raw}`)
  if (url.username || url.password) throw new Error(`remote skill URLs must not embed credentials: ${raw}`)
  const host = url.hostname.toLowerCase()
  if (host === 'localhost' || host.endsWith('.localhost')) {
    throw new Error(`remote skill URLs must not target loopback hosts: ${raw}`)
  }
  if (host.includes(':')) {
    throw new Error(`remote skill URLs must use hostnames, not IPv6 literals: ${raw}`)
  }
  throwIfPrivateIPv4(host, raw)
  return url.href
}

function throwIfPrivateIPv4(host: string, raw: string): void {
  const parts = host.split('.')
  // Not an IPv4 literal — hostnames pass through; malformed literals like
  // 10.0.0.999 or 999.1.1.1 also pass, but they parse to nothing dangerous
  // (no resolvable private range) and fail fetch naturally.
  if (parts.length !== 4 || parts.some((p) => !/^\d+$/.test(p))) return
  const [a, b] = parts.map(Number)
  if (a > 255 || b > 255) return
  const blocked =
    a === 0 || a === 10 || a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0) ||
    (a === 192 && b === 168) ||
    (a === 198 && b >= 18 && b <= 19) ||
    (a === 100 && b >= 64 && b <= 127) ||
    a >= 224
  if (blocked) throw new Error(`remote skill URLs must not target private or reserved addresses: ${raw}`)
}

export class RemoteSkillFetcher {
  private readonly cacheDir: string
  private readonly parser = new SkillParser()

  constructor(projectDir: string) {
    this.cacheDir = join(projectDir, '.agenthood', 'skills-cache')
    if (!existsSync(this.cacheDir)) {
      mkdirSync(this.cacheDir, { recursive: true })
    }
  }

  async fetch(source: RemoteSkillSource): Promise<ISkillManifest | undefined> {
    const cacheKey = this.getCacheKey(source)
    const cached = this.loadFromCache(cacheKey)
    if (cached) return cached

    try {
      let skillMd: string | undefined

      if (source.url) {
        skillMd = await this.fetchFromUrl(source.url)
      } else if (source.git) {
        skillMd = this.fetchFromGit(source.git, source.path)
      }

      if (!skillMd) return undefined

      const { frontmatter } = this.parser.parseRaw(skillMd)
      const name = source.name ?? (frontmatter?.name as string) ?? 'unknown'
      const description = (frontmatter?.description as string) ?? ''
      const tier = this.parser.parseTier(frontmatter)

      const manifest: ISkillManifest = {
        name,
        description,
        tier,
        location: source.url ?? source.git ?? 'remote',
        directory: '',
        body: skillMd,
        resources: [],
      }

      this.saveToCache(cacheKey, manifest)
      return manifest
    } catch (err) {
      console.warn(`[RemoteSkillFetcher] failed to fetch skill: ${(err as Error)?.message ?? err}`)
      return undefined
    }
  }

  private async fetchFromUrl(raw: string): Promise<string | undefined> {
    // redirect:'manual' — every hop is re-validated, so a public host cannot
    // bounce the request to an internal address.
    let href = validateRemoteUrl(raw)
    for (let hops = 0; hops < REDIRECT_LIMIT; hops++) {
      const response = await fetch(href, { redirect: 'manual' })
      if (response.ok) {
        const length = Number(response.headers.get('content-length') ?? '0')
        if (length > MAX_REMOTE_BODY_BYTES) return undefined
        const text = await response.text()
        // A missing content-length header skips the header check above —
        // the decoded body is the enforceable boundary, never trust the header alone.
        if (text.length > MAX_REMOTE_BODY_BYTES) return undefined
        return text
      }
      const location = response.headers.get('location')
      if (!location || !REDIRECT_STATUSES.includes(response.status)) return undefined
      href = validateRemoteUrl(new URL(location, href).href)
    }
    return undefined
  }

  private fetchFromGit(raw: string, path?: string): string | undefined {
    const url = validateRemoteUrl(raw)
    const tmpDir = join(this.cacheDir, '.git-tmp')
    try {
      // GIT_TERMINAL_PROMPT=0 and empty credential.helper keep the clone from
      // hanging on auth prompts or popping credential dialogs on a hostile host.
      execFileSync('git', ['-c', 'credential.helper=', 'clone', '--depth', '1', url, tmpDir], {
        stdio: 'pipe',
        env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
        timeout: GIT_TIMEOUT_MS,
      })

      const skillMdPath = path
        ? join(tmpDir, path, 'SKILL.md')
        : join(tmpDir, 'SKILL.md')
      if (relative(tmpDir, skillMdPath).startsWith('..')) return undefined

      if (!existsSync(skillMdPath)) {
        // Try to find SKILL.md in subdirectories
        for (const entry of readdirSync(tmpDir, { withFileTypes: true })) {
          if (entry.isDirectory()) {
            const sub = join(tmpDir, entry.name, 'SKILL.md')
            if (existsSync(sub)) return readFileSync(sub, 'utf-8')
          }
        }
        return undefined
      }

      return readFileSync(skillMdPath, 'utf-8')
    } catch {
      return undefined
    } finally {
      if (existsSync(tmpDir)) {
        rmSync(tmpDir, { recursive: true, force: true })
      }
    }
  }

  private getCacheKey(source: RemoteSkillSource): string {
    const raw = source.url ?? source.git ?? 'unknown'
    return Buffer.from(raw).toString('base64url')
  }

  private loadFromCache(key: string): ISkillManifest | undefined {
    const path = join(this.cacheDir, `${key}.json`)
    if (!existsSync(path)) return undefined
    try {
      const entry = JSON.parse(readFileSync(path, 'utf-8')) as CacheEntry
      if (Date.now() - new Date(entry.cachedAt).getTime() > CACHE_TTL_MS) {
        return undefined
      }
      return entry.manifest
    } catch {
      return undefined
    }
  }

  private saveToCache(key: string, manifest: ISkillManifest): void {
    const path = join(this.cacheDir, `${key}.json`)
    const entry: CacheEntry = { manifest, cachedAt: new Date().toISOString() }
    writeFileSync(path, JSON.stringify(entry, null, 2) + '\n', 'utf-8')
  }
}
