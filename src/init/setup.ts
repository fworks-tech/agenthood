import { copyFile, mkdir, readFile, writeFile, symlink } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { stripConfig } from '../utils/stripConfig.ts'
import { RUNTIME_SKILL_DIRS, TARGET_DIRS } from '../members.ts'
import type { Runtime } from '../members.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SOCIETY_ROOT = join(__dirname, '..', '..')

async function safeCopy(src: string, dest: string, overwrite = false): Promise<void> {
  if (!existsSync(src)) {
    console.warn(`[agenthood] source not found, skipping: ${src}`)
    return
  }
  if (existsSync(dest) && !overwrite) return
  await copyFile(src, dest)
}

/** Path (relative to the project root) where each runtime's member skills
 * live — consumed by init (installSkills/planPaths) and eject (cleanup) */
function resolveSkillsDest(cwd: string, runtime: Runtime): string {
  return join(cwd, RUNTIME_SKILL_DIRS[runtime])
}

/** Files `init` would write for the given runtime/members — used by --dry-run */
export function planPaths(cwd: string, runtime: Runtime, members: string[]): string[] {
  const skillsDest = resolveSkillsDest(cwd, runtime)
  const paths = members.map((m) => join(skillsDest, m, `${m}.md`))
  paths.push(join(cwd, 'AGENTS.md'), join(cwd, '.agenthood', 'config.json'))
  return paths
}

export async function installSkills(cwd: string, runtime: Runtime, members: string[], overwrite = false, targets: string[] = []): Promise<void> {
  const primaryDest = join(cwd, '.agents', 'skills')
  const legacyDest = join(cwd, '.agenthood', 'skills')

  await mkdir(primaryDest, { recursive: true })

  // Backward compat: .agenthood/skills/ -> .agents/skills/
  if (!existsSync(legacyDest)) {
    try {
      await symlink(join(cwd, '.agents', 'skills'), legacyDest)
    } catch {
      // symlink may fail on Windows without privileges — fall back to copy
      await mkdir(legacyDest, { recursive: true })
    }
  }

  const skillsDest = primaryDest

  for (const member of members) {
    const src = join(SOCIETY_ROOT, 'skills', member, 'SKILL.md')
    if (!existsSync(src)) continue
    const destDir = join(skillsDest, member)
    await mkdir(destDir, { recursive: true })
    await safeCopy(src, join(destDir, `${member}.md`), overwrite)
  }

  await safeCopy(join(SOCIETY_ROOT, 'AGENTS.md'), join(cwd, 'AGENTS.md'), overwrite)

  for (const target of targets) {
    const targetPath = join(cwd, TARGET_DIRS[target])
    await mkdir(dirname(targetPath), { recursive: true })
    if (!existsSync(targetPath)) {
      await safeCopy(join(SOCIETY_ROOT, 'AGENTS.md'), targetPath, overwrite)
    }
  }
}

export async function scaffoldConfig(cwd: string, runtime: Runtime, members: string[], overwrite = false): Promise<void> {
  const configDir = join(cwd, '.agenthood')
  await mkdir(configDir, { recursive: true })

  const configPath = join(configDir, 'config.json')
  if (existsSync(configPath)) {
    if (!overwrite) return
    await mkdir(join(configDir, 'backup'), { recursive: true })
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    await copyFile(configPath, join(configDir, 'backup', `config-${stamp}.json`))
  }

  const examplePath = join(SOCIETY_ROOT, '.agenthood', 'config.example.json')
  if (existsSync(examplePath)) {
    let raw: Record<string, unknown> = {}
    try {
      raw = JSON.parse(await readFile(examplePath, 'utf8')) as Record<string, unknown>
    } catch (err) {
      console.warn(`[agenthood] bundled config.example.json is malformed (${err instanceof Error ? err.message : err}) — using defaults`)
    }
    const config = { ...stripConfig(raw), runtime, members }
    await writeFile(configPath, JSON.stringify(config, null, 2) + '\n', 'utf8')
  } else {
    const config = {
      version: '1',
      runtime,
      members,
    }
    await writeFile(configPath, JSON.stringify(config, null, 2) + '\n', 'utf8')
  }
}
