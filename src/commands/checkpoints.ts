/**
 * agenthood checkpoints
 *
 * List past member run checkpoints with status.
 */

import type { CommandDescriptor } from './types.ts'
import { RunCheckpoint } from '../checkpoint/RunCheckpoint.ts'

export const command: CommandDescriptor = {
  name: 'checkpoints',
  description: 'List past run checkpoints',
  handler: (args) => checkpoints(args),
}

export async function checkpoints(args: string[]): Promise<void> {
  const cwd = process.cwd()
  const store = new RunCheckpoint(cwd)
  const prune = args.includes('--prune')
  const json = args.includes('--json')

  if (prune) {
    const pruned = store.prune()
    console.log(`\n  Pruned ${pruned} old checkpoint(s)\n`)
    return
  }

  const list = store.list()

  if (list.length === 0) {
    console.log('\n  No checkpoints found.\n')
    console.log('  Checkpoints are created automatically during `agenthood run`.\n')
    return
  }

  if (json) {
    console.log(JSON.stringify(list, null, 2))
    return
  }

  console.log(`\n  ${list.length} checkpoint(s):\n`)
  for (const cp of list) {
    const status = cp.status === 'completed' ? '✓' : cp.status === 'failed' ? '✗' : cp.status === 'running' ? '●' : '○'
    const date = new Date(cp.updatedAt).toLocaleString()
    console.log(`  ${status} ${cp.id}`)
    console.log(`    Member: ${cp.member} | Step: ${cp.step} | Tokens: ${cp.usage.totalTokens}`)
    console.log(`    Task: ${cp.task.slice(0, 60)}${cp.task.length > 60 ? '...' : ''}`)
    console.log(`    ${date}`)
    if (cp.status === 'failed' || cp.status === 'interrupted') {
      console.log(`    Resume: agenthood run ${cp.member} "task" --resume ${cp.id}`)
    }
    console.log()
  }
}
