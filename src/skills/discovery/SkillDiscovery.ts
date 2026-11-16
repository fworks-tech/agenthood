import { Dirent, existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { isAbsolute, join, relative } from 'node:path'
import { homedir } from 'node:os'
import type { ISkillManifest } from './ISkillManifest.ts'
import { SkillParser } from './SkillParser.ts'
import { RemoteSkillFetcher, type RemoteSkillSource } from './RemoteSkillSource.ts'
import { checkSkillIntegrity } from '../../utils/skillIntegrity.ts'
import { resolveSkillFile } from './skillFile.ts'
import { normalizeSkillName } from './SkillParser.ts'
import { scanForInjections } from './injectionScan.ts'
import { MEMBERS_DIR } from '../../members/MemberRegistry.ts'
import { ManifestCache } from './manifestCache.ts'

const IGNORED_DIRS = new Set([
  'node_modules', '.git', '.hg', '.svn', 'dist', 'build', '.next', '.cache',
  '.venv', '__pycache__', '.tox', 'vendor', 'target',
])
const MAX_DEPTH = 6
/** Bound on directories visited in one scan (#525). */
const MAX_DIRS = 2000

export interface ScanStats {
  directories: number
  skills: number
  cacheHits: number
  durationMs: number
  /** True when MAX_DIRS stopped the scan, so the result is partial. */
  truncated: boolean
}

/** What the metadata cache stores per SKILL.md (#617). */
interface CachedSkill {
  manifest: ISkillManifest
  findings: { severity: string; pattern: string; excerpt: string }[]
  heuristic: boolean
  declaredName: string
}

// The packaged skills dir inside the installed package is the versioned trust
// root: the lockfile integrity gate applies only to user/project dirs, which
// is decided by location (isPackagedDir), not by a caller-threaded flag.
function isPackagedDir(fullPath: string): boolean {
  const rel = relative(MEMBERS_DIR, fullPath)
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel)
}

function warnCollision(name: string, kept: string, dropped: string, rule: string): void {
  console.warn(`[SkillDiscovery] "${name}" is defined in both "${dropped}" and "${kept}", keeping "${kept}" (${rule})`)
}

/**
 * User-scope skill directories, in precedence order (#523, ADR-037). XDG data
 * home first, then its default, then the legacy `~/.agents/skills` so an
 * existing install keeps working. Windows has no XDG convention, so the legacy
 * path stays the only user scope there.
 */
export function userSkillDirs(
  home: string = homedir(),
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
): string[] {
  if (platform === 'win32') return [join(home, '.agents', 'skills')]
  const dirs: string[] = []
  const dataHome = env.XDG_DATA_HOME?.trim()
  if (dataHome) dirs.push(join(dataHome, 'agents', 'skills'))
  dirs.push(join(home, '.local', 'share', 'agents', 'skills'))
  dirs.push(join(home, '.agents', 'skills'))
  return [...new Set(dirs)]
}

export class SkillDiscovery {
  private parser = new SkillParser()
  private manifests = new Map<string, ISkillManifest>()
  private scopes = new Map<string, 'user' | 'project'>()
  /** Search-root index that produced each skill, so earlier roots beat later ones (#523). */
  private precedence = new Map<string, number>()
  private discovered = false
  private readonly defaultProjectDir: string
  private remoteFetcher?: RemoteSkillFetcher
  private cache: ManifestCache<CachedSkill>
  private stats: ScanStats = { directories: 0, skills: 0, cacheHits: 0, durationMs: 0, truncated: false }

  constructor(projectDir: string = process.cwd()) {
    this.defaultProjectDir = projectDir
    this.cache = new ManifestCache<CachedSkill>(projectDir)
  }

  /** Scan counters from the last discovery, for `agenthood skills --stats` (#525, #614). */
  lastStats(): ScanStats {
    return { ...this.stats }
  }

  /**
   * Every manifest in one search root, with no cross-root precedence (#616).
   * `verify --dedup` uses it to see the same name twice; discovery itself hides
   * the loser behind a warning.
   */
  scanRoot(root: string): ISkillManifest[] {
    if (!existsSync(root)) return []
    this.cache = new ManifestCache<CachedSkill>(this.defaultProjectDir)
    // Per-root budget: a large user root must not silently cut the next root.
    this.stats = { directories: 0, skills: 0, cacheHits: 0, durationMs: 0, truncated: false }
    return this.scanDir(root, 0)
  }

