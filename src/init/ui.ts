import { createInterface } from 'node:readline'
import { ALL_MEMBERS } from '../members.js'

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
