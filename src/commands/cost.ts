import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import type { CommandDescriptor } from './types.ts'

interface CostEntry {
  timestamp: string
  member: string
  model: string
  provider: string
  promptTokens: number
  completionTokens: number
  totalTokens: number
  costUsd: number
}

function readCosts(cwd: string): CostEntry[] {
  const path = join(cwd, '.agenthood', 'costs.jsonl')
  if (!existsSync(path)) return []
  const content = readFileSync(path, 'utf8').trim()
  if (!content) return []
  return content.split('\n').map((l) => JSON.parse(l) as CostEntry)
}

function formatUsd(amount: number): string {
  return `$${amount.toFixed(4)}`
}

export const command: CommandDescriptor = {
  name: 'cost',
  description: 'Show cumulative cost breakdown by provider, member, and day',
  handler: (args) => costHandler(args),
}

async function costHandler(args: string[]): Promise<void> {
  const cwd = process.cwd()
  const flags = new Set(args.filter((a) => a.startsWith('--')))
  const positionals = args.filter((a) => !a.startsWith('--'))

  const since = positionals.find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a))
  const providerFilter = args.indexOf('--provider')
  const memberFilter = args.indexOf('--member')

  let costs = readCosts(cwd)

  if (since) {
    costs = costs.filter((c) => c.timestamp >= since)
  }
  if (providerFilter >= 0 && args[providerFilter + 1]) {
    costs = costs.filter((c) => c.provider === args[providerFilter + 1])
  }
  if (memberFilter >= 0 && args[memberFilter + 1]) {
    costs = costs.filter((c) => c.member === args[memberFilter + 1])
  }

  if (costs.length === 0) {
    console.log('\n  No cost data found. Run a member first to generate cost data.\n')
    return
  }

  const totalCost = costs.reduce((sum, c) => sum + c.costUsd, 0)
  const totalTokens = costs.reduce((sum, c) => sum + c.totalTokens, 0)

  const byProvider = new Map<string, { cost: number; tokens: number }>()
  const byMember = new Map<string, { cost: number; tokens: number }>()
  const byDay = new Map<string, { cost: number; tokens: number }>()

  for (const c of costs) {
    const p = byProvider.get(c.provider) ?? { cost: 0, tokens: 0 }
    p.cost += c.costUsd
    p.tokens += c.totalTokens
    byProvider.set(c.provider, p)

    const m = byMember.get(c.member) ?? { cost: 0, tokens: 0 }
    m.cost += c.costUsd
    m.tokens += c.totalTokens
    byMember.set(c.member, m)

    const day = c.timestamp.slice(0, 10)
    const d = byDay.get(day) ?? { cost: 0, tokens: 0 }
    d.cost += c.costUsd
    d.tokens += c.totalTokens
    byDay.set(day, d)
  }

  console.log('\n  Cost Summary')
  console.log(`  Total: ${formatUsd(totalCost)} (${totalTokens.toLocaleString()} tokens)\n`)

  console.log('  By Provider:')
  for (const [provider, data] of [...byProvider.entries()].sort((a, b) => b[1].cost - a[1].cost)) {
    console.log(`    ${provider.padEnd(12)} ${formatUsd(data.cost).padStart(10)} (${data.tokens.toLocaleString()} tok)`)
  }

  console.log('\n  By Member:')
  for (const [member, data] of [...byMember.entries()].sort((a, b) => b[1].cost - a[1].cost)) {
    console.log(`    ${member.padEnd(20)} ${formatUsd(data.cost).padStart(10)} (${data.tokens.toLocaleString()} tok)`)
  }

  console.log('\n  By Day:')
  for (const [day, data] of [...byDay.entries()].sort()) {
    console.log(`    ${day}  ${formatUsd(data.cost).padStart(10)} (${data.tokens.toLocaleString()} tok)`)
  }

  console.log()
}