  discover(projectDir: string): ISkillManifest[] {
    this.manifests.clear()
    this.scopes.clear()
    this.precedence.clear()
    this.discovered = true
    this.cache = new ManifestCache<CachedSkill>(projectDir)
    const started = Date.now()
    this.stats = { directories: 0, skills: 0, cacheHits: 0, durationMs: 0, truncated: false }

    const scopePaths: { path: string; scope: 'user' | 'project' }[] = [
      ...userSkillDirs().map((path) => ({ path, scope: 'user' as const })),
      { path: join(projectDir, '.agents', 'skills'), scope: 'project' },
      { path: join(projectDir, '.agenthood', 'skills'), scope: 'project' },
      { path: join(projectDir, '.claude', 'skills'), scope: 'project' },
      { path: join(projectDir, 'skills'), scope: 'project' },
    ]

    for (const [index, { path: dir, scope }] of scopePaths.entries()) {
      if (!existsSync(dir)) continue
      const found = this.scanDir(dir, 0)
      for (const manifest of found) {
        const key = manifest.name || manifest.directory
        const existing = this.manifests.get(key)
        if (!existing) {
          this.manifests.set(key, manifest)
          this.scopes.set(key, scope)
          this.precedence.set(key, index)
          continue
        }
        const existingScope = this.scopes.get(key) ?? 'project'
        if (existingScope === 'user' && scope === 'project') {
          this.manifests.set(key, manifest)
          this.scopes.set(key, scope)
          this.precedence.set(key, index)
          continue
        }
        if (existingScope === 'project' && scope === 'user') {
          warnCollision(key, existing.directory, manifest.directory, 'project overrides user')
          continue
        }
        // Same scope, different search root: the earlier root wins (XDG before
        // the legacy path). Same root: deterministic alphabetical tie-break,
        // never a silent drop: two skill dirs with one name is a warning (#524).
        if ((this.precedence.get(key) ?? index) !== index) {
          warnCollision(key, existing.directory, manifest.directory, 'earlier search path wins')
          continue
        }
        const winner = [existing.directory, manifest.directory].sort()[0]
        if (winner === manifest.directory) this.manifests.set(key, manifest)
        warnCollision(key, existing.directory, manifest.directory, 'alphabetically first directory wins')
      }
    }

    this.stats.skills = this.manifests.size
    this.stats.durationMs = Date.now() - started
    this.cache.persist()
    return Array.from(this.manifests.values())
  }

