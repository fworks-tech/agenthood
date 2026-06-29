import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { contentHash } from '../utils/hash.js'
import { loadLockfile } from '../utils/lockfile.js'
import type { Lockfile } from '../utils/lockfile.js'

const REQUIRED_SECTIONS = ['Overview', 'When to Use', 'Process', 'Red Flags', 'Rationalizations', 'Verification']

const PLACEHOLDER_PATTERNS = [/TBD/i, /TODO/i, /FIXME/i]

interface VerifyResult {
  member: string
  pass: boolean
  issues: string[]
}

function parseFrontmatter(content: string): { frontmatter: Record<string, unknown> | null; body: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?/)
  if (!match) return { frontmatter: null, body: content }

  const raw = match[1]
  const frontmatter: Record<string, unknown> = {}
  for (const line of raw.split('\n')) {
    const colonIdx = line.indexOf(':')
    if (colonIdx > 0) {
      const key = line.slice(0, colonIdx).trim()
      const value = line.slice(colonIdx + 1).trim()
      frontmatter[key] = value
    }
  }

  return { frontmatter, body: content.slice(match[0].length) }
}

function validateMember(membersDir: string, member: string, lockfile?: Lockfile): VerifyResult {
  const result: VerifyResult = { member, pass: true, issues: [] }
  const skillPath = join(membersDir, member, 'SKILL.md')

  if (!existsSync(skillPath)) {
    result.pass = false
    result.issues.push('SKILL.md not found')
    return result
  }

  const content = readFileSync(skillPath, 'utf8')
  const { frontmatter, body } = parseFrontmatter(content)

  if (!frontmatter) {
    result.issues.push('Missing YAML frontmatter')
  } else {
    if (!frontmatter.name) result.issues.push('Frontmatter missing "name"')
    if (!frontmatter.description) result.issues.push('Frontmatter missing "description"')
    if (!frontmatter.license) result.issues.push('Frontmatter missing "license"')
  }

  for (const section of REQUIRED_SECTIONS) {
    const sectionRegex = new RegExp(`## ${section}`, 'i')
    if (!sectionRegex.test(body)) {
      result.issues.push(`Missing required section: "${section}"`)
    }
  }

  for (const pattern of PLACEHOLDER_PATTERNS) {
    if (pattern.test(body)) {
      result.issues.push(`Contains placeholder content matching "${pattern.source}"`)
    }
  }

  if (lockfile && lockfile.members[member]) {
    const currentHash = contentHash(content)
    const lockedHash = lockfile.members[member].version
    if (currentHash !== lockedHash) {
      result.issues.push('Drift detected — SKILL.md hash does not match lockfile. Run `verify --update-lock` to update.')
    }
  }

  if (result.issues.length > 0) result.pass = false
  return result
}

function printResults(results: VerifyResult[]): void {
  for (const r of results) {
    if (r.pass) {
      console.log(`  \u2713 ${r.member}`)
    } else {
      console.log(`  \u2717 ${r.member}`)
      for (const issue of r.issues) {
        console.log(`      - ${issue}`)
      }
    }
  }
}

function updateLockfile(cwd: string, membersDir: string, members: string[]): void {
  const lock: Record<string, unknown> = { version: 1, members: {} }
  for (const member of members) {
    const skillPath = join(membersDir, member, 'SKILL.md')
    if (existsSync(skillPath)) {
      const content = readFileSync(skillPath, 'utf8')
      const hash = contentHash(content)
      ;(lock.members as Record<string, unknown>)[member] = {
        version: hash,
        updatedAt: new Date().toISOString(),
      }
    }
  }

  const lockPath = join(cwd, 'agenthood.lock')
  writeFileSync(lockPath, JSON.stringify(lock, null, 2) + '\n', 'utf8')
  console.log(`\n  Lockfile written to ${lockPath}`)
}

export async function verify(args: string[]): Promise<void> {
  const cwd = process.cwd()
  const membersDir = join(cwd, 'members')
  const flags = new Set(args.filter((a) => a.startsWith('--')))
  const positionals = args.filter((a) => !a.startsWith('--'))

  const isStrict = flags.has('--strict')
  const updateLock = flags.has('--update-lock')
  const targetMember = positionals[0]

  if (targetMember && !/^[a-z0-9][a-z0-9_-]*$/.test(targetMember)) {
    console.error(`Invalid member name: "${targetMember}"`)
    process.exit(1)
    return
  }

  const membersToCheck = targetMember
    ? [targetMember]
    : readdirSync(membersDir, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name)

  const lockfile = loadLockfile(cwd)
  if (!lockfile) {
    console.log('\n  No lockfile found — drift detection unavailable. Run `verify --update-lock` to create one.\n')
  }

  const results = membersToCheck.map((m) => validateMember(membersDir, m, lockfile))
  printResults(results)

  const hasAllPassed = results.every((r) => r.pass)

  if (updateLock && hasAllPassed) {
    updateLockfile(cwd, membersDir, membersToCheck)
  }

  if (isStrict && hasAllPassed) {
    console.log('\n  Strict mode: no lane overlap checks implemented yet.')
  }

  if (!hasAllPassed) {
    process.exit(1)
  }
}


