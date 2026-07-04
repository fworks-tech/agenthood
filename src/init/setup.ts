import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { safeExec } from '../utils/exec.js'
import { PR_TEMPLATE, BUG_TEMPLATE, FEATURE_TEMPLATE } from '../templates/index.js'
import { stripConfig } from '../utils/stripConfig.js'
import { ALL_MEMBERS } from '../members.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SOCIETY_ROOT = join(__dirname, '..', '..')

type Runtime = 'claude-code' | 'copilot' | 'gemini-cli' | 'other'

async function safeCopy(src: string, dest: string): Promise<void> {
  if (!existsSync(src) || existsSync(dest)) return
  await copyFile(src, dest)
}

async function safeWrite(dest: string, content: string): Promise<void> {
  if (existsSync(dest)) return
  await writeFile(dest, content, 'utf8')
}

export async function installConventions(cwd: string): Promise<void> {
  await safeCopy(
    join(SOCIETY_ROOT, 'docs', 'conventions', '.gitmessage'),
    join(cwd, '.gitmessage'),
  )
  await safeCopy(
    join(SOCIETY_ROOT, 'docs', 'conventions', 'commitlint.config.ts'),
    join(cwd, 'commitlint.config.ts'),
  )
}

export async function installHooks(cwd: string): Promise<void> {
  await safeExec('npm install --save-dev @commitlint/cli@19.5.0 @commitlint/config-conventional@19.5.0', { cwd })

  const hooksDir = join(cwd, '.githooks')
  await mkdir(hooksDir, { recursive: true })
  await safeWrite(
    join(hooksDir, 'commit-msg'),
    'npx --no -- commitlint --edit $1\n',
  )
  await safeWrite(
    join(hooksDir, 'pre-push'),
    '# Run tests before push\nnpm test\n',
  )
  await safeExec('git config core.hooksPath .githooks', { cwd })
}

export async function installGitHubTemplates(cwd: string): Promise<void> {
  const githubDir = join(cwd, '.github')
  const issueTemplateDir = join(githubDir, 'ISSUE_TEMPLATE')

  await mkdir(issueTemplateDir, { recursive: true })
  await mkdir(join(githubDir, 'workflows'), { recursive: true })

  await safeWrite(join(githubDir, 'pull_request_template.md'), PR_TEMPLATE)
  await safeWrite(join(issueTemplateDir, 'bug_report.md'), BUG_TEMPLATE)
  await safeWrite(join(issueTemplateDir, 'feature_request.md'), FEATURE_TEMPLATE)
  await safeCopy(
    join(SOCIETY_ROOT, 'docs', 'conventions', 'COMMIT_CONVENTION.md'),
    join(githubDir, 'COMMIT_CONVENTION.md'),
  )
}

export async function installWorkflows(cwd: string): Promise<void> {
  const workflowsDir = join(cwd, '.github', 'workflows')
  await mkdir(workflowsDir, { recursive: true })

  await safeCopy(
    join(SOCIETY_ROOT, '.github', 'workflows', 'commitlint.yml'),
    join(workflowsDir, 'commitlint.yml'),
  )
}

export async function installSkills(cwd: string, runtime: Runtime, members: string[]): Promise<void> {
  const skillsDest =
    runtime === 'claude-code'
      ? join(cwd, '.claude', 'skills')
      : runtime === 'copilot'
      ? join(cwd, '.github', 'skills')
      : runtime === 'gemini-cli'
      ? join(cwd, '.gemini', 'skills')
      : join(cwd, '.agenthood', 'skills')

  await mkdir(skillsDest, { recursive: true })

  for (const member of members) {
    const src = join(SOCIETY_ROOT, 'docs', 'members', member, 'SKILL.md')
    if (!existsSync(src)) continue
    const destDir = join(skillsDest, member)
    await mkdir(destDir, { recursive: true })
    await safeCopy(src, join(destDir, `${member}.md`))
  }

  await safeCopy(join(SOCIETY_ROOT, 'AGENTS.md'), join(cwd, 'AGENTS.md'))
}

export async function configureGitTemplate(cwd: string): Promise<void> {
  safeExec('git config commit.template .gitmessage', { cwd })
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
      hooks: { hooksPath: '.githooks' },
      conventions: { commitTemplate: '.gitmessage', commitlintConfig: 'commitlint.config.ts' },
    }
    await writeFile(configPath, JSON.stringify(config, null, 2) + '\n', 'utf8')
  }
}

export async function initDecisionLog(cwd: string): Promise<void> {
  const decisionsDir = join(cwd, '.agenthood', 'decisions')
  if (!existsSync(decisionsDir)) {
    await mkdir(decisionsDir, { recursive: true })
  }
}

export async function initMetrics(cwd: string): Promise<void> {
  const metricsDir = join(cwd, '.agenthood', 'metrics')
  if (!existsSync(metricsDir)) {
    await mkdir(metricsDir, { recursive: true })
  }
}
