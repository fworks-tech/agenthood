import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
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

  private async fetchFromUrl(url: string): Promise<string | undefined> {
    const response = await fetch(url)
    if (!response.ok) return undefined
    return await response.text()
  }

  private fetchFromGit(url: string, path?: string): string | undefined {
    const tmpDir = join(this.cacheDir, '.git-tmp')
    try {
      execFileSync('git', ['clone', '--depth', '1', url, tmpDir], { stdio: 'pipe' })

      const skillMdPath = path
        ? join(tmpDir, path, 'SKILL.md')
        : join(tmpDir, 'SKILL.md')

      if (!existsSync(skillMdPath)) {
        // Try to find SKILL.md in subdirectories
        const { readdirSync } = require('node:fs') as typeof import('node:fs')
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
        const { rmSync } = require('node:fs') as typeof import('node:fs')
        rmSync(tmpDir, { recursive: true, force: true })
      }
    }
  }

  private getCacheKey(source: RemoteSkillSource): string {
    const raw = source.url ?? source.git ?? 'unknown'
    return Buffer.from(raw).toString('base64url').slice(0, 32)
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
