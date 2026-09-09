import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import type { ISkillManifest } from './ISkillManifest.ts'
import { SkillParser } from './SkillParser.ts'
import { RemoteSkillFetcher, type RemoteSkillSource } from './RemoteSkillSource.ts'
import { checkSkillIntegrity } from '../../utils/skillIntegrity.ts'

const IGNORED_DIRS = new Set(['node_modules', '.git', '.hg', '.svn', 'dist', 'build', '.next', '.cache'])
const MAX_DEPTH = 6

export class SkillDiscovery {
  private parser = new SkillParser()
  private manifests = new Map<string, ISkillManifest>()
  private discovered = false
  private readonly defaultProjectDir: string
  private remoteFetcher?: RemoteSkillFetcher

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

  async discoverRemote(sources: RemoteSkillSource[]): Promise<ISkillManifest[]> {
    if (!this.remoteFetcher) {
      this.remoteFetcher = new RemoteSkillFetcher(this.defaultProjectDir)
    }

    const remoteManifests: ISkillManifest[] = []
    for (const source of sources) {
      const manifest = await this.remoteFetcher.fetch(source)
      if (manifest) {
        this.manifests.set(manifest.name, manifest)
        remoteManifests.push(manifest)
      }
    }
    return remoteManifests
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
      // dangling symlinks (statSync ENOENT) are an expected condition, not a defect
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return undefined
      console.warn(`[SkillDiscovery] cannot stat ${fullPath}: ${(err as Error)?.message ?? err}`)
      return undefined
    }
  }

  private scanEntry(fullPath: string, entry: string, depth: number): ISkillManifest[] {
    const skillMdPath = join(fullPath, 'SKILL.md')
    if (existsSync(skillMdPath)) {
      const parsed = this.parser.parse(skillMdPath)
      if (!parsed) return []
      const content = readFileSync(skillMdPath, 'utf-8')
      const { frontmatter } = this.parser.parseRaw(content)
      const tier = this.parser.parseTier(frontmatter)
      const manifest = this.parser.parseManifest(skillMdPath, fullPath, parsed.body, parsed.name || entry, parsed.description, tier)
      this.verifyIntegrity(parsed.name || entry, skillMdPath)
      return [manifest]
    }
    return this.scanDir(fullPath, depth + 1)
  }

  private verifyIntegrity(member: string, skillPath: string): void {
    const status = checkSkillIntegrity(member, skillPath)
    if (status === 'clean') return
    const guidance: Record<string, string> = {
      corrupt: 'verify the lockfile before running.',
      drift: 'verify its content before running. Run `agenthood verify --update-lock` if the edit is intentional.',
      'no-lockfile': 'the integrity gate is OFF. Run `agenthood verify` to lock SKILL.md hashes.',
      missing: 'cannot verify integrity.',
    }
    console.warn(`[skill-integrity] ${member}: ${status} — ${guidance[status]}`)
  }
}
