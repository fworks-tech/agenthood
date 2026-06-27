/**
 * agenthood init
 *
 * The Envoy — initiates a new project into the Agenthood Society.
 * The Initiation ceremony. Installs conventions, hooks, templates,
 * and member skills into the target project.
 *
 * Idempotent — existing files are never overwritten.
 * Interactive — prompts for runtime and member selection.
 */

import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'
import { createInterface } from 'node:readline'
import { ALL_MEMBERS } from '../members.js'
import { SocietyIndexer } from '../project/SocietyIndexer.js'
import { KnowledgeGraphStore } from '../rag/KnowledgeGraphStore.js'
import { PersonalisationStore } from '../memory/PersonalisationStore.js'
import { LanceDBStore } from '../memory/VectorStore.js'
import { ResidualMemory } from '../memory/ResidualMemory.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SOCIETY_ROOT = join(__dirname, '..', '..')

const RUNTIMES = ['claude-code', 'copilot', 'gemini-cli', 'other'] as const
type Runtime = (typeof RUNTIMES)[number]

export async function init(): Promise<void> {
  const cwd = process.cwd()

  console.log('\n🏛️  Welcome to the Agenthood.\n')
  console.log('The Initiation is beginning.\n')

  const runtime = await promptRuntime()
  const members = await promptMembers()

  const steps: Array<[string, () => Promise<void>]> = [
    ['Conventions', () => installConventions(cwd)],
    ['Git hooks (Husky)', () => installHooks(cwd)],
    ['GitHub templates', () => installGitHubTemplates(cwd)],
    ['CI workflows', () => installWorkflows(cwd)],
    ['Member skills', () => installSkills(cwd, runtime, members)],
    ['Git commit template', () => configureGitTemplate(cwd)],
    ['Agenthood config', () => scaffoldConfig(cwd, runtime, members)],
    ['Vector store', () => initVectorStore(cwd)],
    ['Residual memory', () => initResidualMemory(cwd)],
    ['Society index', () => indexSociety(cwd)],
    ['Personalisation', () => setupPersonalisation(cwd)],
    ['Decision log', () => initDecisionLog(cwd)],
  ]

  for (const [label, step] of steps) {
    process.stdout.write(`  Installing ${label}...`)
    try {
      await step()
      console.log(' ✅')
    } catch (err) {
      console.log(' ❌')
      console.error(`    Failed: ${err}`)
    }
  }

  console.log('\n🏛️  The Society is ready.\n')
  console.log('  Run `npx agenthood check` to verify the initiation.')
  console.log('  Run `npx agenthood oath` to read the oath.\n')
  console.log('  Your next commit will be reviewed by The Doorman.\n')
}

async function promptRuntime(): Promise<Runtime> {
  console.log('Which AI runtime are you using?\n')
  RUNTIMES.forEach((r, i) => console.log(`  ${i + 1}. ${r}`))
  console.log()

  const answer = await prompt('Select (1-4) [1]: ')
  const index = parseInt(answer || '1', 10) - 1
  const runtime = RUNTIMES[index] ?? 'claude-code'
  console.log(`  → ${runtime}\n`)
  return runtime
}

async function promptMembers(): Promise<string[]> {
  console.log('Which members do you want to activate?\n')
  ALL_MEMBERS.forEach(({ name, tagline }, i) =>
    console.log(`  ${String(i + 1).padStart(2)}. ${name.padEnd(16)} ${tagline}`)
  )
  console.log()
  console.log('  Enter numbers separated by commas, or "all" for all members.')

  const answer = await prompt('Members [all]: ')
  const trimmed = answer.trim().toLowerCase()

  if (!trimmed || trimmed === 'all') {
    console.log('  → all members\n')
    return ALL_MEMBERS.map((m) => m.name)
  }

  const indices = trimmed.split(',').map((s) => parseInt(s.trim(), 10) - 1)
  const selected = indices
    .filter((i) => i >= 0 && i < ALL_MEMBERS.length)
    .map((i) => ALL_MEMBERS[i].name)

  if (selected.length === 0) {
    console.log('  → no valid selection, activating all members\n')
    return ALL_MEMBERS.map((m) => m.name)
  }

  console.log(`  → ${selected.join(', ')}\n`)
  return selected
}

