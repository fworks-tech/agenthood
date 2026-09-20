import { Dirent, existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { isAbsolute, join, relative } from 'node:path'
import { homedir } from 'node:os'
import type { ISkillManifest } from './ISkillManifest.ts'
import { SkillParser } from './SkillParser.ts'
import { RemoteSkillFetcher, type RemoteSkillSource } from './RemoteSkillSource.ts'
import { checkSkillIntegrity } from '../../utils/skillIntegrity.ts'
import { MEMBERS_DIR } from '../../members/MemberRegistry.ts'

const IGNORED_DIRS = new Set(['node_modules', '.git', '.hg', '.svn', 'dist', 'build', '.next', '.cache'])
const MAX_DEPTH = 6

// The packaged skills dir inside the installed package is the versioned trust
// root — the lockfile integrity gate applies only to user/project dirs, which
// is decided by location (isPackagedDir), not by a caller-threaded flag.
function isPackagedDir(fullPath: string): boolean {
  const rel = relative(MEMBERS_DIR, fullPath)
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel)
}

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
      { path: join(projectDir, 'skills'), scope: 'project' },
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
    // Populate local manifests first — a later get()/list() would otherwise
    // trigger discover() and clear() over the remote entries.
    this.ensureDiscovered()
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

  /**
   * Packaged tool skills shipped in the Society's own skills/ directory.
   * Lowest precedence by design: callers merge these under user/project
   * results so a local skill with the same name wins. Member skills
   * (the-*) and _shared are excluded — members load via MemberRegistry.
   * The lockfile integrity gate does not apply here: the versioned package
   * tarball is the trust root, and there is no project lockfile entry for
   * packaged files. Kept separate from discover() so publish/verify/MCP
   * keep their project-scoped behavior.
   */
  discoverPackaged(): ISkillManifest[] {
    const result: ISkillManifest[] = []

    let entries: Dirent[]
    // readdirSync ENOENT (no packaged dir in stripped installs) is caught by
    // the try below — no existsSync guard needed.
    try {
      entries = readdirSync(MEMBERS_DIR, { withFileTypes: true })
    } catch {
      return []
    }

    for (const entry of entries) {
      if (entry.name.startsWith('the-') || entry.name === '_shared') continue
      if (entry.isSymbolicLink()) continue
      const fullPath = join(MEMBERS_DIR, entry.name)
      if (!entry.isDirectory()) continue
      result.push(...this.scanEntry(fullPath, entry.name, 0))
    }

    return result
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
      const packaged = isPackagedDir(fullPath)
      if (!packaged) this.verifyIntegrity(parsed.name || entry, skillMdPath)
      // A packaged file whose frontmatter name disagrees with its directory
      // entry could shadow a lockfile-pinned manifest with no gate — drop it.
      // (SkillParser falls back to the file path when name is missing, so a
      // missing name also lands here and surfaces in the warning.)
      if (packaged && parsed.name !== entry) {
        console.warn(`[SkillDiscovery] packaged "${entry}" dropped: frontmatter name "${parsed.name}" mismatches directory`)
        return []
      }
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
