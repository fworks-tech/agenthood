import { createInterface } from 'node:readline'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { ALL_MEMBERS } from '../members.js'
import { PersonalisationStore } from '../memory/PersonalisationStore.js'

const RUNTIMES = ['claude-code', 'copilot', 'gemini-cli', 'other'] as const
type Runtime = (typeof RUNTIMES)[number]

function prompt(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer)
    })
  })
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

export async function promptRuntime(): Promise<Runtime> {
  console.log('Which AI runtime are you using?\n')
  RUNTIMES.forEach((r, i) => console.log(`  ${i + 1}. ${r}`))
  console.log()

  const answer = await prompt('Select (1-4) [1]: ')
  const index = parseInt(answer || '1', 10) - 1
  const runtime = RUNTIMES[index] ?? 'claude-code'
  console.log(`  → ${runtime}\n`)
  return runtime
}

export async function promptMembers(): Promise<string[]> {
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

export async function setupPersonalisation(cwd: string): Promise<void> {
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
