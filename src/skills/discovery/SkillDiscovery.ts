import { existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import type { ISkillManifest } from './ISkillManifest.ts'
import { SkillParser } from './SkillParser.ts'

const IGNORED_DIRS = new Set(['node_modules', '.git', '.hg', '.svn', 'dist', 'build', '.next', '.cache'])
const MAX_DEPTH = 6

export class SkillDiscovery {
  private parser = new SkillParser()
  private manifests = new Map<string, ISkillManifest>()
  private discovered = false
  private readonly defaultProjectDir: string

  constructor(projectDir: string = process.cwd()) {
    this.defaultProjectDir = projectDir
  }

  discover(projectDir: string): ISkillManifest[] {
    this.manifests.clear()
    this.discovered = true

    const scopePaths = [
      { path: join(homedir(), '.agents', 'skills'), scope: 'user' },
      { path: join(projectDir, '.agents', 'skills'), scope: 'project' },
      { path: join(projectDir, '.agenthood', 'skills'), scope: 'project' },
      { path: join(projectDir, '.claude', 'skills'), scope: 'project' },
    ]

    for (const { path: dir, scope } of scopePaths) {
      if (!existsSync(dir)) continue
      const found = this.scanDir(dir, 0)
      for (const manifest of found) {
        const key = manifest.name || manifest.directory
        if (scope === 'project') {
          this.manifests.set(key, manifest)
        } else if (!this.manifests.has(key)) {
          this.manifests.set(key, manifest)
        }
      }
    }

    return Array.from(this.manifests.values())
  }

  private ensureDiscovered(): void {
    if (!this.discovered) {
      this.discover(this.defaultProjectDir)
    }
  }

  get(name: string): ISkillManifest | undefined {
    this.ensureDiscovered()
    return this.manifests.get(name)
  }

  list(): ISkillManifest[] {
    this.ensureDiscovered()
    return Array.from(this.manifests.values())
  }

  private scanDir(dir: string, depth: number): ISkillManifest[] {
    if (depth > MAX_DEPTH) return []
    const result: ISkillManifest[] = []

    let entries: string[]
    try {
      entries = readdirSync(dir)
    } catch (err) {
      console.warn(`[SkillDiscovery] cannot read ${dir}: ${(err as Error)?.message ?? err}`)
      return []
    }

    for (const entry of entries) {
      if (IGNORED_DIRS.has(entry)) continue
      const fullPath = join(dir, entry)

      const stat = this.statPath(fullPath)
      if (!stat) continue

      if (stat.isDirectory()) {
        result.push(...this.scanEntry(fullPath, entry, depth))
      }
    }

    return result
  }

  private statPath(fullPath: string): ReturnType<typeof statSync> | undefined {
    try {
      return statSync(fullPath)
    } catch (err) {
      console.warn(`[SkillDiscovery] cannot stat ${fullPath}: ${(err as Error)?.message ?? err}`)
      return undefined
    }
  }

  private scanEntry(fullPath: string, entry: string, depth: number): ISkillManifest[] {
    const skillMdPath = join(fullPath, 'SKILL.md')
    if (existsSync(skillMdPath)) {
      const parsed = this.parser.parse(skillMdPath)
      if (!parsed) return []
      const manifest = this.parser.parseManifest(skillMdPath, fullPath, parsed.body)
      manifest.name = parsed.name || entry
      manifest.description = parsed.description
      return [manifest]
    }
    return this.scanDir(fullPath, depth + 1)
  }
}