function prompt(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer)
    })
  })
}

async function installConventions(cwd: string): Promise<void> {
  await safeCopy(
    join(SOCIETY_ROOT, 'conventions', '.gitmessage'),
    join(cwd, '.gitmessage'),
  )
  await safeCopy(
    join(SOCIETY_ROOT, 'conventions', 'commitlint.config.ts'),
    join(cwd, 'commitlint.config.ts'),
  )
}

async function installHooks(cwd: string): Promise<void> {
  execSync('npm install --save-dev husky @commitlint/cli @commitlint/config-conventional', {
    cwd,
    stdio: 'pipe',
  })
  execSync('npx husky init', { cwd, stdio: 'pipe' })

  const huskyDir = join(cwd, '.husky')
  await safeWrite(
    join(huskyDir, 'commit-msg'),
    'npx --no -- commitlint --edit $1\n',
  )
  await safeWrite(
    join(huskyDir, 'pre-push'),
    '# Run tests before push\nnpm test\n',
  )
}

async function installGitHubTemplates(cwd: string): Promise<void> {
  const githubDir = join(cwd, '.github')
  const issueTemplateDir = join(githubDir, 'ISSUE_TEMPLATE')

  await mkdir(issueTemplateDir, { recursive: true })
  await mkdir(join(githubDir, 'workflows'), { recursive: true })

  await safeWrite(join(githubDir, 'pull_request_template.md'), PR_TEMPLATE)
  await safeWrite(join(issueTemplateDir, 'bug_report.md'), BUG_TEMPLATE)
  await safeWrite(join(issueTemplateDir, 'feature_request.md'), FEATURE_TEMPLATE)
  await safeCopy(
    join(SOCIETY_ROOT, 'conventions', 'COMMIT_CONVENTION.md'),
    join(githubDir, 'COMMIT_CONVENTION.md'),
  )
}

async function installWorkflows(cwd: string): Promise<void> {
  const workflowsDir = join(cwd, '.github', 'workflows')
  await mkdir(workflowsDir, { recursive: true })

  await safeCopy(
    join(SOCIETY_ROOT, '.github', 'workflows', 'commitlint.yml'),
    join(workflowsDir, 'commitlint.yml'),
  )
}

async function installSkills(cwd: string, runtime: Runtime, members: string[]): Promise<void> {
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
    const src = join(SOCIETY_ROOT, 'members', member, 'SKILL.md')
    if (!existsSync(src)) continue
    const destDir = join(skillsDest, member)
    await mkdir(destDir, { recursive: true })
    await safeCopy(src, join(destDir, `${member}.md`))
  }

  await safeCopy(join(SOCIETY_ROOT, 'AGENTS.md'), join(cwd, 'AGENTS.md'))
}

async function configureGitTemplate(cwd: string): Promise<void> {
  execSync('git config commit.template .gitmessage', { cwd, stdio: 'pipe' })
}

async function scaffoldConfig(cwd: string, runtime: Runtime, members: string[]): Promise<void> {
  const configDir = join(cwd, '.agenthood')
  await mkdir(configDir, { recursive: true })

  const configPath = join(configDir, 'config.json')
  if (existsSync(configPath)) return

  const examplePath = join(dirname(fileURLToPath(import.meta.url)), '../../.agenthood/config.example.json')
  if (existsSync(examplePath)) {
    const raw = JSON.parse(await readFile(examplePath, 'utf8'))
    const strip = (obj: Record<string, unknown>): Record<string, unknown> =>
      Object.fromEntries(
        Object.entries(obj)
          .filter(([k]) => !k.startsWith('_comment'))
          .map(([k, v]) => [k, v && typeof v === 'object' && !Array.isArray(v) ? strip(v as Record<string, unknown>) : v]),
      )
    const config = { ...strip(raw), runtime, members }
    await writeFile(configPath, JSON.stringify(config, null, 2) + '\n', 'utf8')
  } else {
    const config = {
      version: '1',
      runtime,
      members,
      hooks: { hooksPath: '.husky' },
      conventions: { commitTemplate: '.gitmessage', commitlintConfig: 'commitlint.config.ts' },
    }
    await writeFile(configPath, JSON.stringify(config, null, 2) + '\n', 'utf8')
  }
}