  async discoverRemote(sources: RemoteSkillSource[]): Promise<ISkillManifest[]> {
    // Populate local manifests first: a later get()/list() would otherwise
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
   * (the-*) and _shared are excluded: members load via MemberRegistry.
   * The lockfile integrity gate does not apply here: the versioned package
   * tarball is the trust root, and there is no project lockfile entry for
   * packaged files. Kept separate from discover() so publish/verify/MCP
   * keep their project-scoped behavior.
   */
  discoverPackaged(): ISkillManifest[] {
    const result: ISkillManifest[] = []

    let entries: Dirent[]
    // readdirSync ENOENT (no packaged dir in stripped installs) is caught by
    // the try below: no existsSync guard needed.
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

    // Persist after the merge pass too, so packaged skills hit the cache on the
    // next run. When discovery ran first, its entries are already in `seen`.
    this.cache.persist()
    return result
  }

  private scanDir(dir: string, depth: number): ISkillManifest[] {
    if (depth > MAX_DEPTH) return []
    if (this.stats.directories >= MAX_DIRS) {
      if (!this.stats.truncated) {
        this.stats.truncated = true
        console.warn(`[SkillDiscovery] scan stopped after ${MAX_DIRS} directories, some skills may be missing (#525)`)
      }
      return []
    }
    this.stats.directories++
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
    const resolved = resolveSkillFile(fullPath)
    if (resolved) {
      if (resolved.nonCanonical) {
        console.warn(`[SkillDiscovery] "${entry}" uses skill.md, rename to SKILL.md for spec compliance`)
      }
      const skillMdPath = resolved.path
      const cached = this.cache.lookup(skillMdPath)
      if (cached) return this.fromCache(cached.value, entry, fullPath)

      const parsed = this.parser.parse(skillMdPath)
      if (!parsed) return []
      const content = readFileSync(skillMdPath, 'utf-8')
      const { frontmatter, heuristic } = this.parser.parseRaw(content)
      if (heuristic) {
        console.warn(`[SkillDiscovery] "${entry}" has malformed frontmatter (loaded via fallback): quote values containing colons`)
      }
      const tier = this.parser.parseTier(frontmatter)
      // Fail-closed injection screen (ADR-029): a block-severity finding refuses
      // to load the skill at all, on the same drop-the-manifest path a packaging
      // mismatch takes. Warn-severity findings load and announce themselves,
      // security skills legitimately discuss this vocabulary.
      const findings = scanForInjections(content)
      if (findings.some((f) => f.severity === 'block')) {
        for (const f of findings.filter((f) => f.severity === 'block')) {
          console.warn(`[SkillDiscovery] "${entry}" not loaded, prompt injection (${f.pattern}): "${f.excerpt}"`)
        }
        return []
      }
      for (const f of findings) {
        console.warn(`[SkillDiscovery] "${entry}", possible injection (${f.pattern}): "${f.excerpt}"`)
      }
      const manifest = this.parser.parseManifest(skillMdPath, fullPath, { ...parsed, name: parsed.name || entry }, tier)
      const packaged = isPackagedDir(fullPath)
      if (!packaged) this.verifyIntegrity(parsed.name || entry, skillMdPath)
      // A packaged file whose frontmatter name disagrees with its directory
      // entry could shadow a lockfile-pinned manifest with no gate: drop it.
      // (SkillParser falls back to the file path when name is missing, so a
      // missing name also lands here and surfaces in the warning.)
      if (packaged && parsed.name !== entry) {
        console.warn(`[SkillDiscovery] packaged "${entry}" dropped: frontmatter name "${parsed.name}" mismatches directory`)
        return []
      }
      // Consuming a skill stays lenient (#513): it loads under its frontmatter
      // name, but the mismatch is worth a warning because activation by the
      // directory name will miss it.
      if (!packaged && parsed.name && parsed.name !== normalizeSkillName(entry)) {
        console.warn(`[SkillDiscovery] "${entry}" declares name "${parsed.name}", it activates as "${parsed.name}", not "${entry}"`)
      }
      this.cache.remember(skillMdPath, { manifest, findings, heuristic: heuristic ?? false, declaredName: parsed.name })
      return [manifest]
    }
    return this.scanDir(fullPath, depth + 1)
  }

  /**
   * Replays a cached entry: the same warnings a fresh parse would emit, then the
   * same packaged-name gate. The cache stores the manifest and the scan result,
   * so nothing here reads the file again (#617).
   */
  private fromCache(cached: CachedSkill, entry: string, fullPath: string): ISkillManifest[] {
    if (cached.heuristic) {
      console.warn(`[SkillDiscovery] "${entry}" has malformed frontmatter (loaded via fallback): quote values containing colons`)
    }
    const findings = cached.findings as { severity: string; pattern: string; excerpt: string }[]
    if (findings.some((finding) => finding.severity === 'block')) return []
    for (const finding of findings) {
      console.warn(`[SkillDiscovery] "${entry}", possible injection (${finding.pattern}): "${finding.excerpt}"`)
    }
    const packaged = isPackagedDir(fullPath)
    if (!packaged) this.verifyIntegrity(cached.declaredName || entry, cached.manifest.location)
    if (packaged && cached.declaredName !== entry) {
      console.warn(`[SkillDiscovery] packaged "${entry}" dropped: frontmatter name "${cached.declaredName}" mismatches directory`)
      return []
    }
    if (!packaged && cached.declaredName && cached.declaredName !== normalizeSkillName(entry)) {
      console.warn(
        `[SkillDiscovery] "${entry}" declares name "${cached.declaredName}"; it activates as "${cached.declaredName}", not "${entry}"`,
      )
    }
    this.stats.cacheHits++
    return [cached.manifest]
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
    console.warn(`[skill-integrity] ${member}: ${status}, ${guidance[status]}`)
  }
}
