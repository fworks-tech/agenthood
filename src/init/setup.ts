import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { stripConfig } from '../utils/stripConfig.ts'
import { RUNTIME_SKILL_DIRS } from '../members.ts'
import type { Runtime } from '../members.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SOCIETY_ROOT = join(__dirname, '..', '..')

async function safeCopy(src: string, dest: string): Promise<void> {
  if (!existsSync(src)) {
    console.warn(`[agenthood] source not found, skipping: ${src}`)
    return
  }
  if (existsSync(dest)) return
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

export async function installSkills(cwd: string, runtime: Runtime, members: string[]): Promise<void> {
  const skillsDest = resolveSkillsDest(cwd, runtime)

  await mkdir(skillsDest, { recursive: true })

  for (const member of members) {
    const src = join(SOCIETY_ROOT, 'skills', member, 'SKILL.md')
    if (!existsSync(src)) continue
    const destDir = join(skillsDest, member)
    await mkdir(destDir, { recursive: true })
    await safeCopy(src, join(destDir, `${member}.md`))
  }

  await safeCopy(join(SOCIETY_ROOT, 'AGENTS.md'), join(cwd, 'AGENTS.md'))
}

export async function scaffoldConfig(cwd: string, runtime: Runtime, members: string[]): Promise<void> {
  const configDir = join(cwd, '.agenthood')
  await mkdir(configDir, { recursive: true })

  const configPath = join(configDir, 'config.json')
  if (existsSync(configPath)) return

  const examplePath = join(SOCIETY_ROOT, '.agenthood', 'config.example.json')
  if (existsSync(examplePath)) {
    const raw = JSON.parse(await readFile(examplePath, 'utf8'))
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