async function setupPersonalisation(cwd: string): Promise<void> {
  const prefsPath = join(cwd, '.agenthood', 'preferences.json')
  if (existsSync(prefsPath)) return

  const store = new PersonalisationStore()
  const style = await promptPreference('style', 'coding style', ['concise', 'verbose', 'balanced'])
  if (style) store.set('style', style, 'explicit')
  const depth = await promptPreference('depth', 'analysis depth', ['high', 'medium', 'low'])
  if (depth) store.set('depth', depth, 'explicit')
  const domain = await promptPreference('domain', 'primary domain', ['web', 'data', 'devops', 'general'])
  if (domain) store.set('domain', domain, 'explicit')
  store.save(prefsPath)
}

async function promptPreference(key: string, label: string, options: string[]): Promise<string | null> {
  console.log(`\n  ${label}?`)
  options.forEach((o, i) => console.log(`    ${i + 1}. ${o}`))
  const answer = await prompt(`  Select (1-${options.length}) or press Enter to skip: `)
  const index = parseInt(answer, 10) - 1
  if (index >= 0 && index < options.length) {
    console.log(`    → ${options[index]}\n`)
    return options[index]
  }
  console.log()
  return null
}

async function initVectorStore(cwd: string): Promise<void> {
  const memoryPath = join(cwd, '.agenthood', 'memory')
  try {
    const store = new LanceDBStore(1536)
    await store.connect(memoryPath)
  } catch {
    await mkdir(memoryPath, { recursive: true })
  }
}

async function initResidualMemory(cwd: string): Promise<void> {
  const residualPath = join(cwd, '.agenthood', 'residual.json')
  if (existsSync(residualPath)) return
  const rm = new ResidualMemory()
  rm.save(residualPath)
}

async function initDecisionLog(cwd: string): Promise<void> {
  const decisionsDir = join(cwd, '.agenthood', 'decisions')
  if (!existsSync(decisionsDir)) {
    await mkdir(decisionsDir, { recursive: true })
  }
}

async function indexSociety(cwd: string): Promise<void> {
  const societyRoot = join(cwd, 'node_modules', 'agenthood')
  const sourceRoot = existsSync(societyRoot) ? societyRoot : dirname(fileURLToPath(import.meta.url))
  const basePath = join(sourceRoot, '..', '..')

  const kg = new KnowledgeGraphStore()
  const indexer = new SocietyIndexer({
    basePath,
    knowledgeGraph: kg,
  })

  await indexer.index()
  kg.save(join(cwd, '.agenthood', 'society-graph.json'))
}

async function safeCopy(src: string, dest: string): Promise<void> {
  if (!existsSync(src) || existsSync(dest)) return
  await copyFile(src, dest)
}

async function safeWrite(dest: string, content: string): Promise<void> {
  if (existsSync(dest)) return
  await writeFile(dest, content, 'utf8')
}

const PR_TEMPLATE = `## What changed

## Why

## How to test

1.
2.

## Screenshots (if UI change)

Closes #
`

const BUG_TEMPLATE = `---
name: Bug report
about: Something is broken
labels: bug
---

## Summary

What went wrong?

## Steps to Reproduce

1.
2.
3.

## Expected Behavior

## Actual Behavior

## Environment

- OS:
- Browser/Runtime:
- Version:

## Related

-
`

const FEATURE_TEMPLATE = `---
name: Feature request
about: A new capability or improvement
labels: feature
---

## Problem

What user need or pain does this address?

## Proposed Solution

What should be built?

## Acceptance Criteria

- [ ]
- [ ]

## Out of Scope

## Related

-
`
