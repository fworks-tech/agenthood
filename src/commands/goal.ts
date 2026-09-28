/**
 * agenthood goal
 *
 * Goals persist across CLI invocations via GoalChain over a JSON-file
 * LongTermMemory adapter (`.agenthood/goals.json`). Subcommands map 1:1
 * onto GoalChain methods; goal-level completion is derived (all sub-goals
 * completed) rather than set directly.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { CommandDescriptor } from './types.ts'
import type { LongTermMemory } from '../core/types.ts'
import { GoalChain, type Goal, type GoalStatus } from '../workflows/GoalChain.ts'
import { userError } from '../core/cliError.ts'

const STATUSES: GoalStatus[] = ['pending', 'in_progress', 'blocked', 'completed']

/** File-backed LongTermMemory: one JSON object mapping keys to values. */
export class FileGoalMemory implements LongTermMemory {
  constructor(private readonly filePath: string) {}

  private readAll(): Record<string, unknown> {
    if (!existsSync(this.filePath)) return {}
    try {
      const raw = JSON.parse(readFileSync(this.filePath, 'utf8')) as unknown
      return typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {}
    } catch {
      return {}
    }
  }

  async store(key: string, value: unknown): Promise<void> {
    const all = this.readAll()
    all[key] = value
    mkdirSync(dirname(this.filePath), { recursive: true })
    writeFileSync(this.filePath, JSON.stringify(all, null, 2) + '\n', 'utf8')
  }

  async retrieve(key: string): Promise<unknown> {
    return this.readAll()[key] ?? null
  }
}

export function goalChain(cwd: string = process.cwd()): GoalChain {
  return new GoalChain(new FileGoalMemory(join(cwd, '.agenthood', 'goals.json')))
}

function printHelp(): void {
  console.log(`Usage:
  agenthood goal create <description> [--issue <ref>]   Create a goal
  agenthood goal list [--json]                          List active goals
  agenthood goal show <id> [--json]                     Show a goal and its sub-goals
  agenthood goal subgoal <id> <description>             Add a sub-goal
  agenthood goal status <id> <sub-id> <status>          Set sub-goal status (${STATUSES.join('|')})
  agenthood goal next <id>                              Advance the next pending sub-goal`)
}

function printGoal(g: Goal): void {
  console.log(`${g.id} [${g.status}] ${g.description}${g.issueRef ? ` (${g.issueRef})` : ''}`)
  for (const sg of g.subGoals) {
    console.log(`  ${sg.id} [${sg.status}] ${sg.description}`)
  }
}

export async function goal(args: string[], cwd: string = process.cwd()): Promise<void> {
  const chain = goalChain(cwd)
  const [sub, ...rest] = args
  const json = rest.includes('--json')
  const positional = rest.filter((a) => a !== '--json')

  switch (sub) {
    case 'create': {
      const issueIdx = positional.indexOf('--issue')
      const issueRef = issueIdx >= 0 ? positional[issueIdx + 1] : undefined
      const description = (issueIdx >= 0 ? positional.slice(0, issueIdx) : positional).join(' ')
      if (!description) userError('Usage: agenthood goal create <description> [--issue <ref>]')
      const created = await chain.create(description, issueRef)
      console.log(created.id)
      return
    }
    case 'list': {
      const active = await chain.getActive()
      if (json) {
        console.log(JSON.stringify({ goals: active }, null, 2))
        return
      }
      if (active.length === 0) {
        console.log('No active goals.')
        return
      }
      for (const g of active) printGoal(g)
      return
    }
    case 'show': {
      const g = positional[0] ? await chain.getGoal(positional[0]) : undefined
      if (!g) userError('Usage: agenthood goal show <id>', { fix: 'Run "agenthood goal list" to see active goal ids.' })
      if (json) console.log(JSON.stringify(g, null, 2))
      else printGoal(g)
      return
    }
    case 'subgoal': {
      const [id, ...descParts] = positional
      const description = descParts.join(' ')
      if (!id || !description) userError('Usage: agenthood goal subgoal <id> <description>')
      const sg = await chain.addSubGoal(id, { description })
      console.log(sg.id)
      return
    }
    case 'status': {
      const [id, subId, status] = positional
      if (!id || !subId || !(STATUSES as string[]).includes(status)) {
        userError('Usage: agenthood goal status <id> <sub-id> <pending|in_progress|blocked|completed>')
      }
      await chain.updateStatus(id, subId, status as GoalStatus)
      console.log('ok')
      return
    }
    case 'next': {
      const [id] = positional
      if (!id) userError('Usage: agenthood goal next <id>')
      const next = await chain.resume(id)
      if (!next) console.log('No pending sub-goals.')
      else console.log(`${next.id} ${next.description}`)
      return
    }
    default:
      printHelp()
  }
}

export const command: CommandDescriptor = {
  name: 'goal',
  description: 'Track multi-step goals across runs (create, list, show, subgoal, status, next)',
  handler: (args) => goal(args),
}
