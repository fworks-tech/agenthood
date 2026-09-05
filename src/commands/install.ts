/**
 * agenthood install <url>
 *
 * Install a skill from a URL or git repository.
 * Supports: GitHub repos, raw SKILL.md URLs, and tarball archives.
 */

import { existsSync, readFileSync, mkdirSync, writeFileSync, cpSync, rmSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { execSync } from 'node:child_process'
import type { CommandDescriptor } from './types.ts'
import { resolveSkillsDir } from '../members.ts'
import { SkillParser } from '../skills/discovery/SkillParser.ts'

const LOCKFILE = 'skills-lock.json'

interface LockEntry {
  source: string
  installedAt: string
}

interface Lockfile {
  version: number
  skills: Record<string, LockEntry>
}

function loadLockfile(skillsDir: string): Lockfile {
  const lockPath = join(skillsDir, LOCKFILE)
  if (!existsSync(lockPath)) return { version: 1, skills: {} }
  try {
    return JSON.parse(readFileSync(lockPath, 'utf-8'))
  } catch {
    return { version: 1, skills: {} }
  }
}

function saveLockfile(skillsDir: string, lock: Lockfile): void {
  const lockPath = join(skillsDir, LOCKFILE)
  writeFileSync(lockPath, JSON.stringify(lock, null, 2) + '\n', 'utf-8')
}

function isGitUrl(url: string): boolean {
  return /\.git$/.test(url) || /^git@/.test(url) || /^https?:\/\/.*\/.*\/.*\/.*$/.test(url)
}

function isGithubUrl(url: string): boolean {
  return /github\.com\/[^/]+\/[^/]+/.test(url) && !url.endsWith('.git')
}

function toGitUrl(url: string): string {
  if (isGitUrl(url)) return url
  if (isGithubUrl(url)) return url.replace(/\/$/, '') + '.git'
  return url
}

function cloneRepo(url: string, dest: string): void {
  execSync(`git clone --depth 1 "${url}" "${dest}"`, { stdio: 'pipe' })
}

function downloadUrl(url: string, dest: string): void {
  mkdirSync(dest, { recursive: true })
  execSync(`curl -fsSL "${url}" -o "${join(dest, 'SKILL.md')}"`, { stdio: 'pipe' })
}

function findSkillMd(dir: string): string | null {
  const direct = join(dir, 'SKILL.md')
  if (existsSync(direct)) return direct

  const nested = join(dir, 'skills', 'SKILL.md')
  if (existsSync(nested)) return nested

  if (!existsSync(dir)) return null
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      const sub = join(dir, entry.name, 'SKILL.md')
      if (existsSync(sub)) return sub
    }
  }
  return null
}

export const command: CommandDescriptor = {
  name: 'install',
  description: 'Install a skill from a URL or git repository',
  handler: (args) => install(args),
}

export async function install(args: string[]): Promise<void> {
  const dryRun = args.includes('--dry-run')
  const source = args.filter((a) => !a.startsWith('--'))[0]
  if (!source) {
    console.error('\nUsage: agenthood install <url-or-git-repo> [--dry-run]\n')
    console.error('Examples:')
    console.error('  agenthood install https://github.com/user/repo')
    console.error('  agenthood install https://example.com/skill/SKILL.md')
    console.error('  agenthood install git@github.com:user/repo.git')
    console.error('  agenthood install https://github.com/user/repo --dry-run\n')
    process.exit(1)
    return
  }

  const cwd = process.cwd()
  const skillsDir = resolveSkillsDir(cwd)

  console.log(`\n  Installing from ${source}...`)

  const tmpDir = join(skillsDir, '.install-tmp')
  mkdirSync(tmpDir, { recursive: true })

  try {
    const isGit = isGitUrl(source) || isGithubUrl(source)

    if (isGit) {
      const gitUrl = toGitUrl(source)
      cloneRepo(gitUrl, join(tmpDir, 'repo'))
    } else {
      downloadUrl(source, tmpDir)
    }

    const skillMdPath = findSkillMd(isGit ? join(tmpDir, 'repo') : tmpDir)
    if (!skillMdPath) {
      console.error('  ✗ No SKILL.md found in the provided source')
      process.exit(1)
      return
    }

    const content = readFileSync(skillMdPath, 'utf-8')
    const parser = new SkillParser()
    const { frontmatter } = parser.parseRaw(content)

    if (!frontmatter || !frontmatter.name) {
      console.error('  ✗ SKILL.md must have a "name" field in frontmatter')
      process.exit(1)
      return
    }

    const name = String(frontmatter.name)
    const destDir = join(skillsDir, name)

    if (dryRun) {
      console.log(`\n  Dry run — would install "${name}" from ${source}`)
      console.log(`  Destination: ${destDir}\n`)
      return
    }

    mkdirSync(skillsDir, { recursive: true })

    if (existsSync(destDir)) {
      console.error(`  ✗ Skill "${name}" already exists. Use a different name or remove it first.`)
      process.exit(1)
      return
    }

    cpSync(skillMdPath, join(destDir, 'SKILL.md'))

    const lock = loadLockfile(skillsDir)
    lock.skills[name] = {
      source,
      installedAt: new Date().toISOString(),
    }
    saveLockfile(skillsDir, lock)

    console.log(`  ✓ ${name} installed to ${join(skillsDir, name)}`)
    console.log(`  ✓ Locked in ${LOCKFILE}\n`)
  } catch (err) {
    console.error(`  ✗ Install failed: ${(err as Error)?.message ?? err}`)
    process.exit(1)
  } finally {
    if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true, force: true })
  }
}
