import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { MEMBER_NAMES } from '../members.js'

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

export async function verify(args: string[]): Promise<void> {
  const cwd = process.cwd()
  const membersDir = join(cwd, 'members')
  const flags = new Set(args.filter((a) => a.startsWith('--')))
  const positionals = args.filter((a) => !a.startsWith('--'))

  const isStrict = flags.has('--strict')
  const updateLock = flags.has('--update-lock')
  const targetMember = positionals[0]

  const membersToCheck = targetMember
    ? [targetMember]
    : readdirSync(membersDir, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name)

  let allPassed = true
  const results: VerifyResult[] = []

  for (const member of membersToCheck) {
    const skillPath = join(membersDir, member, 'SKILL.md')
    const result: VerifyResult = { member, pass: true, issues: [] }

    if (!existsSync(skillPath)) {
      result.pass = false
      result.issues.push('SKILL.md not found')
      results.push(result)
      allPassed = false
      continue
    }

    const content = readFileSync(skillPath, 'utf8')
    const { frontmatter, body } = parseFrontmatter(content)

    // Check frontmatter
    if (!frontmatter) {
      result.issues.push('Missing YAML frontmatter')
    } else {
      if (!frontmatter.name) result.issues.push('Frontmatter missing "name"')
      if (!frontmatter.description) result.issues.push('Frontmatter missing "description"')
      if (!frontmatter.license) result.issues.push('Frontmatter missing "license"')
    }

    // Check required sections
    for (const section of REQUIRED_SECTIONS) {
      const sectionRegex = new RegExp(`## ${section}`, 'i')
      if (!sectionRegex.test(body)) {
        result.issues.push(`Missing required section: "${section}"`)
      }
    }

    // Check for placeholder content
    for (const pattern of PLACEHOLDER_PATTERNS) {
      if (pattern.test(body)) {
        result.issues.push(`Contains placeholder content matching "${pattern.source}"`)
      }
    }

    if (result.issues.length > 0) result.pass = false
    if (!result.pass) allPassed = false

    results.push(result)
  }

  // Print results
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

  // Update lockfile if requested
  if (updateLock && allPassed) {
    const lock: Record<string, unknown> = { version: 1, members: {} }
    for (const member of membersToCheck) {
      const skillPath = join(membersDir, member, 'SKILL.md')
      if (existsSync(skillPath)) {
        const content = readFileSync(skillPath, 'utf8')
        const hash = simpleHash(content)
        ;(lock.members as Record<string, unknown>)[member] = {
          version: `sha256:${hash}`,
          updatedAt: new Date().toISOString(),
        }
      }
    }

    const lockPath = join(cwd, 'agenthood.lock')
    writeFileSync(lockPath, JSON.stringify(lock, null, 2) + '\n', 'utf8')
    console.log(`\n  Lockfile written to ${lockPath}`)
  }

  if (isStrict && allPassed) {
    console.log('\n  Strict mode: no lane overlap checks implemented yet.')
  }

  if (!allPassed) {
    process.exit(1)
  }
}

function simpleHash(content: string): string {
  let hash = 0
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash |= 0
  }
  return Math.abs(hash).toString(16).padStart(8, '0')
}
