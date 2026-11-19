import { readFileSync } from 'node:fs'
import { relative, join } from 'node:path'
import { MEMBER_NAMES } from '../members.ts'
import { writeRoutingDecision, type RoutingDecision } from '../reasoning/routing.ts'
import { userError } from '../core/cliError.ts'
import type { CommandDescriptor } from './types.ts'

const STDIN_FIX = 'Pipe one JSON object: agenthood route < record.json'

const HELP = `
  agenthood route: record one routing decision for the audit trail

  Reads a JSON object from stdin, validates it, and writes
  .agenthood/routing/<id>.json. id and timestamp are filled when absent;
  every violation is reported at once and nothing is written.

  Required fields:
    member                   who routed (e.g. mediator)
    intent                   ambiguous | capacity-sensitive | entry-violation | clear-specialist
    confidence               0-100
    target                   a registered member
    reasoning                one line of free text
    confidence_factors       array of strings
    alternatives_considered  array of strings
    cascade_applied          boolean
    parallel_evaluation      object or null

  Example:
    agenthood route <<'JSON'
    { "member": "mediator", "intent": "clear-specialist", "confidence": 94,
      "target": "builder", "reasoning": "names the file and the change",
      "confidence_factors": ["named file"], "alternatives_considered": [],
      "cascade_applied": false, "parallel_evaluation": null }
    JSON
`

/**
 * Validates and writes one routing record. Kept separate from stdin and error
 * rendering so tests can exercise the record contract directly.
 */
export function writeRoutingRecord(raw: string, cwd: string, members: readonly string[] = MEMBER_NAMES): string {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (error) {
    throw new Error(`invalid JSON: ${(error as Error).message}`, { cause: error })
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('the routing record must be a JSON object')
  }

  const record = parsed as Record<string, unknown>
  // Fill only when absent: a wrong-typed value goes to the validator and fails closed.
  const id = record.id === undefined || record.id === null || record.id === '' ? `route-${Date.now()}` : record.id
  const timestamp =
    record.timestamp === undefined || record.timestamp === null || record.timestamp === ''
      ? new Date().toISOString()
      : record.timestamp
  const decision = { ...record, id, timestamp } as RoutingDecision

  return writeRoutingDecision(join(cwd, '.agenthood', 'routing'), decision, members)
}

function readStdin(): string {
  if (process.stdin.isTTY) {
    userError('No routing record on stdin.', { fix: STDIN_FIX })
  }
  try {
    return readFileSync(0, 'utf8')
  } catch (error) {
    userError(`Could not read stdin: ${(error as Error).message}`, {
      fix: STDIN_FIX,
    })
  }
}

export async function route(args: string[] = [], cwd: string = process.cwd()): Promise<void> {
  if (args.includes('--help') || args.includes('-h')) {
    console.log(HELP)
    return
  }
  const flag = args.find((arg) => arg.startsWith('-'))
  if (flag) userError(`Unknown flag: "${flag}"`, { fix: 'Run "agenthood route --help" to see the format.' })

  const raw = readStdin()
  if (raw.trim() === '') {
    userError('The routing record on stdin is empty.', { fix: STDIN_FIX })
  }

  try {
    const filePath = writeRoutingRecord(raw, cwd)
    console.log(`  Routing record written to ${relative(cwd, filePath)}`)
  } catch (error) {
    userError((error as Error).message, { fix: 'Fix the record and pipe it again; nothing was written.' })
  }
}

export const command: CommandDescriptor = {
  name: 'route',
  description: 'Write a validated routing decision from JSON on stdin',
  handler: (args) => route(args),
}
